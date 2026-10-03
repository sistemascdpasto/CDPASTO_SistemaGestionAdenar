<?php

namespace App\Services\Flota;

use App\Models\Flota\Varada;
use App\Models\Flota\VaradaUbicacion;
use App\Support\HojaCalculo;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Throwable;

class VaradaImportService
{
    /**
     * Hojas de origen esperadas (nombre variable mes a mes, por eso se
     * detectan por encabezado en vez de por nombre fijo):
     * - Hoja de varadas: encabezados PLACA + SISTEMA.
     * - Hoja de coordenadas: encabezados LUGAR + LATITUD + LONGITUD.
     */
    public function importar(array $rutasArchivos, ?int $userId = null): array
    {
        $archivosProcesados = 0;
        $varadasCreadas = 0;
        $varadasActualizadas = 0;
        $ubicacionesCargadas = 0;
        $errores = 0;

        foreach ($rutasArchivos as $path => $nombreOriginal) {
            try {
                $spreadsheet = HojaCalculo::cargar($path);

                DB::transaction(function () use ($spreadsheet, $userId, &$varadasCreadas, &$varadasActualizadas, &$ubicacionesCargadas) {
                    // Primero las coordenadas: las varadas del mismo archivo
                    // ya pueden aprovecharlas para resolver latitud/longitud.
                    foreach ($spreadsheet->getAllSheets() as $hoja) {
                        [$headerRow, $colMap] = $this->detectarEncabezado($hoja);
                        if ($headerRow === null) {
                            continue;
                        }
                        if (isset($colMap['lugar'], $colMap['latitud'], $colMap['longitud']) && ! isset($colMap['placa'], $colMap['sistema'])) {
                            $ubicacionesCargadas += $this->importarUbicaciones($hoja, $headerRow, $colMap);
                        }
                    }

                    $ubicaciones = $this->mapaDeUbicaciones();

                    foreach ($spreadsheet->getAllSheets() as $hoja) {
                        [$headerRow, $colMap] = $this->detectarEncabezado($hoja);
                        if ($headerRow === null) {
                            continue;
                        }
                        if (isset($colMap['placa'], $colMap['sistema'])) {
                            [$creadas, $actualizadas] = $this->importarVaradas($hoja, $headerRow, $colMap, $ubicaciones, $userId);
                            $varadasCreadas += $creadas;
                            $varadasActualizadas += $actualizadas;
                        }
                    }
                });

                $archivosProcesados++;
            } catch (Throwable $e) {
                Log::error("Error importando Excel de varadas ({$nombreOriginal}): {$e->getMessage()}");
                $errores++;
            }
        }

        return [
            'archivos_procesados' => $archivosProcesados,
            'varadas_creadas' => $varadasCreadas,
            'varadas_actualizadas' => $varadasActualizadas,
            'ubicaciones_cargadas' => $ubicacionesCargadas,
            'errores' => $errores,
        ];
    }

    private function normalizeText(string $text): string
    {
        $text = mb_strtoupper(trim($text), 'UTF-8');
        $unaccented = strtr($text, [
            'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ñ' => 'N', 'Ü' => 'U',
        ]);

        return preg_replace('/[^A-Z0-9]/', '', $unaccented) ?? '';
    }

    /**
     * Busca la primera fila con al menos 3 celdas no vacías dentro de las
     * primeras filas de la hoja y clasifica cada columna encontrada según
     * el encabezado normalizado. Devuelve [numeroDeFilaDeEncabezado, colMap]
     * o [null, []] si la hoja no tiene una fila de encabezado reconocible.
     */
    private function detectarEncabezado(Worksheet $hoja): array
    {
        $maxFilaBusqueda = min(5, $hoja->getHighestRow());

        for ($fila = 1; $fila <= $maxFilaBusqueda; $fila++) {
            $colMap = [];
            $noVacias = 0;

            foreach ($hoja->getRowIterator($fila, $fila)->current()->getCellIterator() as $celda) {
                /** @var Cell $celda */
                $texto = trim((string) $celda->getCalculatedValue());
                if ($texto === '') {
                    continue;
                }
                $noVacias++;

                $norm = $this->normalizeText($texto);
                $campo = $this->clasificarEncabezado($norm);
                if ($campo !== null) {
                    $colMap[$campo] = $celda->getColumn();
                }
            }

            if ($noVacias >= 3) {
                return [$fila, $colMap];
            }
        }

        return [null, []];
    }

