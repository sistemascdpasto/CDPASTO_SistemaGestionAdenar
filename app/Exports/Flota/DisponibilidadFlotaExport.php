<?php

namespace App\Exports\Flota;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class DisponibilidadFlotaExport implements FromArray, WithColumnWidths, WithEvents
{
    private const FILA_TITULO = 1;

    private const FILA_FECHA = 2;

    private const FILA_BLOQUE_INICIO = 4;

    private const FILA_PORCENTAJE = 7;

    private const FILA_TABLA_HEADER = 9;

    /**
     * @param  array{asignada: int, indisponible: int, disponible: int, porcentaje: float}  $resumenFlota
     * @param  array{asignada: int, indisponible: int, disponible: int, porcentaje: float}  $resumenCarretas
     */
    public function __construct(
        private readonly string $fecha,
        private readonly array $resumenFlota,
        private readonly array $resumenCarretas,
        private readonly Collection $tabla,
    ) {}

    public function array(): array
    {
        $filas = [
            ['REPORTE DE DISPONIBILIDAD DE FLOTA ADENAR - CD PASTO'],
            ['Fecha: '.Carbon::parse($this->fecha)->translatedFormat('d/m/Y')],
            [],
            ['FLOTA ASIGNADA', $this->resumenFlota['asignada'], null, 'CARRETAS ASIGNADAS', $this->resumenCarretas['asignada']],
            ['FLOTA INDISPONIBLE', $this->resumenFlota['indisponible'], null, 'CARRETAS INDISPONIBLE', $this->resumenCarretas['indisponible']],
            ['FLOTA DISPONIBLE', $this->resumenFlota['disponible'], null, 'CARRETAS DISPONIBLE', $this->resumenCarretas['disponible']],
            [$this->resumenFlota['porcentaje'].'%', null, null, $this->resumenCarretas['porcentaje'].'%'],
            [],
            ['PLACA', 'NOVEDAD', 'FECHA', 'MARCADO POR'],
        ];

        foreach ($this->tabla as $fila) {
            $filas[] = [
                $fila['placa'],
                $fila['novedad'],
                $fila['fecha'],
                $fila['usuario'],
            ];
        }

        return $filas;
    }

    public function columnWidths(): array
    {
        return [
            'A' => 16, 'B' => 40, 'C' => 18, 'D' => 22, 'E' => 16,
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();

                $sheet->mergeCells('A'.self::FILA_TITULO.':E'.self::FILA_TITULO);
                $sheet->getStyle('A'.self::FILA_TITULO)->getFont()->setBold(true)->setSize(14);
                $sheet->getStyle('A'.self::FILA_TITULO)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A'.self::FILA_TITULO)->getFill()
                    ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('C6D9B0');

                $sheet->mergeCells('A'.self::FILA_FECHA.':E'.self::FILA_FECHA);
                $sheet->getStyle('A'.self::FILA_FECHA)->getFont()->setBold(true);

                // Etiquetas de contadores en negrita.
                foreach ([4, 5, 6] as $fila) {
                    $sheet->getStyle('A'.$fila)->getFont()->setBold(true);
                    $sheet->getStyle('D'.$fila)->getFont()->setBold(true);
                    $sheet->getStyle('B'.$fila)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle('E'.$fila)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                }

                // Celda grande de % con relleno condicional (sustituye a la dona).
                $sheet->mergeCells('A'.self::FILA_PORCENTAJE.':B'.self::FILA_PORCENTAJE);
                $sheet->mergeCells('D'.self::FILA_PORCENTAJE.':E'.self::FILA_PORCENTAJE);
                foreach (['A', 'D'] as $col) {
                    $pct = $col === 'A' ? $this->resumenFlota['porcentaje'] : $this->resumenCarretas['porcentaje'];
                    $sheet->getStyle($col.self::FILA_PORCENTAJE)->getFont()->setBold(true)->setSize(20);
                    $sheet->getStyle($col.self::FILA_PORCENTAJE)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle($col.self::FILA_PORCENTAJE)->getFill()
                        ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($this->colorPorcentaje($pct));
                }

                // Encabezado de la tabla de no disponibles.
                $sheet->getStyle('A'.self::FILA_TABLA_HEADER.':D'.self::FILA_TABLA_HEADER)
                    ->getFont()->setBold(true);
                $sheet->getStyle('A'.self::FILA_TABLA_HEADER.':D'.self::FILA_TABLA_HEADER)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('C6D9B0');

                $ultimaFila = self::FILA_TABLA_HEADER + $this->tabla->count();
                if ($ultimaFila >= self::FILA_TABLA_HEADER) {
                    $sheet->getStyle('A'.self::FILA_TABLA_HEADER.':D'.$ultimaFila)
                        ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
                }
            },
        ];
    }

    private function colorPorcentaje(float $pct): string
    {
        return match (true) {
            $pct >= 90 => 'C6E0B4',
            $pct >= 70 => 'FFE699',
            default => 'F8CBAD',
        };
    }
}
