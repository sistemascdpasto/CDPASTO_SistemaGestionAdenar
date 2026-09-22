<?php

namespace App\Http\Controllers\Flota;

use App\Exports\Flota\DisponibilidadFlotaExport;
use App\Http\Controllers\Controller;
use App\Models\Flota\Carreta;
use App\Models\Flota\CarretaDisponibilidadHistorial;
use App\Models\Flota\Vehiculo;
use App\Models\Flota\VehiculoDisponibilidadHistorial;
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
     * Histórico día a día: para cada fecha del rango, reconstruye cuántos
     * vehículos/carretas estaban marcados "no disponible" ese día, a partir
     * del historial que deja el botón de disponible/no disponible (no hay
     * una foto guardada por día — se reconstruye sobre la marcha). "Asignada"
     * usa la flota/carretas registradas HOY como aproximación, ya que no se
     * lleva un histórico de altas/bajas de la flota en sí.
     */
    public function historico(Request $request): Response
    {
        $hasta = $request->input('hasta', now()->toDateString());
        $desde = $request->input('desde', now()->subDays(29)->toDateString());

        $hastaCarbon = Carbon::parse($hasta)->startOfDay();
        $desdeCarbon = Carbon::parse($desde)->startOfDay();

        $vehiculoIds = Vehiculo::pluck('id');
        $carretaIds = Carreta::pluck('id');
        $totalFlota = $vehiculoIds->count();
        $totalCarretas = $carretaIds->count();

        // Se filtra por las unidades que existen HOY (no soft-eliminadas) —
        // de lo contrario el historial de una unidad ya eliminada seguiría
        // contando como indisponible en el histórico.
        $historialFlota = VehiculoDisponibilidadHistorial::whereIn('vehiculo_id', $vehiculoIds)
            ->whereDate('created_at', '<=', $hastaCarbon)
            ->orderBy('created_at')
            ->get(['vehiculo_id', 'disponible', 'created_at']);

        $historialCarretas = CarretaDisponibilidadHistorial::whereIn('carreta_id', $carretaIds)
            ->whereDate('created_at', '<=', $hastaCarbon)
            ->orderBy('created_at')
            ->get(['carreta_id', 'disponible', 'created_at']);

        $dias = [];
        $cursor = $desdeCarbon->copy();

        while ($cursor->lte($hastaCarbon)) {
            $cursorFecha = $cursor->toDateString();

            $dias[] = [
                'fecha' => $cursorFecha,
                'fechaCorta' => $cursor->format('d/m'),
                'flota' => $this->resumen($totalFlota, $this->contarIndisponiblesEnFecha($historialFlota, 'vehiculo_id', $cursorFecha)),
                'carretas' => $this->resumen($totalCarretas, $this->contarIndisponiblesEnFecha($historialCarretas, 'carreta_id', $cursorFecha)),
            ];

            $cursor->addDay();
        }

        return Inertia::render('flota/disponibilidad/historico', [
            'filtros' => compact('desde', 'hasta'),
            'dias' => $dias,
        ]);
    }

    /**
     * Cuenta cuántas unidades (agrupadas por $idField) tenían su último
     * evento de historial <= $fecha con disponible = false.
     */
    private function contarIndisponiblesEnFecha(Collection $historial, string $idField, string $fecha): int
    {
        return $historial
            ->filter(fn ($h) => $h->created_at->toDateString() <= $fecha)
            ->groupBy($idField)
            ->filter(fn (Collection $eventos) => ! $eventos->last()->disponible)
            ->count();
    }

    /**
     * Cruza vehículos y carretas contra su historial de disponibilidad para
     * determinar cuáles estaban marcados "no disponible" en la fecha dada
     * (el último evento <= fecha define el estado; sin eventos, el estado
     * por defecto es disponible).
     *
     * @return array{0: array<string, int|float>, 1: array<string, int|float>, 2: Collection}
     */
    private function calcular(string $fecha): array
    {
        $fechaCarbon = Carbon::parse($fecha)->startOfDay();

        $vehiculos = Vehiculo::all(['id', 'placa']);
        $carretas = Carreta::all(['id', 'identificacion']);

        $historialFlota = VehiculoDisponibilidadHistorial::whereIn('vehiculo_id', $vehiculos->pluck('id'))
            ->whereDate('created_at', '<=', $fechaCarbon)
            ->with('user:id,name')
            ->orderBy('created_at')
            ->get();

        $historialCarretas = CarretaDisponibilidadHistorial::whereIn('carreta_id', $carretas->pluck('id'))
            ->whereDate('created_at', '<=', $fechaCarbon)
            ->with('user:id,name')
            ->orderBy('created_at')
            ->get();

        $tablaFlota = $this->noDisponiblesEnFecha($vehiculos, $historialFlota, 'vehiculo_id', 'placa');
        $tablaCarretas = $this->noDisponiblesEnFecha($carretas, $historialCarretas, 'carreta_id', 'identificacion');

        $resumenFlota = $this->resumen($vehiculos->count(), $tablaFlota->count());
        $resumenCarretas = $this->resumen($carretas->count(), $tablaCarretas->count());

        return [$resumenFlota, $resumenCarretas, $tablaFlota->merge($tablaCarretas)->values()];
    }

    /**
     * @param  Collection<int, Vehiculo|Carreta>  $unidades
     * @param  Collection<int, VehiculoDisponibilidadHistorial|CarretaDisponibilidadHistorial>  $historial  eventos <= fecha, ordenados por created_at, de esas unidades
     */
    private function noDisponiblesEnFecha(Collection $unidades, Collection $historial, string $idField, string $labelField): Collection
    {
        $porUnidad = $historial->groupBy($idField);

        return $unidades
            ->map(function ($unidad) use ($porUnidad, $labelField) {
                $ultimo = $porUnidad->get($unidad->id)?->last();

                if (! $ultimo || $ultimo->disponible) {
                    return null;
                }

                return [
                    'placa' => $unidad->{$labelField},
                    'novedad' => $ultimo->novedad ?: '—',
                    'fecha' => $ultimo->created_at->format('d/m/Y H:i'),
                    'usuario' => $ultimo->user?->name ?? '—',
                ];
            })
            ->filter()
            ->values();
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
