<?php

namespace App\Services\Gente;

use App\Models\Gente\ColaboradorPadrinoCriterio;
use App\Models\Seguridad\Colaborador;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Throwable;

class PlanPadrinoCriteriosImportService
{
    /**
     * Mapeo de nombres de columnas del Excel a claves internas de la base de datos.
     */
    private const HEADER_MAP = [
        'QRSAFETY' => 'qr_safety',
        'QR' => 'qr_safety',
        'CODIGOQR' => 'qr_safety',

        'NOMBRE' => 'nombre_excel',
        'COLABORADOR' => 'nombre_excel',

        'FUNCIONAL7DIAS' => 'funcional_7_dias',
        'FUNCIONAL30DIAS' => 'funcional_30_dias',
        'FUNCIONAL90DIAS' => 'funcional_90_dias',
        'FUNCIONAL' => 'funcional_total',

        'HABTECNICAS1' => 'hab_tecnicas_1',
        'HABILIDADESTECNICAS1' => 'hab_tecnicas_1',
        'HABTECNICAS2' => 'hab_tecnicas_2',
        'HABILIDADESTECNICAS2' => 'hab_tecnicas_2',
        'HABTECNICAS3' => 'hab_tecnicas_3',
        'HABILIDADESTECNICAS3' => 'hab_tecnicas_3',
        'HABILIDADESTECNICAS' => 'habilidades_tecnicas_total',

        'AUTONOMIA1' => 'autonomia_1',
        'AUTONOMIA2' => 'autonomia_2',
        'AUTONOMIA3' => 'autonomia_3',
        'AUTONOMIA4' => 'autonomia_4',
        'AUTONOMIA' => 'autonomia_total',
    ];

