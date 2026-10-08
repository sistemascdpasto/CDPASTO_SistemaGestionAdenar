<?php

namespace App\Http\Controllers\Flota;

use App\Http\Controllers\Controller;
use App\Models\Flota\Vehiculo;
use App\Models\Reparto\ModulacionItem;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class OcupacionCargaController extends Controller
{
    /**
     * Suma el "peso" (toneladas, texto libre sin formato forzado) de todos
     * los viajes de una ruta/día, tolerando coma o punto como separador
     * decimal y descartando valores no numéricos.
     */
    private function sumarPesoToneladas(?array $viajes): float
    {
        if (empty($viajes)) {
            return 0.0;
        }

        return collect($viajes)->sum(function ($viaje) {
            $peso = trim((string) ($viaje['peso'] ?? ''));
            if ($peso === '' || ! is_numeric(str_replace(',', '.', $peso))) {
                return 0.0;
            }

            return (float) str_replace(',', '.', $peso);
        });
    }

    public function index(Request $request): Response
    {
        $desde = $request->input('desde', now()->startOfMonth()->toDateString());
        $hasta = $request->input('hasta', now()->toDateString());
        $placa = trim((string) $request->input('placa', ''));

        $items = ModulacionItem::with('modulacion')
            ->whereHas('modulacion', function ($query) use ($desde, $hasta) {
                $query->whereDate('fecha', '>=', $desde)
                    ->whereDate('fecha', '<=', $hasta);
            })
            ->whereNotNull('placa')
            ->where('placa', '!=', '')
            ->when($placa !== '', fn ($query) => $query->where('placa', 'like', "%{$placa}%"))
            ->get();

        // Un solo lookup de vehículos por placa (normalizada) en vez de una
        // consulta por fila — las placas se comparan en mayúsculas/trim por
        // si acaso, ya que modulacion_items.placa es texto libre sin FK.
        $vehiculosPorPlaca = Vehiculo::query()
            ->get(['placa', 'capacidad_carga_kg'])
            ->keyBy(fn ($v) => strtoupper(trim($v->placa)));

        $filas = $items->map(function (ModulacionItem $item) use ($vehiculosPorPlaca) {
            $placaNormalizada = strtoupper(trim($item->placa));
            $vehiculo = $vehiculosPorPlaca->get($placaNormalizada);
            $pesoToneladas = $this->sumarPesoToneladas($item->viajes);
            $pesoKg = $pesoToneladas * 1000;
            $capacidadKg = $vehiculo?->capacidad_carga_kg;

            return [
                'id' => $item->id,
                'fecha' => $item->modulacion->fecha,
                'placa' => $item->placa,
                'peso_toneladas' => round($pesoToneladas, 2),
                'capacidad_kg' => $capacidadKg,
                'ocupacion_pct' => $capacidadKg > 0 ? round($pesoKg / $capacidadKg * 100, 1) : null,
            ];
        })
            // Las rutas sin ningún peso registrado no aportan nada al cálculo
            // de ocupación y solo ensuciarían el listado/promedios.
            ->filter(fn ($fila) => $fila['peso_toneladas'] > 0)
            ->sortByDesc('fecha')
            ->values();

        $conCapacidad = $filas->filter(fn ($f) => $f['ocupacion_pct'] !== null);

        return Inertia::render('flota/ocupacion-carga/index', [
            'filas' => $filas,
            'kpis' => [
                'total_rutas' => $filas->count(),
                'promedio_ocupacion' => $conCapacidad->isNotEmpty() ? round($conCapacidad->avg('ocupacion_pct'), 1) : null,
                'rutas_sobrecargadas' => $conCapacidad->filter(fn ($f) => $f['ocupacion_pct'] > 100)->count(),
                'vehiculos_sin_capacidad' => $filas->filter(fn ($f) => $f['ocupacion_pct'] === null)->pluck('placa')->unique()->count(),
            ],
            'ocupacion_por_vehiculo' => $this->ocupacionPorVehiculo($conCapacidad),
            'filters' => compact('desde', 'hasta', 'placa'),
        ]);
    }

    /**
     * Ocupación promedio por placa, para el gráfico de barras — top 10 con
     * más rutas evaluadas en el rango.
     */
    private function ocupacionPorVehiculo(Collection $conCapacidad): Collection
    {
        return $conCapacidad
            ->groupBy('placa')
            ->map(fn ($grupo, $placa) => [
                'placa' => $placa,
                'promedio' => round($grupo->avg('ocupacion_pct'), 1),
                'rutas' => $grupo->count(),
            ])
            ->sortByDesc('rutas')
            ->take(10)
            ->values();
    }
}
