<?php

namespace App\Exports\Seguridad;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithDrawings;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Events\AfterSheet;
use Maatwebsite\Excel\Concerns\FromCollection;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

class PruebasExport implements FromCollection, WithColumnWidths, WithDrawings, WithEvents, WithHeadings, WithMapping
{
    private const FOTO_ROW_HEIGHT = 45;

    public function __construct(private readonly Collection $pruebas)
    {
    }

    public function collection(): Collection
    {
        return $this->pruebas;
    }

    public function headings(): array
    {
        return ['Fecha', 'Colaborador', 'Cédula', 'Tipo', 'Dispositivo', 'Resultado', 'Evaluación', 'Estado', 'Responsable', 'Firma', 'Evidencia principal'];
    }

    /**
     * @return array<int, mixed>
     */
    public function map($prueba): array
    {
        return [
            $prueba->fecha_hora ? $prueba->fecha_hora->format('d/m/Y H:i') : '—',
            $prueba->colaborador?->nombre_completo ?? '—',
            $prueba->colaborador?->cedula ?? '—',
            $prueba->tipoLabel(),
            $prueba->alcoholimetro?->codigo ?? '—',
            $prueba->resultado ?? '—',
            $prueba->estado === 'programada' ? '—' : $prueba->evaluacion(),
            ucfirst($prueba->estado),
            $prueba->responsable?->name ?? '—',
            $prueba->firma_path ? '' : '—',
            $prueba->evidenciaPrincipalPath() ? '' : '—',
        ];
    }

    public function columnWidths(): array
    {
        return ['J' => 18, 'K' => 18];
    }

    /**
     * @return Drawing[]
     */
    public function drawings(): array
    {
        $drawings = [];

        foreach ($this->pruebas->values() as $index => $prueba) {
            $fila = $index + 2;

            $this->agregarDrawing($drawings, $prueba->firma_path, "J{$fila}", 'Firma');
            $this->agregarDrawing($drawings, $prueba->evidenciaPrincipalPath(), "K{$fila}", 'Evidencia principal');
        }

        return $drawings;
    }

    /**
     * @param  Drawing[]  $drawings
     */
    private function agregarDrawing(array &$drawings, ?string $path, string $coordenadas, string $nombre): void
    {
        if (! $path || ! Storage::disk('public')->exists($path)) {
            return;
        }

        try {
            $fullPath = Storage::disk('public')->path($path);

            if (! file_exists($fullPath) || @filesize($fullPath) === 0 || ! @getimagesize($fullPath)) {
                return;
            }

            $drawing = new Drawing();
            $drawing->setName($nombre);
            $drawing->setPath($fullPath);
            $drawing->setHeight(self::FOTO_ROW_HEIGHT - 6);
            $drawing->setCoordinates($coordenadas);
            $drawing->setOffsetX(4);
            $drawing->setOffsetY(3);

            $drawings[] = $drawing;
        } catch (\Throwable $e) {
            // Ignorar imagen si el archivo está dañado para no fallar toda la exportación
        }
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                foreach ($this->pruebas->values() as $index => $prueba) {
                    if ($prueba->firma_path || $prueba->evidenciaPrincipalPath()) {
                        $event->sheet->getDelegate()->getRowDimension($index + 2)->setRowHeight(self::FOTO_ROW_HEIGHT);
                    }
                }
            },
        ];
    }
}
