<?php

namespace App\Services\Gente;

use App\Models\Gente\Ausentismo;
use App\Models\Seguridad\Colaborador;
use App\Support\HojaCalculo;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use Throwable;

class AusentismoImportService
{
    public function importar(string $rutaArchivo): array
    {
        $spreadsheet = HojaCalculo::cargar($rutaArchivo);
        $worksheet = $spreadsheet->getActiveSheet();
        $rows = HojaCalculo::filas($worksheet, true, true);

        if (empty($rows)) {
            return ['procesados' => 0, 'creados' => 0, 'actualizados' => 0, 'errores' => 0];
        }

        // 1. Buscar la fila de encabezados examinando las primeras 10 filas
        $headerRowIndex = null;
        $headerRow = null;

        foreach ($rows as $index => $rowCandidate) {
            $rowNorms = array_map(fn($v) => $this->normalizar((string) $v), $rowCandidate);
            // Verificar si contiene al menos dos palabras clave principales
            $matches = 0;
            foreach ($rowNorms as $norm) {
                if (in_array($norm, ['IDENTIFICADOR', 'IDENTIFICAC', 'CEDULA', 'FECHA', 'TURNO', 'APELLIDOS', 'NOMBRES'], true) ||
                    str_contains($norm, 'IDENTIFICAD') || str_contains($norm, 'APELLID')) {
                    $matches++;
                }
            }
            if ($matches >= 2) {
                $headerRowIndex = $index;
                $headerRow = $rowCandidate;
                break;
            }
        }

        if (!$headerRow) {
            // Si no se detectó por keywords, tomar la primera fila no vacía
            foreach ($rows as $index => $rowCandidate) {
                if (array_filter($rowCandidate)) {
                    $headerRowIndex = $index;
                    $headerRow = $rowCandidate;
                    break;
                }
            }
        }

        if (!$headerRow) {
            return ['procesados' => 0, 'creados' => 0, 'actualizados' => 0, 'errores' => 0];
        }

        // Filtrar filas para omitir las anteriores al header
        $dataRows = array_filter($rows, fn($k) => $k > $headerRowIndex, ARRAY_FILTER_USE_KEY);

        // Mapear encabezados secuencialmente
        $columnaAMapa = [];
        $counts = [
            'entro' => 0,
            'atraso' => 0,
            'salio' => 0,
            'adelanto' => 0,
        ];

        foreach ($headerRow as $letra => $textoHeader) {
            $norm = $this->normalizar((string) $textoHeader);

            if (str_contains($norm, 'APELLID')) {
                $columnaAMapa[$letra] = 'apellidos';
            } elseif (str_contains($norm, 'NOMBRE')) {
                $columnaAMapa[$letra] = 'nombres';
            } elseif (str_contains($norm, 'IDENTIFICAD') || str_contains($norm, 'IDENTIFICAC') || str_contains($norm, 'CEDULA') || str_contains($norm, 'DOCUMENTO') || $norm === 'ID' || $norm === 'QR' || $norm === 'QRSAFETY') {
                $columnaAMapa[$letra] = 'identificador';
            } elseif (str_contains($norm, 'GRUP')) {
                $columnaAMapa[$letra] = 'grupo';
            } elseif (str_contains($norm, 'FECHA')) {
                $columnaAMapa[$letra] = 'fecha';
            } elseif (str_contains($norm, 'PERMISO')) {
                $columnaAMapa[$letra] = 'permiso';
            } elseif (str_contains($norm, 'TURNO')) {
                $columnaAMapa[$letra] = 'turno';
            } elseif (str_contains($norm, 'ENTRO') || str_contains($norm, 'ENTRADA')) {
                $counts['entro']++;
                $columnaAMapa[$letra] = 'entro_' . $counts['entro'];
            } elseif (str_contains($norm, 'ATRASO') || str_contains($norm, 'RETRASO')) {
                $counts['atraso']++;
                $columnaAMapa[$letra] = 'atraso_' . $counts['atraso'];
            } elseif (str_contains($norm, 'SALIO') || str_contains($norm, 'SALIDA')) {
                $counts['salio']++;
                $columnaAMapa[$letra] = 'salio_' . $counts['salio'];
            } elseif (str_contains($norm, 'ADELANT')) {
                $counts['adelanto']++;
                $columnaAMapa[$letra] = 'adelanto_' . $counts['adelanto'];
            }
        }

        $procesados = 0;
        $creados = 0;
        $actualizados = 0;
        $errores = 0;

        // Cargar colaboradores para relacionar por cédula, QR SKAP o nombre
        $colaboradores = Colaborador::all();

        foreach ($dataRows as $numeroFila => $fila) {
            $datosRow = [];

            foreach ($columnaAMapa as $letra => $campo) {
                $valor = trim((string) ($fila[$letra] ?? ''));
                $datosRow[$campo] = $valor;
            }

            $rawId = trim((string) ($datosRow['identificador'] ?? ''));
            if (is_numeric($rawId) && str_ends_with($rawId, '.0')) {
                $rawId = substr($rawId, 0, -2);
            }
            // Limpiar el identificador quitando caracteres especiales pero conservando mayúsculas
            $identificador = preg_replace('/[^A-Za-z0-9]/', '', $rawId) ?? $rawId;
            $fechaRaw = trim((string) ($datosRow['fecha'] ?? ''));

            if ($identificador === '' || $fechaRaw === '') {
                continue;
            }

            try {
                $procesados++;

                // Normalizar fecha
                $fechaParsed = $this->parsearFecha($fechaRaw);
                if (!$fechaParsed) {
                    Log::warning("Importación Ausentismo: fecha inválida en fila {$numeroFila}: '{$fechaRaw}'");
                    $errores++;
                    continue;
                }

                // Normalizar el identificador a mayúsculas para que coincida
                // con la normalización de cedula/codigo_qr_skap en BD
                $normId = $this->normalizar($identificador);
                $colaboradorMatch = $colaboradores->first(function ($c) use ($normId) {
                    if (!empty($c->cedula) && $this->normalizar((string)$c->cedula) === $normId) {
                        return true;
                    }
                    if (!empty($c->codigo_qr_skap) && $this->normalizar((string)$c->codigo_qr_skap) === $normId) {
                        return true;
                    }
                    return false;
                });

                $colaboradorId = null;
                if ($colaboradorMatch) {
                    $colaboradorId = $colaboradorMatch->id;
                    if (!empty($colaboradorMatch->cedula)) {
                        $identificador = $colaboradorMatch->cedula;
                    }
                    if (empty($datosRow['apellidos']) && !empty($colaboradorMatch->apellidos)) {
                        $datosRow['apellidos'] = $colaboradorMatch->apellidos;
                    }
                    if (empty($datosRow['nombres']) && !empty($colaboradorMatch->nombres)) {
                        $datosRow['nombres'] = $colaboradorMatch->nombres;
                    }
                } else {
                    Log::warning("Importación Ausentismo: no se encontró colaborador para identificador '{$normId}' (fila {$numeroFila})");
                }

                $record = Ausentismo::updateOrCreate(
                    [
                        'identificador' => $identificador,
                        'fecha' => $fechaParsed,
                    ],
                    [
                        'colaborador_id' => $colaboradorId,
                        'apellidos' => $datosRow['apellidos'] ?? null,
                        'nombres' => $datosRow['nombres'] ?? null,
                        'grupo' => $datosRow['grupo'] ?? null,
                        'permiso' => $datosRow['permiso'] ?? null,
                        'turno' => $datosRow['turno'] ?? null,
                        'entro_1' => $datosRow['entro_1'] ?? null,
                        'atraso_1' => $datosRow['atraso_1'] ?? null,
                        'salio_1' => $datosRow['salio_1'] ?? null,
                        'adelanto_1' => $datosRow['adelanto_1'] ?? null,
                        'entro_2' => $datosRow['entro_2'] ?? null,
                        'atraso_2' => $datosRow['atraso_2'] ?? null,
                        'salio_2' => $datosRow['salio_2'] ?? null,
                        'adelanto_2' => $datosRow['adelanto_2'] ?? null,
                    ]
                );

                if ($record->wasRecentlyCreated) {
                    $creados++;
                } else {
                    $actualizados++;
                }
            } catch (Throwable $e) {
                Log::warning("Importación Ausentismo: error en fila {$numeroFila}: {$e->getMessage()}");
                $errores++;
            }
        }

        return [
            'procesados' => $procesados,
            'creados' => $creados,
            'actualizados' => $actualizados,
            'errores' => $errores,
        ];
    }

