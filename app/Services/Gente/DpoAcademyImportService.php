<?php

namespace App\Services\Gente;

use App\Models\Gente\DpoAcademy;
use App\Models\Seguridad\Colaborador;
use App\Support\HojaCalculo;
use Illuminate\Support\Facades\Log;
use Throwable;

class DpoAcademyImportService
{
    private const HEADER_MAP = [
        'REGION' => 'region',
        'CENTRO' => 'centro',
        'NEGOCIO' => 'negocio',
        'QRSAFETY' => 'qr_safety',
        'QRSafety' => 'qr_safety',
        'QR' => 'qr_safety',
        'CODIGOQR' => 'qr_safety',
        'QRSKAP' => 'qr_safety',
        'NOMBRE' => 'nombre',
        'COLABORADOR' => 'nombre',
        'NOMBRECOMPLETO' => 'nombre',
        'CARGO' => 'cargo',
        'CORONITA' => 'coronita',
        'CALIFICACION' => 'calificacion',
        'NOTA' => 'calificacion',
        'PUNTUACION' => 'calificacion',
        'STATUS' => 'status',
        'ESTADO' => 'status',
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

        // Cargar colaboradores para intentar relacionar por nombre/cédula
        $colaboradores = Colaborador::all();

        foreach ($rows as $numeroFila => $fila) {
            $datosRow = [];

            foreach ($columnaAMapa as $letra => $campo) {
                $valor = trim((string) ($fila[$letra] ?? ''));
                $datosRow[$campo] = $valor;
            }

            $nombre = trim((string) ($datosRow['nombre'] ?? ''));
            $qrSafety = trim((string) ($datosRow['qr_safety'] ?? ''));

            if ($nombre === '' && $qrSafety === '') {
                continue;
            }

            try {
                $procesados++;

                // Buscar colaborador id priorizando QR Safety (codigo_qr_skap), luego cédula o nombre
                $colaboradorId = null;
                $normQrSafety = $qrSafety !== '' ? $this->normalizar($qrSafety) : '';
                $normNombre = $nombre !== '' ? $this->normalizar($nombre) : '';

                $colaboradorMatch = $colaboradores->first(function ($c) use ($normNombre, $normQrSafety) {
                    if ($normQrSafety !== '' && !empty($c->codigo_qr_skap) && $this->normalizar((string)$c->codigo_qr_skap) === $normQrSafety) {
                        return true;
                    }
                    if ($normNombre !== '') {
                        if (!empty($c->nombre_completo) && $this->normalizar((string)$c->nombre_completo) === $normNombre) {
                            return true;
                        }
                        if (!empty($c->cedula) && $this->normalizar((string)$c->cedula) === $normNombre) {
                            return true;
                        }
                    }
                    return false;
                });

                if ($colaboradorMatch) {
                    $colaboradorId = $colaboradorMatch->id;
                    if ($nombre === '' && !empty($colaboradorMatch->nombre_completo)) {
                        $nombre = $colaboradorMatch->nombre_completo;
                    }
                }

                if ($nombre === '') {
                    $nombre = 'Colaborador ' . ($qrSafety ?? 'Sin Identificación');
                }

                $califRaw = $datosRow['calificacion'] ?? null;
                $califFloat = null;
                if ($califRaw !== null && $califRaw !== '') {
                    $califClean = str_replace(['%', ','], ['', '.'], (string) $califRaw);
                    $califFloat = is_numeric($califClean) ? round((float) $califClean, 2) : null;
                }

                $region = $datosRow['region'] ?? null;
                $centro = $datosRow['centro'] ?? null;

                // Criterio de búsqueda para updateOrCreate
                $keys = [
                    'nombre' => $nombre,
                ];
                if ($qrSafety) {
                    $keys['qr_safety'] = $qrSafety;
                } elseif ($region && $centro) {
                    $keys['region'] = $region;
                    $keys['centro'] = $centro;
                }

                $record = DpoAcademy::updateOrCreate(
                    $keys,
                    [
                        'colaborador_id' => $colaboradorId,
                        'region' => $region,
                        'centro' => $centro,
                        'negocio' => $datosRow['negocio'] ?? null,
                        'qr_safety' => $qrSafety,
                        'nombre' => $nombre,
                        'cargo' => $datosRow['cargo'] ?? null,
                        'coronita' => $datosRow['coronita'] ?? null,
                        'calificacion' => $califFloat,
                        'status' => $datosRow['status'] ?? null,
                    ]
                );

                if ($record->wasRecentlyCreated) {
                    $creados++;
                } else {
                    $actualizados++;
                }
            } catch (Throwable $e) {
                Log::warning("Importación DPO Academy: error en fila {$numeroFila}: {$e->getMessage()}");
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