    private function clasificarEncabezado(string $norm): ?string
    {
        return match (true) {
            str_contains($norm, 'REPORTADA') => 'fecha_reportada',
            str_contains($norm, 'ASISTENCIA') => 'fecha_asistencia',
            str_contains($norm, 'SOLUCION') && str_contains($norm, 'FECHA') => 'fecha_solucion',
            $norm === 'PLACA' => 'placa',
            $norm === 'SISTEMA' => 'sistema',
            str_contains($norm, 'CAUSA') => 'causa_probable',
            str_contains($norm, 'FALLA') => 'tipo_falla',
            str_contains($norm, 'DESCRIPCION') => 'descripcion',
            str_contains($norm, 'REPETITIVA') => 'repetitiva',
            $norm === 'RUTA' => 'ruta',
            $norm === 'LUGAR' => 'lugar',
            str_contains($norm, 'PROVEEDOR') => 'proveedor',
            str_contains($norm, 'SOLUCION') => 'tipo_solucion',
            str_contains($norm, 'IMPACTO') => 'impacto',
            str_contains($norm, 'GRAVEDAD') => 'gravedad',
            str_contains($norm, 'OBSERVACION') => 'observaciones',
            $norm === 'LATITUD' => 'latitud',
            $norm === 'LONGITUD' => 'longitud',
            default => null,
        };
    }

    private function celda(Worksheet $hoja, ?string $columna, int $fila): mixed
    {
        if ($columna === null) {
            return null;
        }

        return $hoja->getCell("{$columna}{$fila}")->getCalculatedValue();
    }

    private function texto(Worksheet $hoja, ?string $columna, int $fila): ?string
    {
        if ($columna === null) {
            return null;
        }
        $valor = trim((string) $this->celda($hoja, $columna, $fila));

        return $valor !== '' ? $valor : null;
    }

