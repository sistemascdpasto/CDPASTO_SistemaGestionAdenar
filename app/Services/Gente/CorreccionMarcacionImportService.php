<?php

namespace App\Services\Gente;

use App\Models\Gente\CorreccionMarcacion;
use App\Models\Seguridad\Colaborador;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use Throwable;

class CorreccionMarcacionImportService
{
    private function normalizeHeader(string $text): string
    {
        $text = mb_strtoupper(trim($text), 'UTF-8');
        $unaccented = strtr(utf8_decode($text), utf8_decode('ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑ'), 'AEIOUAEIOUAEIOUAEIOUN');
        return preg_replace('/[^A-Z0-9]/', '', $unaccented);
    }

    /**
     * Normaliza una cédula / identificación para búsqueda O(1) contra el HashMap.
     * Elimina espacios, puntos, comas, guiones y subrayados.
     */
    private function normalizeCedula(string $text): string
    {
        $text = trim((string)$text);
        if ($text === '') return '';
        return preg_replace('/[\s\.,\-_]/', '', $text);
    }

    private function parseFecha($raw): ?string
    {
        if ($raw === null || (is_string($raw) && trim($raw) === '')) {
            return null;
        }

        // Caso 1: número serial de Excel
        if (is_numeric($raw)) {
            try {
                $dt = ExcelDate::excelToDateTimeObject((float)$raw);
                return $dt->format('Y-m-d');
            } catch (Throwable) {
                // se ignora y continúa con el flujo de string
            }
        }

        $str = trim((string)$raw);
        if ($str === '') return null;

        // Caso 2: formato ISO Y-m-d / Y/m/d y variaciones
        $normalizado = str_replace(['/', '.', ' '], '-', $str);
        // Quitar la parte de hora si viene adjunta
        $soloFecha = explode('-', $normalizado);
        $formatos = [
            'Y-m-d', 'd-m-Y', 'm-d-Y',
            'Y-m-d H:i:s', 'd-m-Y H:i:s',
            'Y-m-d H:i',   'd-m-Y H:i',
        ];
        foreach ($formatos as $fmt) {
            $dt = \DateTime::createFromFormat($fmt, $normalizado);
            if ($dt !== false) {
                // Verificar que no haya desbordamiento (ej: mes 13)
                $errors = \DateTime::getLastErrors();
                if (empty($errors['warnings']) && empty($errors['errors'])) {
                    return $dt->format('Y-m-d');
                }
            }
        }

        // Caso 3: strtotime (último recurso)
        $ts = strtotime($str);
        if ($ts !== false) {
            return date('Y-m-d', $ts);
        }

        return null;
    }

    private function parseHora($raw): ?string
    {
        if ($raw === null || (is_string($raw) && trim($raw) === '')) {
            return null;
        }

        // Número serial fracción de día (Excel)
        if (is_numeric($raw)) {
            try {
                $fraccion = (float)$raw;
                if ($fraccion >= 0 && $fraccion < 1) {
                    $segundos = (int) round($fraccion * 86400);
                    $horas = floor($segundos / 3600);
                    $minutos = floor(($segundos % 3600) / 60);
                    $seg = $segundos % 60;
                    return sprintf('%02d:%02d:%02d', $horas, $minutos, $seg);
                }
                $dt = ExcelDate::excelToDateTimeObject($fraccion);
                return $dt->format('H:i:s');
            } catch (Throwable) {
                // continúa
            }
        }

        $str = trim((string)$raw);
        if ($str === '') return null;

        $formatos = [
            'H:i:s', 'H:i', 'g:i A', 'g:i:s A',
            'h:i A', 'h:i:s A',
        ];
        foreach ($formatos as $fmt) {
            $dt = \DateTime::createFromFormat($fmt, $str);
            if ($dt && $dt->format($fmt) === $str) {
                return $dt->format('H:i:s');
            }
        }

        // Si ya viene en formato H:i o H:i:s, retornarlo tal cual con padding
        if (preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/', $str, $m)) {
            return sprintf('%02d:%02d:%02d', (int)$m[1], (int)$m[2], isset($m[3]) ? (int)$m[3] : 0);
        }

        return $str;
    }