    private function parsearFecha(string $valor): ?string
    {
        $v = trim($valor);

        // Si es número entero/decimal estilo serial de Excel (ej: 45536 o 45536.0)
        if (is_numeric($v)) {
            try {
                return Carbon::instance(ExcelDate::excelToDateTimeObject((float) $v))->format('Y-m-d');
            } catch (Throwable) {
                // Continuar a otros métodos
            }
        }

        // Reemplazar puntos o guiones en formatos de fecha estándar
        $cleanV = str_replace('.', '/', str_replace('-', '/', $v));

        // Eliminar prefijo de día de semana como "Lun ", "Mar ", "Mié ", "Sáb ", etc.
        // El Excel de control de asistencia a veces trae "Lun 01-09-2026" o "Sáb 15-08-2026".
        $cleanV = preg_replace('/^[A-Za-záéíóúüñÁÉÍÓÚÜÑ]{2,4}\s+/', '', $cleanV) ?? $cleanV;

        $formatos = [
            'Y/m/d',
            'd/m/Y',
            'm/d/Y',
            'Y-m-d',
            'd-m-Y',
            'd/m/y',
            'Y/m/d H:i:s',
            'd/m/Y H:i:s',
        ];

        foreach ($formatos as $fmt) {
            try {
                $dt = Carbon::createFromFormat($fmt, $cleanV);
                if ($dt !== false) {
                    return $dt->format('Y-m-d');
                }
            } catch (Throwable) {
                continue;
            }
        }

        try {
            return Carbon::parse($v)->format('Y-m-d');
        } catch (Throwable) {
            return null;
        }
    }

    private function normalizar(string $texto): string
    {
        $str = mb_strtoupper(trim($texto), 'UTF-8');
        $str = str_replace(['Á', 'É', 'Í', 'Ó', 'Ú', 'Ü', 'Ñ'], ['A', 'E', 'I', 'O', 'U', 'U', 'N'], $str);
        return preg_replace('/[^A-Z0-9]/', '', $str) ?? $str;
    }
}
