<?php

namespace App\Support;

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Lectura de Excel/CSV para las importaciones sin agotar memoria ni tiempo.
 *
 * Los archivos exportados de otros sistemas suelen traer formato aplicado a columnas o filas
 * completas (hasta la fila 1.048.576). `IOFactory::load()` crea una celda por cada una de esas
 * celdas vacías con estilo y `toArray()` recorre todo ese rango: en producción eso agotaba los
 * 512 MB de memoria o los 30 s de ejecución. Aquí las celdas vacías no se cargan y las filas se
 * leen solo dentro del rango que realmente tiene datos.
 */
class HojaCalculo
{
    public static function cargar(string $ruta): Spreadsheet
    {
        // Una importación grande puede tardar más que una petición normal.
        if ((int) ini_get('max_execution_time') < 120) {
            @set_time_limit(120);
        }

        $reader = IOFactory::createReaderForFile($ruta);
        $reader->setReadEmptyCells(false);

        return $reader->load($ruta);
    }

    /**
     * Equivalente a `$hoja->toArray(null, true, $formatear, $referencias)` limitado a las filas y
     * columnas con datos.
     *
     * @return array<int|string, array<int|string, mixed>>
     */
    public static function filas(Worksheet $hoja, bool $formatear = true, bool $referencias = true): array
    {
        $ultimaFila = $hoja->getHighestDataRow();
        $ultimaColumna = $hoja->getHighestDataColumn();

        return $hoja->rangeToArray("A1:{$ultimaColumna}{$ultimaFila}", null, true, $formatear, $referencias);
    }
}
