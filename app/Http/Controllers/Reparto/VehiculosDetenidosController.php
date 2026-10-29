<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Models\Flota\VehiculoEstadoMygeotab;
use App\Models\Reparto\ModulacionItem;
use App\Services\Flota\VehiculoDetenidoDetector;
use App\Support\Distancia;
use App\Support\ModulacionRuta;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Lee de vehiculo_estado_mygeotab (no llama a MyGeotab en cada carga de
 * página — eso lo hace el comando programado cada 5 min, ver
 * App\Console\Commands\DetectarVehiculosDetenidos). Muestra TODOS los
 * vehículos detenidos, sin los 3 filtros de horario/ruta/bodega que el
 * comando sí aplica para decidir si manda correo — esos solo deciden si
 * se notifica, no si se muestra aquí.
 */
class VehiculosDetenidosController extends Controller
{
    private const BODEGA_LATITUD = 1.153695;

    private const BODEGA_LONGITUD = -77.305209;

    private const BODEGA_RADIO_METROS = 300;

    public function index(): Response
    {
        $rutasHoy = ModulacionItem::with('modulacion')
            ->whereHas('modulacion', fn ($q) => $q->whereDate('fecha', now()->toDateString()))
            ->get()
            ->keyBy(fn (ModulacionItem $item) => strtoupper(trim($item->placa)));

        $vehiculos = VehiculoEstadoMygeotab::query()
            ->where('detenido', true)
            ->orderBy('detenido_desde')
            ->get()
            ->map(function (VehiculoEstadoMygeotab $v) use ($rutasHoy) {
                $ruta = $rutasHoy->get($v->placa);
                $enBodega = $v->latitud !== null && $v->longitud !== null
                    && Distancia::metros((float) $v->latitud, (float) $v->longitud, self::BODEGA_LATITUD, self::BODEGA_LONGITUD) <= self::BODEGA_RADIO_METROS;

                return [
                    'placa' => $v->placa,
                    'minutos_detenido' => $v->detenido_desde ? (int) round($v->detenido_desde->diffInMinutes(now())) : null,
                    'detenido_desde' => $v->detenido_desde?->format('H:i'),
                    'latitud' => $v->latitud ? (float) $v->latitud : null,
                    'longitud' => $v->longitud ? (float) $v->longitud : null,
                    'ultima_posicion_en' => $v->ultima_posicion_en?->format('H:i'),
                    'conductor' => $ruta?->nombres,
                    'ruta' => $ruta ? ModulacionRuta::resumen($ruta->viajes) : null,
                    'en_bodega' => $enBodega,
                ];
            })
            ->values();

        return Inertia::render('reparto/vehiculos-detenidos/index', [
            'vehiculos' => $vehiculos,
            'kpis' => [
                'total_detenidos' => $vehiculos->count(),
                'detenidos_30_mas' => $vehiculos->filter(fn ($v) => $v['minutos_detenido'] !== null && $v['minutos_detenido'] >= 30)->count(),
                'en_bodega' => $vehiculos->filter(fn ($v) => $v['en_bodega'])->count(),
            ],
        ]);
    }

    /**
     * Botón "Actualizar ahora" — igual criterio que el de Análisis de
     * Combustible: nada de colas, el detector es rápido.
     */
    public function actualizar(VehiculoDetenidoDetector $detector): RedirectResponse
    {
        try {
            $detector->actualizarEstados();
        } catch (\Throwable $e) {
            return back()->with('status', ['type' => 'error', 'message' => 'No se pudo actualizar: '.$e->getMessage()]);
        }

        return back()->with('status', ['type' => 'success', 'message' => 'Estado actualizado.']);
    }
}
