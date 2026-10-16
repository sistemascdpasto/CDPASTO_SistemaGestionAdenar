<?php

namespace App\Exports\Flota;

use App\Models\Flota\Extintor;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class ExtintoresTablaExport implements FromArray, WithColumnWidths, WithEvents, WithTitle
{
    public function __construct(private readonly \Illuminate\Support\Collection $extintores) {}

    public function title(): string
    {
        return 'Extintores';
    }

    public function array(): array
    {
        // Fila de cabecera
        $filas = [[
            'N° Serie',
            'Condición',
            'Agente Extintor',
            'Agente Impulsor',
            'Última Recarga',
            'Parte Mantenimiento',
            'Señalización',
            'Demarcación',
            'Funcionamiento',
            'Acceso al Extintor',
            'Placa Actual',
            'Observaciones',
        ]];

        foreach ($this->extintores as $e) {
            $filas[] = [
                $e->numero_serie,
                $e->condicion         ?? '—',
                $e->tipo_agente       ?? '—',
                $e->agente_impulsor   ?? '—',
                $e->ultima_recarga
                    ? \Carbon\Carbon::parse($e->ultima_recarga)->format('d/m/Y')
                    : '—',
                $e->parte_mantenimiento ?? '—',
                $e->senalizacion        ?? '—',
                $e->demarcacion         ?? '—',
                $e->funcionamiento      ?? '—',
                $e->acceso              ?? '—',
                $e->placa_actual        ?? '—',
                $e->observaciones       ?? '',
            ];
        }

        return $filas;
    }

    public function columnWidths(): array
    {
        return [
            'A' => 16, 'B' => 12, 'C' => 18, 'D' => 14,
            'E' => 16, 'F' => 28, 'G' => 14, 'H' => 14,
            'I' => 16, 'J' => 18, 'K' => 14, 'L' => 30,
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet    = $event->sheet->getDelegate();
                $lastRow  = count($this->extintores) + 1; // +1 por cabecera
                $lastCol  = 'L';

                // ── Cabecera: azul claro, negrita, borde ──────────────────────
                $sheet->getStyle('A1:'.$lastCol.'1')->applyFromArray([
                    'font' => [
                        'bold' => true,
                        'size' => 10,
                        'color' => ['rgb' => '1F3864'],
                    ],
                    'fill' => [
                        'fillType'   => Fill::FILL_SOLID,
                        'startColor' => ['rgb' => 'BDD7EE'],
                    ],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical'   => Alignment::VERTICAL_CENTER,
                        'wrapText'   => true,
                    ],
                    'borders' => [
                        'allBorders' => ['borderStyle' => Border::BORDER_THIN],
                    ],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(20);

                // ── Filas de datos: borde y alineación ────────────────────────
                if ($lastRow > 1) {
                    $sheet->getStyle('A2:'.$lastCol.$lastRow)->applyFromArray([
                        'font'      => ['size' => 9],
                        'alignment' => [
                            'horizontal' => Alignment::HORIZONTAL_LEFT,
                            'vertical'   => Alignment::VERTICAL_CENTER,
                            'wrapText'   => true,
                        ],
                        'borders' => [
                            'allBorders' => ['borderStyle' => Border::BORDER_THIN],
                        ],
                    ]);

                    // Alternar color de filas para legibilidad
                    for ($r = 2; $r <= $lastRow; $r++) {
                        if ($r % 2 === 0) {
                            $sheet->getStyle('A'.$r.':'.$lastCol.$r)
                                ->getFill()->setFillType(Fill::FILL_SOLID)
                                ->getStartColor()->setRGB('F2F7FC');
                        }
                        $sheet->getRowDimension($r)->setRowHeight(14);
                    }
                }

                // ── Borde exterior ────────────────────────────────────────────
                $sheet->getStyle('A1:'.$lastCol.$lastRow)
                    ->getBorders()->getOutline()->setBorderStyle(Border::BORDER_MEDIUM);

                // ── Congelar cabecera ─────────────────────────────────────────
                $sheet->freezePane('A2');

                // ── Orientación apaisada ──────────────────────────────────────
                $sheet->getPageSetup()
                    ->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE)
                    ->setFitToPage(true)
                    ->setFitToWidth(1)
                    ->setFitToHeight(0);
            },
        ];
    }
}