    /**
     * Lee el Excel y devuelve un preview (sin guardar) con el resultado de
     * la validación contra colaboradores. Se usa para la vista previa.
     */
    public function preview(string $rutaArchivo): array
    {
        try {
            $spreadsheet = IOFactory::load($rutaArchivo);
            $worksheet = $spreadsheet->getActiveSheet();

            $rows = [];
            foreach ($worksheet->getRowIterator() as $row) {
                $cellIterator = $row->getCellIterator();
                $cellIterator->setIterateOnlyExistingCells(false);
                $rowData = [];
                foreach ($cellIterator as $colLetter => $cell) {
                    $val = $cell->getCalculatedValue();
                    $formatted = $cell->getFormattedValue();
                    if (is_string($formatted) && trim($formatted) !== '') {
                        $rowData[$colLetter] = $formatted;
                    } else {
                        $rowData[$colLetter] = $val !== null ? $val : $formatted;
                    }
                }
                $rows[$row->getRowIndex()] = $rowData;
            }

            if (empty($rows)) {
                return [
                    'ok' => false,
                    'error' => 'El archivo Excel está vacío.',
                    'filas' => [],
                ];
            }

            // Detectar fila de encabezados
            $colMap = [];
            $headerRowIndex = null;
            foreach ($rows as $rIdx => $row) {
                $nonEmpty = array_filter($row, fn($v) => $v !== null && trim((string)$v) !== '');
                if (count($nonEmpty) >= 2) {
                    $headerRowIndex = $rIdx;
                    foreach ($row as $colLetter => $headerText) {
                        if (!$headerText) continue;
                        $norm = $this->normalizeHeader((string)$headerText);

                        if (str_contains($norm, 'IDENTIFICACION')
                            || str_contains($norm, 'CEDULA')
                            || str_contains($norm, 'CEDULADE')
                            || str_contains($norm, 'DNI')
                            || str_contains($norm, 'DOCUMENTO')
                            || $norm === 'ID'
                            || $norm === 'CC'
                            || $norm === 'CE'
                            || str_contains($norm, 'NIT')
                            || str_contains($norm, 'NUMERODEDOCUMENTO')
                            || str_contains($norm, 'DOCUMENTOIDENTIDAD')) {
                            $colMap['identificacion'] = $colLetter;
                        } elseif (str_contains($norm, 'FECHA') && !isset($colMap['fecha'])) {
                            $colMap['fecha'] = $colLetter;
                        } elseif (str_contains($norm, 'HORA') && !isset($colMap['hora'])) {
                            $colMap['hora'] = $colLetter;
                        } elseif (str_contains($norm, 'TIPO') && !isset($colMap['tipo'])) {
                            $colMap['tipo'] = $colLetter;
                        } elseif (str_contains($norm, 'CENTRODECOSTO')
                            || str_contains($norm, 'CENTROCOSTO')
                            || str_contains($norm, 'CENTRO')
                            || str_contains($norm, 'COSTO')
                            || str_contains($norm, 'CENTRODE')) {
                            $colMap['centro_costo'] = $colLetter;
                        } elseif (str_contains($norm, 'COMENTARIO')
                            || str_contains($norm, 'OBSERVACION')
                            || str_contains($norm, 'NOTA')
                            || str_contains($norm, 'DESCRIPCION')
                            || str_contains($norm, 'OBSERVACIONES')
                            || str_contains($norm, 'NOTAS')) {
                            $colMap['comentario'] = $colLetter;
                        }
                    }
                    break;
                }
            }

            if ($headerRowIndex === null || !isset($colMap['identificacion'])) {
                return [
                    'ok' => false,
                    'error' => 'No se encontró la columna "Identificación" (o Cédula / Documento). Verifica que el archivo tenga encabezados.',
                    'filas' => [],
                ];
            }

            // Lookup colaboradores O(1)
            $colaboradores = Colaborador::whereNotNull('cedula')
                ->where('cedula', '!=', '')
                ->get(['cedula', 'nombres', 'apellidos', 'cargo'])
                ->mapWithKeys(function ($c) {
                    $raw = trim((string)$c->cedula);
                    $key = $this->normalizeCedula($raw);
                    if ($key === '') return [];
                    return [
                        $key => [
                            'nombre_completo' => trim(trim((string)($c->nombres ?? '')) . ' ' . trim((string)($c->apellidos ?? ''))),
                            'cargo'           => trim((string)($c->cargo ?? '')),
                        ],
                    ];
                })
                ->toArray();

            $filas = [];
            $errores = 0;
            $encontrados = 0;
            $validas = 0;
            $procesadas = 0;

            $totalRows = count($rows);
            for ($i = $headerRowIndex + 1; $i <= $totalRows; $i++) {
                $row = $rows[$i] ?? null;
                if (!$row) continue;

                $getValue = fn($key) => isset($colMap[$key]) ? trim((string)($row[$colMap[$key]] ?? '')) : '';

                $identificacion = $getValue('identificacion');
                $fechaRaw = $colMap['fecha'] ? ($row[$colMap['fecha']] ?? null) : null;
                $horaRaw  = $colMap['hora']  ? ($row[$colMap['hora']]  ?? null) : null;

                if ($identificacion === '' && ($fechaRaw === null || $fechaRaw === '')) {
                    continue;
                }

                $procesadas++;
                $fecha = $this->parseFecha($fechaRaw);
                $hora  = $this->parseHora($horaRaw);
                $tipo  = $getValue('tipo');
                $centroCosto = $getValue('centro_costo');
                $comentario  = $getValue('comentario');

                $cedulaRaw = trim($identificacion);
                $cedulaKey = $this->normalizeCedula($cedulaRaw);
                $colInfo = $cedulaKey !== '' ? ($colaboradores[$cedulaKey] ?? null) : null;

                $error = null;
                if ($cedulaKey === '') {
                    $error = 'Identificación vacía';
                } elseif ($fecha === null) {
                    $error = 'Fecha inválida o no reconocida';
                }

                if ($colInfo) {
                    $encontrados++;
                } elseif ($cedulaKey !== '' && $error === null) {
                    $error = 'Identificación no encontrada en colaboradores';
                }

                if ($error !== null) {
                    $errores++;
                } elseif ($colInfo) {
                    $validas++;
                }

                $filas[] = [
                    'numero_fila'        => $i,
                    'identificacion'     => $identificacion,
                    'fecha'              => $fecha,
                    'hora'               => $hora,
                    'tipo'               => $tipo,
                    'centro_costo'       => $centroCosto,
                    'comentario'         => $comentario,
                    'nombre_completo'    => $colInfo['nombre_completo'] ?? null,
                    'cargo'              => $colInfo['cargo'] ?? null,
                    'colaborador_encontrado' => $colInfo !== null,
                    'error_validacion'   => $error,
                ];
            }

            Log::info('CorreccionMarcacion preview detectado:', [
                'colMap' => $colMap,
                'total_filas' => $procesadas,
                'validas' => $validas,
                'encontrados' => $encontrados,
                'errores' => $errores,
            ]);

            return [
                'ok' => true,
                'total_filas' => $procesadas,
                'encontrados' => $encontrados,
                'no_encontrados' => $procesadas - $encontrados,
                'errores' => $errores,
                'validas' => $validas,
                'identificaciones_unicas' => count(array_unique(array_filter(array_column($filas, 'identificacion')))),
                'filas' => $filas,
                'columnas_detectadas' => $colMap,
            ];

        } catch (Throwable $e) {
            Log::error('Error preview Excel corrección-marcaciones: ' . $e->getMessage() . ' | ' . $e->getTraceAsString());
            return [
                'ok' => false,
                'error' => 'No se pudo leer el Excel: ' . $e->getMessage(),
                'filas' => [],
            ];
        }
    }

