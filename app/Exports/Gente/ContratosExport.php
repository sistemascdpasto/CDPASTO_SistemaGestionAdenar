<?php

namespace App\Exports\Gente;

use App\Models\Gente\ContratoProrroga;
use App\Models\Seguridad\Colaborador;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithCustomStartCell;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Events\AfterSheet;
use Maatwebsite\Excel\Events\BeforeSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class ContratosExport implements FromCollection, WithColumnWidths, WithCustomStartCell, WithEvents, WithMapping
{
    private const DATOS_PERSONALES = [
        ['label' => 'CÉDULA', 'width' => 16],
        ['label' => 'NOMBRE', 'width' => 32],
        ['label' => 'CARGO', 'width' => 30],
        ['label' => 'TIPO DE CONTRATO', 'width' => 24],
        ['label' => 'ESTADO', 'width' => 18],
    ];

    private const COLORES_PRORROGA = [
        ['grupo' => 'FFF2CC', 'fila' => 'FFFAE6'],
        ['grupo' => 'D9EAD3', 'fila' => 'EFF7EC'],
        ['grupo' => 'D9EAF7', 'fila' => 'EDF5FB'],
        ['grupo' => 'FCE4D6', 'fila' => 'FDF1EA'],
        ['grupo' => 'E4DFEC', 'fila' => 'F2EFF6'],
        ['grupo' => 'F4CCCC', 'fila' => 'FCEBEB'],
    ];

    // Fondo rojo claro para filas en alerta (≤ 35 días para vencer o ya vencidas)
    private const COLOR_ALERTA_FILA  = 'FFFFE0E0'; // rojo muy claro
    private const COLOR_ALERTA_TEXTO = 'FF9B1C1C'; // rojo oscuro para el texto

    private int $cantidadProrrogas;

    /** Números de fila (base 1, donde fila 3 = primer colaborador) que deben resaltarse en rojo. */
    private array $filasEnAlerta = [];

    /** Contador interno para saber en qué fila del sheet va el map(). */
    private int $filaActual = 3;

    /**
     * @param  Collection<int, Colaborador>  $colaboradores
     */
    public function __construct(private readonly Collection $colaboradores)
    {
        $this->cantidadProrrogas = (int) $colaboradores
            ->max(fn (Colaborador $colaborador) => $colaborador->prorrogas->count());
    }

    public function collection(): Collection
    {
        return $this->colaboradores;
    }

    public function startCell(): string
    {
        return 'A3';
    }

    /**
     * @return array<int, array<int, string>>
     */
    public function headings(): array
    {
        $grupos = ['DATOS DEL COLABORADOR', '', '', '', ''];
        $subtitulos = array_column(self::DATOS_PERSONALES, 'label');

        array_push($grupos, 'INICIAL', '', '');
        array_push($subtitulos, 'CONTRATO', 'TERMINACIÓN', 'PREAVISO');

        for ($indice = 1; $indice <= $this->cantidadProrrogas; $indice++) {
            array_push($grupos, $this->tituloProrroga($indice), '', '');
            array_push($subtitulos, 'CONTRATO', 'TERMINACIÓN', 'PREAVISO');
        }

        return [$grupos, $subtitulos];
    }

    /**
     * @param  Colaborador  $colaborador
     * @return array<int, mixed>
     */
    public function map($colaborador): array
    {
        // Detectar si este colaborador está en el umbral de alerta (≤ 35 días
        // para vencer o ya vencido) y no tiene finalización confirmada.
        if (! $colaborador->tiene_finalizacion) {
            $fechaVigente = $colaborador->ultima_fecha_prorroga
                ? Carbon::parse($colaborador->ultima_fecha_prorroga)
                : $colaborador->fecha_retiro_empresa;

            if ($fechaVigente) {
                $diasRestantes = (int) today()->diffInDays($fechaVigente, false);
                $diasUmbral = (int) config('seguridad.dias_alerta_vencimiento_contrato', 35);

                if ($diasRestantes <= $diasUmbral) {
                    $this->filasEnAlerta[] = $this->filaActual;
                }
            }
        }

        $this->filaActual++;

        $prorrogas = $colaborador->prorrogas;
        $fechaTerminacionInicial = $prorrogas->first()?->fecha_anterior ?? $colaborador->fecha_retiro_empresa;
        $fila = [
            $colaborador->cedula,
            trim("{$colaborador->nombres} {$colaborador->apellidos}"),
            $colaborador->cargo,
            $colaborador->tipo_contrato,
            $this->estadoContrato($colaborador),
            $this->formatearFecha($colaborador->fecha_ingreso_empresa),
            $this->formatearFecha($fechaTerminacionInicial),
            $this->tienePreaviso($colaborador, $fechaTerminacionInicial) ? 'SÍ' : 'NO',
        ];

        /** @var ContratoProrroga $prorroga */
        foreach ($prorrogas as $prorroga) {
            $fechaFin = $prorroga->fecha_nueva;
            $fila[] = $this->formatearFecha($prorroga->fechaInicioEfectiva());
            $fila[] = $this->formatearFecha($fechaFin);
            $fila[] = $this->tienePreaviso($colaborador, $fechaFin) ? 'SÍ' : 'NO';
        }

        while (count($fila) < count(self::DATOS_PERSONALES) + 3 * (1 + $this->cantidadProrrogas)) {
            $fila[] = null;
        }

        return $fila;
    }

    /**
     * @return array<string, float>
     */
    public function columnWidths(): array
    {
        $widths = [];

        foreach (self::DATOS_PERSONALES as $indice => $dato) {
            $widths[Coordinate::stringFromColumnIndex($indice + 1)] = $dato['width'];
        }

        $column = count(self::DATOS_PERSONALES) + 1;
        for ($periodo = 0; $periodo <= $this->cantidadProrrogas; $periodo++) {
            foreach ([18, 18, 14] as $width) {
                $widths[Coordinate::stringFromColumnIndex($column++)] = $width;
            }
        }

        return $widths;
    }

    /**
     * @return array<class-string, \Closure>
     */
    public function registerEvents(): array
    {
        return [
            BeforeSheet::class => function (BeforeSheet $event): void {
                $event->sheet->getDelegate()->fromArray($this->headings(), null, 'A1');
            },
            AfterSheet::class => function (AfterSheet $event): void {
                $sheet = $event->sheet->getDelegate();
                $lastColumn = Coordinate::stringFromColumnIndex(count(self::DATOS_PERSONALES) + 3 * (1 + $this->cantidadProrrogas));

                $sheet->mergeCells('A1:E1');

                $inicioInicial = count(self::DATOS_PERSONALES) + 1;
                $sheet->mergeCells(
                    Coordinate::stringFromColumnIndex($inicioInicial).'1:'.Coordinate::stringFromColumnIndex($inicioInicial + 2).'1',
                );

                for ($indice = 1; $indice <= $this->cantidadProrrogas; $indice++) {
                    $inicioGrupo = count(self::DATOS_PERSONALES) + 1 + ($indice * 3);
                    $sheet->mergeCells(
                        Coordinate::stringFromColumnIndex($inicioGrupo).'1:'.Coordinate::stringFromColumnIndex($inicioGrupo + 2).'1',
                    );
                }

                $sheet->getStyle("A1:{$lastColumn}2")->getAlignment()->applyFromArray([
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical' => Alignment::VERTICAL_CENTER,
                    'wrapText' => true,
                ]);
                $sheet->getStyle("A1:{$lastColumn}2")->getFont()->setBold(true);
                $sheet->getStyle("A1:{$lastColumn}2")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
                $ultimaFila = $sheet->getHighestRow();

                $sheet->getStyle('A1:'.Coordinate::stringFromColumnIndex($inicioInicial + 2).'2')
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF0B5394');
                $sheet->getStyle('A1:'.Coordinate::stringFromColumnIndex($inicioInicial + 2).'2')
                    ->getFont()->getColor()->setARGB('FFFFFFFF');

                if ($ultimaFila >= 3) {
                    $rangoDatosInicial = Coordinate::stringFromColumnIndex($inicioInicial).'3:'
                        .Coordinate::stringFromColumnIndex($inicioInicial + 2).$ultimaFila;
                    $sheet->getStyle($rangoDatosInicial)
                        ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFEDF5FB');

                    for ($indice = 1; $indice <= $this->cantidadProrrogas; $indice++) {
                        $inicioGrupo = count(self::DATOS_PERSONALES) + 1 + ($indice * 3);
                        $finGrupo = $inicioGrupo + 2;
                        $color = self::COLORES_PRORROGA[($indice - 1) % count(self::COLORES_PRORROGA)];
                        $rangoGrupo = Coordinate::stringFromColumnIndex($inicioGrupo).'1:'.Coordinate::stringFromColumnIndex($finGrupo).'2';
                        $sheet->getStyle($rangoGrupo)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF'.$color['grupo']);
                        $sheet->getStyle($rangoGrupo)->getFont()->getColor()->setARGB('FF1F2937');

                        $rangoDatos = Coordinate::stringFromColumnIndex($inicioGrupo).'3:'.Coordinate::stringFromColumnIndex($finGrupo).$ultimaFila;
                        $sheet->getStyle($rangoDatos)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF'.$color['fila']);
                    }

                    $sheet->getStyle('A3:'.$lastColumn.$ultimaFila)
                        ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_HAIR);
                }

                // Resaltar en rojo las filas cuyo contrato vence en ≤ 35 días
                // o ya venció. Se aplica al final para sobreescribir los colores
                // de prórroga sin afectar los encabezados.
                foreach ($this->filasEnAlerta as $fila) {
                    $rangoFila = 'A'.$fila.':'.$lastColumn.$fila;
                    $sheet->getStyle($rangoFila)
                        ->getFill()
                        ->setFillType(Fill::FILL_SOLID)
                        ->getStartColor()
                        ->setARGB(self::COLOR_ALERTA_FILA);
                    $sheet->getStyle($rangoFila)
                        ->getFont()
                        ->getColor()
                        ->setARGB(self::COLOR_ALERTA_TEXTO);
                    $sheet->getStyle($rangoFila)
                        ->getFont()
                        ->setBold(true);
                }

                $sheet->getRowDimension(1)->setRowHeight(23);
                $sheet->getRowDimension(2)->setRowHeight(22);
                $sheet->freezePane(Coordinate::stringFromColumnIndex(count(self::DATOS_PERSONALES) + 1).'3');
            },
        ];
    }

    private function tituloProrroga(int $indice): string
    {
        return ContratoProrroga::esProrrogaAnual($indice)
            ? 'PRÓRROGA ANUAL '.($indice - ContratoProrroga::MAX_PRORROGAS_INICIALES)
            : 'PRÓRROGA '.$indice;
    }

    private function estadoContrato(Colaborador $colaborador): string
    {
        if ($colaborador->tiene_finalizacion) {
            return 'FINALIZADO';
        }

        // Usar la fecha vigente real: última prórroga si existe, o contrato base.
        // Misma lógica que la pantalla (fecha_vencimiento_vigente) y el comando
        // de correos (RevisarVencimientoContratos).
        $fechaVigente = $colaborador->ultima_fecha_prorroga
            ? Carbon::parse($colaborador->ultima_fecha_prorroga)
            : $colaborador->fecha_retiro_empresa;

        if (! $fechaVigente) {
            return 'SIN FECHA FIN';
        }

        return $fechaVigente->isBefore(today()) ? 'VENCIDO' : 'VIGENTE';
    }

    private function tienePreaviso(Colaborador $colaborador, mixed $fechaTerminacion): bool
    {
        if (! $fechaTerminacion) {
            return false;
        }

        $fecha = Carbon::parse($fechaTerminacion)->toDateString();

        return $colaborador->documentos->contains(
            fn ($documento) => $documento->campo === 'documento_preaviso_terminacion'
                && $documento->fecha_documento?->toDateString() === $fecha
                && $documento->path
                && Storage::disk('public')->exists($documento->path),
        );
    }

    private function formatearFecha(mixed $fecha): ?string
    {
        if (! $fecha) {
            return null;
        }

        return Carbon::parse($fecha)->format('d/m/Y');
    }
}