    public function importar(string $rutaArchivo): array
    {
        $spreadsheet = IOFactory::load($rutaArchivo);
        $worksheet = $spreadsheet->getActiveSheet();
        $rows = $worksheet->toArray(null, true, true, true);

        if (empty($rows)) {
            return ['procesados' => 0, 'creados' => 0, 'actualizados' => 0, 'errores' => 0];
        }

        // 1. Mapear encabezados de la primera fila
        $headerRow = array_shift($rows);
        $columnaAMapa = [];

        foreach ($headerRow as $letra => $textoHeader) {
            if (empty($textoHeader)) {
                continue;
            }

            $norm = $this->normalizarHeader((string) $textoHeader);

            foreach (self::HEADER_MAP as $clave => $campo) {
                if ($norm === $clave) {
                    $columnaAMapa[$letra] = $campo;
                    break;
                }
            }
        }

        $procesados = 0;
        $creados = 0;
        $actualizados = 0;
        $errores = 0;

        // Obtener colaboradores para cruzarlos por QR Safety o Cédula
        $colaboradores = Colaborador::all();

        foreach ($rows as $numeroFila => $fila) {
            $datosRow = [];

            foreach ($columnaAMapa as $letra => $campo) {
                $valor = trim((string) ($fila[$letra] ?? ''));
                $datosRow[$campo] = $valor;
            }

            $qrSafety = trim((string) ($datosRow['qr_safety'] ?? ''));

            if ($qrSafety === '') {
                continue;
            }

            try {
                $procesados++;
                $normQr = $this->normalizarIdentificador($qrSafety);

                // Buscar colaborador coincidiendo por QR Safety o Cédula
                $colaboradorMatch = $colaboradores->first(function ($c) use ($normQr) {
                    if (! empty($c->codigo_qr_skap) && $this->normalizarIdentificador((string) $c->codigo_qr_skap) === $normQr) {
                        return true;
                    }
                    if (! empty($c->cedula) && $this->normalizarIdentificador((string) $c->cedula) === $normQr) {
                        return true;
                    }
                    return false;
                });

                $colaboradorId = $colaboradorMatch?->id;

                $dataToSave = [
                    'colaborador_id' => $colaboradorId,
                    'nombre_excel' => $datosRow['nombre_excel'] ?? ($colaboradorMatch?->nombre_completo ?? null),
                    'funcional_7_dias' => $this->parseNumero($datosRow['funcional_7_dias'] ?? null),
                    'funcional_30_dias' => $this->parseNumero($datosRow['funcional_30_dias'] ?? null),
                    'funcional_90_dias' => $this->parseNumero($datosRow['funcional_90_dias'] ?? null),
                    'funcional_total' => $this->parseNumero($datosRow['funcional_total'] ?? null),
                    'hab_tecnicas_1' => $this->parseNumero($datosRow['hab_tecnicas_1'] ?? null),
                    'hab_tecnicas_2' => $this->parseNumero($datosRow['hab_tecnicas_2'] ?? null),
                    'hab_tecnicas_3' => $this->parseNumero($datosRow['hab_tecnicas_3'] ?? null),
                    'habilidades_tecnicas_total' => $this->parseNumero($datosRow['habilidades_tecnicas_total'] ?? null),
                    'autonomia_1' => $this->parseNumero($datosRow['autonomia_1'] ?? null),
                    'autonomia_2' => $this->parseNumero($datosRow['autonomia_2'] ?? null),
                    'autonomia_3' => $this->parseNumero($datosRow['autonomia_3'] ?? null),
                    'autonomia_4' => $this->parseNumero($datosRow['autonomia_4'] ?? null),
                    'autonomia_total' => $this->parseNumero($datosRow['autonomia_total'] ?? null),
                ];

                $record = ColaboradorPadrinoCriterio::updateOrCreate(
                    ['qr_safety' => $qrSafety],
                    $dataToSave
                );

                // Si encontramos al colaborador, actualizar su nivel de autonomía según la regla: Autonomía 4 = 100 -> Nivel 4, etc.
                if ($colaboradorMatch) {
                    $colaboradorMatch->nivel_autonomia = $this->calcularNivelSegunAutonomias(
                        $dataToSave['autonomia_1'],
                        $dataToSave['autonomia_2'],
                        $dataToSave['autonomia_3'],
                        $dataToSave['autonomia_4'],
                        $dataToSave['autonomia_total']
                    );
                    $colaboradorMatch->save();
                }

                if ($record->wasRecentlyCreated) {
                    $creados++;
                } else {
                    $actualizados++;
                }
            } catch (Throwable $e) {
                Log::warning("Importación Criterios Plan Padrino: error en fila {$numeroFila}: {$e->getMessage()}");
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

    private function parseNumero(mixed $val): ?float
    {
        if ($val === null || $val === '') {
            return null;
        }

        $str = str_replace(['%', ','], ['', '.'], (string) $val);
        $clean = trim($str);

        return is_numeric($clean) ? round((float) $clean, 2) : null;
    }

    /**
     * Regla de negocio: Evalúa Autonomía 4, 3, 2, 1 para asignar Nivel 4, 3, 2, 1 o 0.
     */
    public function calcularNivelSegunAutonomias(
        ?float $a1,
        ?float $a2,
        ?float $a3,
        ?float $a4,
        ?float $aTotal = null
    ): string {
        if ($a4 !== null && $a4 >= 100) {
            return 'Nivel 4';
        }
        if ($a3 !== null && $a3 >= 100) {
            return 'Nivel 3';
        }
        if ($a2 !== null && $a2 >= 100) {
            return 'Nivel 2';
        }
        if ($a1 !== null && $a1 >= 100) {
            return 'Nivel 1';
        }

        if ($aTotal !== null) {
            if ($aTotal >= 100) return 'Nivel 4';
            if ($aTotal >= 75) return 'Nivel 3';
            if ($aTotal >= 50) return 'Nivel 2';
            if ($aTotal >= 25) return 'Nivel 1';
        }

        return 'Nivel 0';
    }

    private function normalizarHeader(string $texto): string
    {
        $str = mb_strtoupper(trim($texto), 'UTF-8');
        $str = str_replace(['Á', 'É', 'Í', 'Ó', 'Ú', 'Ü', 'Ñ'], ['A', 'E', 'I', 'O', 'U', 'U', 'N'], $str);
        return preg_replace('/[^A-Z0-9]/', '', $str) ?? $str;
    }

    private function normalizarIdentificador(string $texto): string
    {
        return mb_strtoupper(trim($texto), 'UTF-8');
    }
}