    /**
     * Persiste los registros ya validados (enviados desde el frontend)
     * o re-importa desde el archivo. Requiere que el usuario haya aceptado
     * el preview. Se re-ejecuta la validación contra colaboradores para
     * garantizar la consistencia.
     *
     * Solo se guardan los registros cuya cédula existe en colaboradores.
     * Se deduplica por (identificacion, fecha, hora) — no se insertan duplicados
     * respecto a lo que ya hay en la tabla.
     */
    public function importarDesdeArchivo(string $rutaArchivo, ?int $usuarioId = null): array
    {
        set_time_limit(600);
        ini_set('memory_limit', '512M');

        $preview = $this->preview($rutaArchivo);
        if (!$preview['ok']) {
            return $preview;
        }

        // Solo filas con colaborador encontrado y sin error de identificación/fecha
        $filasValidas = array_values(array_filter(
            $preview['filas'],
            fn($f) => $f['error_validacion'] === null && $f['colaborador_encontrado']
        ));

        // Cédulas no encontradas para incluir en el mensaje
        $noEncontradas = array_values(array_unique(array_map(
            fn($f) => $f['identificacion'],
            array_filter(
                $preview['filas'],
                fn($f) => $f['error_validacion'] === 'Identificación no encontrada en colaboradores'
            )
        )));

        Log::info('CorreccionMarcacion importarDesdeArchivo:', [
            'preview_total' => count($preview['filas']),
            'preview_validas' => $preview['validas'] ?? -1,
            'filasValidas_filtradas' => count($filasValidas),
            'preview_encontrados' => $preview['encontrados'] ?? -1,
            'preview_errores' => $preview['errores'] ?? -1,
        ]);

        if (empty($filasValidas)) {
            $muestras = array_slice($preview['filas'], 0, 5);
            Log::warning('CorreccionMarcacion sin filas validas para INSERT. Muestras:', [
                'filas' => $muestras,
            ]);
            return [
                'ok' => false,
                'error' => 'No hay filas válidas para guardar. Verifica que las filas tengan identificación y fecha correctas.',
                'total' => count($preview['filas']),
                'guardados' => 0,
            ];
        }

        DB::beginTransaction();
        try {
            $now = now()->toDateTimeString();

            // Cargar claves existentes en BD para deduplicar: (identificacion, fecha, hora)
            $existentes = DB::table('correcciones_marcaciones')
                ->select(['identificacion', 'fecha', 'hora'])
                ->get()
                ->mapWithKeys(fn ($r) => [
                    $r->identificacion . '|' . $r->fecha . '|' . ($r->hora ?? '') => true,
                ])
                ->toArray();

            $chunkSize = 200;
            $totalGuardados = 0;
            $duplicados = 0;
            $payload = [];

            foreach ($filasValidas as $f) {
                $claveUnica = $f['identificacion'] . '|' . $f['fecha'] . '|' . ($f['hora'] ?? '');

                // Saltar si ya existe en BD o ya apareció en este mismo archivo
                if (isset($existentes[$claveUnica])) {
                    $duplicados++;
                    continue;
                }

                // Marcar como procesada para evitar duplicados dentro del propio archivo
                $existentes[$claveUnica] = true;

                $payload[] = [
                    'identificacion'         => $f['identificacion'],
                    'fecha'                  => $f['fecha'],
                    'hora'                   => $f['hora'],
                    'tipo'                   => $f['tipo'],
                    'centro_costo'           => $f['centro_costo'],
                    'comentario'             => $f['comentario'],
                    'nombre_completo'        => $f['nombre_completo'],
                    'cargo'                  => $f['cargo'],
                    'colaborador_encontrado' => true,
                    'error_validacion'       => null,
                    'usuario_importo_id'     => $usuarioId,
                    'created_at'             => $now,
                    'updated_at'             => $now,
                ];

                if (count($payload) >= $chunkSize) {
                    CorreccionMarcacion::insert($payload);
                    $totalGuardados += count($payload);
                    $payload = [];
                }
            }

            if (!empty($payload)) {
                CorreccionMarcacion::insert($payload);
                $totalGuardados += count($payload);
            }

            DB::commit();

            Log::info("CorreccionMarcacionImport: {$totalGuardados} guardados, {$duplicados} duplicados omitidos.");

            // Construir mensaje con cédulas no encontradas
            $mensajeNoEncontradas = '';
            if (!empty($noEncontradas)) {
                $lista = implode(', ', array_slice($noEncontradas, 0, 20));
                $extra = count($noEncontradas) > 20 ? ' y ' . (count($noEncontradas) - 20) . ' más' : '';
                $mensajeNoEncontradas = 'Cédulas no encontradas en colaboradores (' . count($noEncontradas) . '): ' . $lista . $extra . '.';
            }

            return [
                'ok'               => true,
                'total'            => count($preview['filas']),
                'guardados'        => $totalGuardados,
                'duplicados'       => $duplicados,
                'no_encontradas'   => $noEncontradas,
                'mensaje_no_encontradas' => $mensajeNoEncontradas,
                'encontrados'      => $preview['encontrados'],
                'no_encontrados'   => $preview['no_encontrados'] ?? 0,
            ];
        } catch (Throwable $e) {
            DB::rollBack();
            Log::error('Error guardando correcciones_marcaciones: ' . $e->getMessage());
            return [
                'ok' => false,
                'error' => 'Error guardando en BD: ' . $e->getMessage(),
                'total' => count($preview['filas']),
                'guardados' => 0,
            ];
        }
    }
}
