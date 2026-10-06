<?php

namespace App\Support;

use PhpOffice\PhpSpreadsheet\Calculation\Exception as CalculationException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\RichText\RichText;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
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

        try {
            return $hoja->rangeToArray("A1:{$ultimaColumna}{$ultimaFila}", null, true, $formatear, $referencias);
        } catch (CalculationException) {
            // Fórmulas que PhpSpreadsheet no sabe evaluar (p. ej. referencias a tablas de Excel
            // como Tabla1[@Columna]): se usa el resultado que Excel guardó en el archivo.
            return self::filasConValoresGuardados($hoja, $ultimaFila, $ultimaColumna, $formatear, $referencias);
        }
    }

    /**
     * @return array<int|string, array<int|string, mixed>>
     */
    private static function filasConValoresGuardados(Worksheet $hoja, int $ultimaFila, string $ultimaColumna, bool $formatear, bool $referencias): array
    {
        $filas = [];

        foreach ($hoja->getRowIterator(1, $ultimaFila) as $fila) {
            $valores = [];

            foreach ($fila->getCellIterator('A', $ultimaColumna) as $celda) {
                $valor = $celda->isFormula() ? $celda->getOldCalculatedValue() : $celda->getValue();

                if ($valor instanceof RichText) {
                    $valor = $valor->getPlainText();
                }

                if ($formatear && $valor !== null && $valor !== '') {
                    $valor = NumberFormat::toFormattedString($valor, $celda->getStyle()->getNumberFormat()->getFormatCode());
                }

                if ($referencias) {
                    $valores[$celda->getColumn()] = $valor;
                } else {
                    $valores[] = $valor;
                }
            }

            if ($referencias) {
                $filas[$fila->getRowIndex()] = $valores;
            } else {
                $filas[] = $valores;
            }
        }

        return $filas;
    }
}
