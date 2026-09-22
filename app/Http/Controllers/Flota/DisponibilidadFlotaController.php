<?php

namespace App\Http\Controllers\Flota;

use App\Exports\Flota\DisponibilidadFlotaExport;
use App\Http\Controllers\Controller;
use App\Models\Flota\ActaTaller;
use App\Models\Flota\Carreta;
use App\Models\Flota\Vehiculo;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;

class DisponibilidadFlotaController extends Controller
{
    public function index(Request $request): Response
    {
        $fecha = $request->input('fecha', now()->toDateString());
        [$resumenFlota, $resumenCarretas, $tabla] = $this->calcular($fecha);

        return Inertia::render('flota/disponibilidad/index', [
            'fecha' => $fecha,
            'fechaFormateada' => Carbon::parse($fecha)->translatedFormat('d/m/Y'),
            'esHoy' => Carbon::parse($fecha)->isToday(),
            'resumenFlota' => $resumenFlota,
            'resumenCarretas' => $resumenCarretas,
            'tabla' => $tabla,
        ]);
    }

    public function exportarExcel(Request $request)
    {
        $fecha = $request->input('fecha', now()->toDateString());
        [$resumenFlota, $resumenCarretas, $tabla] = $this->calcular($fecha);

        return Excel::download(
            new DisponibilidadFlotaExport($fecha, $resumenFlota, $resumenCarretas, $tabla),
            'disponibilidad-flota-'.$fecha.'.xlsx',
        );
    }

    /**
     * Histórico día a día: para cada fecha del rango, recalcula la
     * disponibilidad de ese día a partir de cuándo estuvo abierta cada Acta
     * de Taller (no hay una foto guardada por día — se reconstruye sobre la
     * marcha). "Asignada" usa la flota/carretas activas de HOY como
     * aproximación, ya que no se lleva un histórico de altas/bajas de la
     * flota en sí.
     */
    public function historico(Request $request): Response
    {
        $hasta = $request->input('hasta', now()->toDateString());
        $desde = $request->input('desde', now()->subDays(29)->toDateString());

        $hastaCarbon = Carbon::parse($hasta)->startOfDay();
        $desdeCarbon = Carbon::parse($desde)->startOfDay();

        $placasFlota = Vehiculo::where('is_active', true)->pluck('placa');
        $identificacionesCarretas = Carreta::where('is_active', true)->pluck('identificacion');

        $actas = ActaTaller::where('estado_acta', '!=', ActaTaller::ESTADO_CANCELADA)
            ->whereIn('placa', $placasFlota->merge($identificacionesCarretas))
            ->whereDate('fecha_entrega', '<=', $hastaCarbon)
            ->where(function ($q) use ($desdeCarbon) {
                $q->whereNull('fecha_cierre')->orWhereDate('fecha_cierre', '>=', $desdeCarbon);
            })
            ->get(['placa', 'fecha_entrega', 'fecha_cierre', 'estado_acta', 'updated_at']);

        $dias = [];
        $cursor = $desdeCarbon->copy();

        while ($cursor->lte($hastaCarbon)) {
            $cursorFecha = $cursor->toDateString();

            $abiertasEseDia = $actas->filter(function (ActaTaller $acta) use ($cursorFecha) {
                $entrega = $acta->fecha_entrega?->toDateString();
                if (! $entrega || $entrega > $cursorFecha) {
                    return false;
                }

                return $this->siguioAbiertaEn($acta, $cursorFecha);
            });

            $flotaEnTaller = $abiertasEseDia->whereIn('placa', $placasFlota)->pluck('placa')->unique();
            $carretasEnTaller = $abiertasEseDia->whereIn('placa', $identificacionesCarretas)->pluck('placa')->unique();

            $dias[] = [
                'fecha' => $cursorFecha,
                'fechaCorta' => $cursor->format('d/m'),
                'flota' => $this->resumen($placasFlota->count(), $flotaEnTaller->count()),
                'carretas' => $this->resumen($identificacionesCarretas->count(), $carretasEnTaller->count()),
            ];

            $cursor->addDay();
        }

        return Inertia::render('flota/disponibilidad/historico', [
            'filtros' => compact('desde', 'hasta'),
            'dias' => $dias,
        ]);
    }