    private function fecha(Worksheet $hoja, ?string $columna, int $fila): ?CarbonImmutable
    {
        if ($columna === null) {
            return null;
        }

        $cell = $hoja->getCell("{$columna}{$fila}");
        $valor = $cell->getCalculatedValue();

        if ($valor === null || $valor === '') {
            return null;
        }

        if (is_numeric($valor) && ExcelDate::isDateTime($cell)) {
            return CarbonImmutable::instance(ExcelDate::excelToDateTimeObject($valor));
        }

        try {
            return CarbonImmutable::parse((string) $valor);
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * Corrige un defecto real del archivo fuente: Excel interpretó la coma
     * decimal como separador de miles al escribir coordenadas (ej. "1,2136"
     * quedó guardado como el entero 12136). Toda coordenada válida para esta
     * operación (Nariño) tiene magnitud < 90, así que cualquier valor con
     * |valor| > 180 se corrige dividiendo entre 10000.
     */
    private function parseCoordenada(mixed $valor): ?float
    {
        if ($valor === null || $valor === '') {
            return null;
        }

        $numero = is_numeric($valor) ? (float) $valor : (float) str_replace(',', '.', (string) $valor);

        return abs($numero) > 180 ? $numero / 10000 : $numero;
    }

    private function importarUbicaciones(Worksheet $hoja, int $headerRow, array $colMap): int
    {
        $cargadas = 0;

        for ($fila = $headerRow + 1; $fila <= $hoja->getHighestRow(); $fila++) {
            $lugar = $this->texto($hoja, $colMap['lugar'], $fila);
            if ($lugar === null) {
                continue;
            }

            $latitud = $this->parseCoordenada($this->celda($hoja, $colMap['latitud'], $fila));
            $longitud = $this->parseCoordenada($this->celda($hoja, $colMap['longitud'], $fila));
            if ($latitud === null || $longitud === null) {
                continue;
            }

            VaradaUbicacion::updateOrCreate(
                ['lugar' => $lugar],
                ['latitud' => $latitud, 'longitud' => $longitud],
            );
            $cargadas++;
        }

        return $cargadas;
    }

    /**
     * @return array<string, array{0: float, 1: float}> lugar normalizado => [lat, lon]
     */
    private function mapaDeUbicaciones(): array
    {
        return VaradaUbicacion::all()
            ->mapWithKeys(fn (VaradaUbicacion $u) => [
                $this->normalizeText($u->lugar) => [(float) $u->latitud, (float) $u->longitud],
            ])
            ->all();
    }

    private function resolverCoordenadas(array $ubicaciones, ?string $ruta): array
    {
        if ($ruta === null || $ubicaciones === []) {
            return [null, null];
        }

        $normRuta = $this->normalizeText($ruta);

        if (isset($ubicaciones[$normRuta])) {
            return $ubicaciones[$normRuta];
        }

        foreach ($ubicaciones as $lugarNorm => $coords) {
            if (str_contains($normRuta, $lugarNorm) || str_contains($lugarNorm, $normRuta)) {
                return $coords;
            }
        }

        return [null, null];
    }

    /**
     * @return array{0: int, 1: int} [creadas, actualizadas]
     */
    private function importarVaradas(Worksheet $hoja, int $headerRow, array $colMap, array $ubicaciones, ?int $userId): array
    {
        $creadas = 0;
        $actualizadas = 0;

        for ($fila = $headerRow + 1; $fila <= $hoja->getHighestRow(); $fila++) {
            $placa = $this->texto($hoja, $colMap['placa'], $fila);
            if ($placa === null) {
                continue; // fila de relleno sin datos reales
            }

            $fechaReportada = $this->fecha($hoja, $colMap['fecha_reportada'] ?? null, $fila);
            if ($fechaReportada === null) {
                continue;
            }

            $ruta = $this->texto($hoja, $colMap['ruta'] ?? null, $fila);

            $latitud = $this->parseCoordenada($this->celda($hoja, $colMap['latitud'] ?? null, $fila) ?? null);
            $longitud = $this->parseCoordenada($this->celda($hoja, $colMap['longitud'] ?? null, $fila) ?? null);
            if ($latitud === null || $longitud === null) {
                [$latitud, $longitud] = $this->resolverCoordenadas($ubicaciones, $ruta);
            }

            $repetitivaTexto = $this->texto($hoja, $colMap['repetitiva'] ?? null, $fila);
            $gravedadTexto = $this->texto($hoja, $colMap['gravedad'] ?? null, $fila);

            $payload = [
                'fecha_asistencia' => $this->fecha($hoja, $colMap['fecha_asistencia'] ?? null, $fila),
                'fecha_solucion' => $this->fecha($hoja, $colMap['fecha_solucion'] ?? null, $fila),
                'sistema' => $this->texto($hoja, $colMap['sistema'] ?? null, $fila),
                'tipo_falla' => $this->texto($hoja, $colMap['tipo_falla'] ?? null, $fila),
                'descripcion' => $this->texto($hoja, $colMap['descripcion'] ?? null, $fila),
                'causa_probable' => $this->texto($hoja, $colMap['causa_probable'] ?? null, $fila),
                'repetitiva' => strtoupper((string) $repetitivaTexto) === 'SI',
                'ruta' => $ruta,
                'lugar' => $this->texto($hoja, $colMap['lugar'] ?? null, $fila),
                'proveedor' => $this->texto($hoja, $colMap['proveedor'] ?? null, $fila),
                'tipo_solucion' => $this->texto($hoja, $colMap['tipo_solucion'] ?? null, $fila),
                'impacto' => $this->texto($hoja, $colMap['impacto'] ?? null, $fila),
                'gravedad' => $gravedadTexto !== null && is_numeric($gravedadTexto) ? (int) $gravedadTexto : null,
                'observaciones' => $this->texto($hoja, $colMap['observaciones'] ?? null, $fila),
                'latitud' => $latitud,
                'longitud' => $longitud,
                'origen' => 'excel',
            ];

            if ($userId !== null) {
                $payload['created_by'] = $userId;
            }

            $existia = Varada::query()
                ->where('placa', $placa)
                ->where('fecha_reportada', $fechaReportada)
                ->exists();

            Varada::updateOrCreate(
                ['placa' => $placa, 'fecha_reportada' => $fechaReportada],
                $payload,
            );

            $existia ? $actualizadas++ : $creadas++;
        }

        return [$creadas, $actualizadas];
    }
}
