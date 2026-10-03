<?php

namespace App\Services\Gente;

use App\Models\Gente\ColaboradorCalificacion;
use App\Models\Seguridad\Colaborador;
use App\Support\HojaCalculo;
use Illuminate\Support\Facades\Log;
use Throwable;

class ColaboradorCalificacionImportService
{
    private const HEADER_MAP = [
        'COLABORADOR' => 'colaborador',
        'NOTAMODULO' => 'nota_modulo',
        'NOTA' => 'nota_modulo',
        'MODULO' => 'modulo',
        'IDENTIFICACION' => 'identificacion',
        'IDENTIFICAC' => 'identificacion',
        'CEDULA' => 'identificacion',
        'QRSAFETY' => 'qr_safety',
        'QRSafety' => 'qr_safety',
        'QR' => 'qr_safety',
        'CENTRODISTRIBUCION' => 'centro_distribucion',
        'CENTRO' => 'centro_distribucion',
        'CARGO' => 'cargo',
        'ID' => 'modulo_id_externo',
    ];

    public function importar(string $rutaArchivo): array
    {
        $spreadsheet = HojaCalculo::cargar($rutaArchivo);
        $worksheet = $spreadsheet->getActiveSheet();
        $rows = HojaCalculo::filas($worksheet, true, true);

        if (empty($rows)) {
            return ['procesados' => 0, 'creados' => 0, 'actualizados' => 0, 'errores' => 0];
        }

        // 1. Mapear encabezados
        $headerRow = array_shift($rows);
        $columnaAMapa = [];

        foreach ($headerRow as $letra => $textoHeader) {
            $norm = $this->normalizar((string) $textoHeader);
            
            // Coincidencia exacta primero
            $encontrado = false;
            foreach (self::HEADER_MAP as $clave => $campo) {
                if ($norm === $clave) {
                    $columnaAMapa[$letra] = $campo;
                    $encontrado = true;
                    break;
                }
            }

            // Coincidencia por subcadena si no hubo exacta
            if (!$encontrado) {
                foreach (self::HEADER_MAP as $clave => $campo) {
                    if (str_contains($norm, $clave)) {
                        $columnaAMapa[$letra] = $campo;
                        break;
                    }
                }
            }
        }

        $procesados = 0;
        $creados = 0;
        $actualizados = 0;
        $errores = 0;

        // Caché de colaboradores para optimizar consultas por cédula, codigo_qr_skap y nombre
        $colaboradores = Colaborador::all();

        foreach ($rows as $numeroFila => $fila) {
            $datosRow = [];

            foreach ($columnaAMapa as $letra => $campo) {
                $valor = trim((string) ($fila[$letra] ?? ''));
                $datosRow[$campo] = $valor;
            }

            $identificacion = trim((string) ($datosRow['identificacion'] ?? ''));
            $qrSafety = trim((string) ($datosRow['qr_safety'] ?? ''));
            $modulo = trim((string) ($datosRow['modulo'] ?? ''));

            if (($identificacion === '' && $qrSafety === '') || $modulo === '') {
                continue;
            }

            try {
                $procesados++;

                // Buscar colaborador por cédula, por codigo_qr_skap (QR Safety) o por nombre
                $normIdentificacion = $identificacion !== '' ? $this->normalizar($identificacion) : '';
                $normQrSafety = $qrSafety !== '' ? $this->normalizar($qrSafety) : '';

                $colaboradorMatch = $colaboradores->first(function ($c) use ($normIdentificacion, $normQrSafety) {
                    if ($normQrSafety !== '' && !empty($c->codigo_qr_skap) && $this->normalizar((string)$c->codigo_qr_skap) === $normQrSafety) {
                        return true;
                    }
                    if ($normIdentificacion !== '') {
                        if (!empty($c->cedula) && $this->normalizar((string)$c->cedula) === $normIdentificacion) {
                            return true;
                        }
                        if (!empty($c->codigo_qr_skap) && $this->normalizar((string)$c->codigo_qr_skap) === $normIdentificacion) {
                            return true;
                        }
                    }
                    return false;
                });

                $colaboradorId = null;
                if ($colaboradorMatch) {
                    $colaboradorId = $colaboradorMatch->id;
                    // Si no venía identificación o venía el QR en su lugar, usar la cédula del colaborador
                    if (!empty($colaboradorMatch->cedula)) {
                        $identificacion = $colaboradorMatch->cedula;
                    }
                    if (empty($datosRow['colaborador']) && !empty($colaboradorMatch->nombre_completo)) {
                        $datosRow['colaborador'] = $colaboradorMatch->nombre_completo;
                    }
                }

                if ($identificacion === '') {
                    $identificacion = $qrSafety;
                }

                $notaRaw = $datosRow['nota_modulo'] ?? null;
                $notaFloat = null;
                if ($notaRaw !== null && $notaRaw !== '') {
                    $notaClean = str_replace(',', '.', (string) $notaRaw);
                    $notaFloat = is_numeric($notaClean) ? round((float) $notaClean, 2) : null;
                }

                $record = ColaboradorCalificacion::updateOrCreate(
                    [
                        'identificacion' => $identificacion,
                        'modulo' => $modulo,
                    ],
                    [
                        'colaborador_id' => $colaboradorId,
                        'colaborador' => $datosRow['colaborador'] ?? null,
                        'cargo' => $datosRow['cargo'] ?? null,
                        'centro_distribucion' => $datosRow['centro_distribucion'] ?? null,
                        'modulo_id_externo' => $datosRow['modulo_id_externo'] ?? null,
                        'nota_modulo' => $notaFloat,
                    ]
                );

                if ($record->wasRecentlyCreated) {
                    $creados++;
                } else {
                    $actualizados++;
                }
            } catch (Throwable $e) {
                Log::warning("Importación Calificaciones: error en fila {$numeroFila}: {$e->getMessage()}");
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

    private function normalizar(string $texto): string
    {
        $str = mb_strtoupper(trim($texto), 'UTF-8');
        $str = str_replace(['Á', 'É', 'Í', 'Ó', 'Ú', 'Ü', 'Ñ'], ['A', 'E', 'I', 'O', 'U', 'U', 'N'], $str);
        return preg_replace('/[^A-Z0-9]/', '', $str) ?? $str;
    }
}
