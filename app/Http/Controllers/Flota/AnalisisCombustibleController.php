<?php

namespace App\Http\Controllers\Flota;

use App\Http\Controllers\Controller;
use App\Models\Flota\VehiculoKilometroDiario;
use App\Services\Flota\MygeotabKilometrosSyncService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Primer entregable del análisis de combustible: por ahora solo muestra los
 * kilómetros diarios sincronizados desde MyGeotab, agregados por placa, con
 * un botón de respaldo para sincronizar un día manualmente (la vía principal
 * es la tarea programada en la PC local que llama a
 * POST /api/mygeotab/sincronizar-km — ver memoria del proyecto sobre el
 * scheduler/queue de Railway). El cruce con vouchers de combustible y con la
 * ruta de Modulación se agrega en un incremento posterior.
 */
class AnalisisCombustibleController extends Controller
{
    public function index(Request $request): Response
    {
        $desde = $request->input('desde', now()->startOfMonth()->toDateString());
        $hasta = $request->input('hasta', now()->toDateString());

        $porPlaca = VehiculoKilometroDiario::query()
            ->whereDate('fecha', '>=', $desde)
            ->whereDate('fecha', '<=', $hasta)
            ->get()
            ->groupBy('placa')
            ->map(fn ($grupo, $placa) => [
                'placa' => $placa,
                'km_total' => round($grupo->sum('distancia_km'), 1),
                'dias_con_datos' => $grupo->count(),
            ])
            ->sortByDesc('km_total')
            ->values();

        return Inertia::render('flota/combustible/index', [
            'por_placa' => $porPlaca,
            'filters' => compact('desde', 'hasta'),
        ]);
    }

    /**
     * Botón "Sincronizar ahora" — respaldo manual si la tarea programada
     * local falló un día, o para backfill de un día específico.
     */
    public function sincronizar(Request $request, MygeotabKilometrosSyncService $servicio): RedirectResponse
    {
        $validado = $request->validate([
            'fecha' => ['required', 'date_format:Y-m-d'],
        ]);

        try {
            $resumen = $servicio->sincronizarDia(Carbon::createFromFormat('Y-m-d', $validado['fecha'], config('app.timezone')));
        } catch (\Throwable $e) {
            return back()->with('status', [
                'type' => 'error',
                'message' => 'No se pudo sincronizar con MyGeotab: '.$e->getMessage(),
            ]);
        }

        return back()->with('status', [
            'type' => 'success',
            'message' => "Sincronizados {$resumen['vehiculos_actualizados']} vehículos ({$resumen['viajes_procesados']} viajes procesados).",
        ]);
    }
}
