<?php

namespace App\Exports\Seguridad;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

/**
 * Exporta el historial de condiciones de salud tal como se ve en pantalla:
 * una fila por colaborador y día, combinando ingreso y salida.
 *
 * @implements FromCollection<int, array<string, mixed>>
 */
class CondicionesSaludExport implements FromCollection, WithHeadings, WithMapping
{
    /**
     * @param  Collection<int, array<string, mixed>>  $filas
     */
    public function __construct(private readonly Collection $filas) {}

    public function collection(): Collection
    {
        return $this->filas;
    }

    /**
     * @return array<int, string>
     */
    public function headings(): array
    {
        return [
            'Fecha',
            'Colaborador',
            'Cédula',
            'Cargo',
            'Área',
            'Turno',
            'Hora ingreso',
            'Estado ingreso',
            'Observación ingreso',
            'Hora salida',
            'Estado salida',
            'Observación salida',
            'Firma colaborador',
            'Firma supervisor',
            'Firmado el',
        ];
    }

    /**
     * @param  array<string, mixed>  $fila
     * @return array<int, mixed>
     */
    public function map($fila): array
    {
        $turnos = ['manana' => 'Mañana', 'tarde' => 'Tarde', 'noche' => 'Noche'];
        $turno = $fila['colaborador']['turno'] ?? null;

        return [
            $fila['fecha'],
            trim(($fila['colaborador']['nombres'] ?? '').' '.($fila['colaborador']['apellidos'] ?? '')),
            $fila['colaborador']['cedula'] ?? null,
            $fila['colaborador']['cargo'] ?? '—',
            $fila['colaborador']['area'] ?? '—',
            $turno ? ($turnos[$turno] ?? $turno) : '—',
            $fila['hora_ingreso'] ?? '—',
            $fila['estado_ingreso'] ?? '—',
            $fila['observacion_ingreso'] ?? '—',
            $fila['hora_salida'] ?? '—',
            $fila['estado_salida'] ?? '—',
            $fila['observacion_salida'] ?? '—',
            $fila['firma_colaborador_url'] ? 'Sí' : 'No',
            $fila['firma_supervisor_url'] ? 'Sí' : 'No',
            $fila['firmado_en'] ? Carbon::parse($fila['firmado_en'])->format('d/m/Y H:i') : '—',
        ];
    }
}