    /**
     * Cruza vehículos y carretas activos contra las Actas de Taller que
     * estuvieron abiertas en la fecha dada para calcular los conteos de
     * disponibilidad y la tabla de "en taller" del reporte de ese día. Un
     * vehículo/carreta cuenta como indisponible si tiene un acta abierta
     * (no cancelada, con fecha_entrega <= fecha y fecha_cierre nula o
     * posterior a la fecha) — para "hoy" equivale a estado_acta=en_taller.
     *
     * @return array{0: array<string, int|float>, 1: array<string, int|float>, 2: Collection}
     */
    private function calcular(string $fecha): array
    {
        $fechaCarbon = Carbon::parse($fecha)->startOfDay();

        $placasFlota = Vehiculo::where('is_active', true)->pluck('placa');
        $identificacionesCarretas = Carreta::where('is_active', true)->pluck('identificacion');

        $fechaString = $fechaCarbon->toDateString();

        $actasAbiertas = ActaTaller::where('estado_acta', '!=', ActaTaller::ESTADO_CANCELADA)
            ->whereIn('placa', $placasFlota->merge($identificacionesCarretas))
            ->whereDate('fecha_entrega', '<=', $fechaCarbon)
            ->with('novedades')
            ->orderBy('fecha_entrega')
            ->get()
            ->filter(fn (ActaTaller $acta) => $this->siguioAbiertaEn($acta, $fechaString));

        $flotaEnTaller = $actasAbiertas->whereIn('placa', $placasFlota)->pluck('placa')->unique();
        $carretasEnTaller = $actasAbiertas->whereIn('placa', $identificacionesCarretas)->pluck('placa')->unique();

        $resumenFlota = $this->resumen($placasFlota->count(), $flotaEnTaller->count());
        $resumenCarretas = $this->resumen($identificacionesCarretas->count(), $carretasEnTaller->count());

        $tabla = $actasAbiertas->map(fn (ActaTaller $acta) => [
            'placa' => $acta->placa,
            'fecha_ingreso' => $acta->fecha_entrega?->format('d/m/Y'),
            'novedades' => $acta->novedades->pluck('titulo')->filter()->implode(', ') ?: ($acta->motivo_ingreso ?? '—'),
            'entrega_estimada' => $acta->fecha_estimada_solucion?->format('d/m/Y') ?? '—',
            'dias_en_taller' => $acta->fecha_entrega ? (int) $acta->fecha_entrega->diffInDays($fechaCarbon) : null,
            'taller' => $acta->taller ?? '—',
        ])->values();

        return [$resumenFlota, $resumenCarretas, $tabla];
    }

    /**
     * Determina si el acta seguía abierta (ocupando el vehículo/carreta) en
     * la fecha dada. Usa fecha_cierre cuando está registrada; si el acta ya
     * no está en_taller pero fecha_cierre quedó vacía (formulario permitía
     * cerrar sin esa fecha — ver ActaTallerController::update()), usa
     * updated_at como aproximación de cuándo se cerró, en vez de contarla
     * como abierta indefinidamente.
     */
    private function siguioAbiertaEn(ActaTaller $acta, string $fecha): bool
    {
        if ($acta->fecha_cierre) {
            return $acta->fecha_cierre->toDateString() > $fecha;
        }

        if ($acta->estado_acta !== ActaTaller::ESTADO_EN_TALLER) {
            return $acta->updated_at->toDateString() > $fecha;
        }

        return true;
    }

    /**
     * @return array{asignada: int, indisponible: int, disponible: int, porcentaje: float}
     */
    private function resumen(int $asignada, int $indisponible): array
    {
        $disponible = $asignada - $indisponible;
        $porcentaje = $asignada > 0 ? round($disponible / $asignada * 100, 1) : 0.0;

        return [
            'asignada' => $asignada,
            'indisponible' => $indisponible,
            'disponible' => $disponible,
            'porcentaje' => $porcentaje,
        ];
    }
}
