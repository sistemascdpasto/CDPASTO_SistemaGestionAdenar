<?php

namespace App\Http\Controllers\Flota;

use App\Http\Controllers\Controller;
use App\Models\Flota\CombustibleVoucher;
use App\Models\Flota\Vehiculo;
use App\Models\Flota\VehiculoKilometroDiario;
use App\Models\Reparto\ModulacionItem;
use App\Services\Flota\MygeotabKilometrosSyncService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Cruza kilómetros diarios (MyGeotab), tanqueadas confirmadas por Flota
 * (vouchers 'revisado') y meta por vehículo para calcular rendimiento
 * km/gl — reemplaza el Excel manual que llevaba el equipo. El detalle por
 * día (ruta/conductor) se trae aparte (detallePlaca) cruzando por placa
 * normalizada contra Modulación, igual que ya hace OcupacionCargaController.
 */
class AnalisisCombustibleController extends Controller
{
    public function index(Request $request): Response
    {
        $desde = $request->input('desde', now()->startOfMonth()->toDateString());
        $hasta = $request->input('hasta', now()->toDateString());

        $filas = $this->filasPorPlaca($desde, $hasta);
        $conRendimiento = $filas->filter(fn ($f) => $f['rendimiento_km_gl'] !== null);

        return Inertia::render('flota/combustible/index', [
            'por_placa' => $filas,
            'kpis' => [
                'vehiculos_con_datos' => $filas->count(),
                'km_total' => round($filas->sum('km_total'), 0),
                'galones_total' => round($filas->sum('galones_total'), 1),
                'costo_total' => round($filas->sum('total_pagado'), 0),
                'rendimiento_promedio' => $conRendimiento->isNotEmpty() ? round($conRendimiento->avg('rendimiento_km_gl'), 2) : null,
                'vehiculos_bajo_meta' => $filas->filter(fn ($f) => $f['cumplimiento_pct'] !== null && $f['cumplimiento_pct'] < 100)->count(),
            ],
            'tendencia_diaria' => $this->tendenciaDiaria($desde, $hasta),
            'distribucion_cumplimiento' => $this->distribucionCumplimiento($filas),
            'ranking_rendimiento' => $conRendimiento->sortByDesc('rendimiento_km_gl')->take(10)->values(),
            'ranking_bajo_rendimiento' => $conRendimiento->sortBy('rendimiento_km_gl')->take(5)->values(),
            'filters' => compact('desde', 'hasta'),
        ]);
    }

    /**
     * Km recorridos y galones/costo tanqueados por día, para la tendencia
     * de la flota completa en el rango — igual que
     * OcupacionCargaController::tendenciaDiaria pero sumando km (MyGeotab)
     * y combustible (vouchers revisados) en vez de ocupación de carga.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function tendenciaDiaria(string $desde, string $hasta): Collection
    {
        $kmPorDia = VehiculoKilometroDiario::query()
            ->whereDate('fecha', '>=', $desde)
            ->whereDate('fecha', '<=', $hasta)
            ->get()
            ->groupBy(fn (VehiculoKilometroDiario $k) => $k->fecha->toDateString())
            ->map(fn ($grupo) => (float) $grupo->sum('distancia_km'));

        $combustiblePorDia = CombustibleVoucher::query()
            ->where('estado', 'revisado')
            ->whereDate('fecha_voucher', '>=', $desde)
            ->whereDate('fecha_voucher', '<=', $hasta)
            ->get()
            // Agrupar por el nombre del atributo ('fecha_voucher') usaría
            // el __toString() completo de Carbon ("...00:00:00") como
            // clave, no el 'Y-m-d' del cast — no calzaría con $kmPorDia.
            ->groupBy(fn (CombustibleVoucher $v) => $v->fecha_voucher->toDateString())
            ->map(fn ($grupo) => [
                'galones' => (float) $grupo->sum('galones'),
                'costo' => (float) $grupo->sum('total_pagado'),
            ]);

        return $kmPorDia->keys()->merge($combustiblePorDia->keys())->unique()->sort()->values()
            ->map(function (string $fecha) use ($kmPorDia, $combustiblePorDia) {
                $km = $kmPorDia->get($fecha, 0.0);
                $combustible = $combustiblePorDia->get($fecha, ['galones' => 0.0, 'costo' => 0.0]);

                return [
                    'fecha' => $fecha,
                    'km' => round($km, 1),
                    'galones' => round($combustible['galones'], 1),
                    'costo' => round($combustible['costo'], 0),
                ];
            });
    }

    /**
     * Cuántos vehículos caen en cada rango de cumplimiento de meta — misma
     * idea que OcupacionCargaController::distribucionOcupacion.
     *
     * @param  Collection<int, array<string, mixed>>  $filas
     * @return Collection<int, array{rango: string, total: int}>
     */
    private function distribucionCumplimiento(Collection $filas): Collection
    {
        $rangos = [
            'Sin tanqueadas revisadas' => fn ($f) => $f['rendimiento_km_gl'] === null,
            'Sin meta asignada' => fn ($f) => $f['rendimiento_km_gl'] !== null && $f['meta_km_gl'] === null,
            'Bajo meta (<85%)' => fn ($f) => $f['cumplimiento_pct'] !== null && $f['cumplimiento_pct'] < 85,
            'Cerca de la meta (85-99%)' => fn ($f) => $f['cumplimiento_pct'] !== null && $f['cumplimiento_pct'] >= 85 && $f['cumplimiento_pct'] < 100,
            'Cumple la meta (≥100%)' => fn ($f) => $f['cumplimiento_pct'] !== null && $f['cumplimiento_pct'] >= 100,
        ];

        return collect($rangos)->map(fn ($condicion, $rango) => [
            'rango' => $rango,
            'total' => $filas->filter($condicion)->count(),
        ])->values();
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function filasPorPlaca(string $desde, string $hasta): Collection
    {
        $kmPorPlaca = VehiculoKilometroDiario::query()
            ->whereDate('fecha', '>=', $desde)
            ->whereDate('fecha', '<=', $hasta)
            ->get()
            ->groupBy('placa')
            ->map(fn ($grupo) => [
                'km_total' => (float) $grupo->sum('distancia_km'),
                'dias_con_datos' => $grupo->count(),
            ]);

        $combustiblePorPlaca = CombustibleVoucher::query()
            ->where('estado', 'revisado')
            ->whereDate('fecha_voucher', '>=', $desde)
            ->whereDate('fecha_voucher', '<=', $hasta)
            ->get()
            ->groupBy('placa')
            ->map(fn ($grupo) => [
                'galones_total' => (float) $grupo->sum('galones'),
                'total_pagado' => (float) $grupo->sum('total_pagado'),
            ]);

        $metaPorPlaca = Vehiculo::query()
            ->get(['placa', 'meta_km_gl'])
            ->keyBy(fn (Vehiculo $v) => strtoupper(trim($v->placa)));

        $placas = $kmPorPlaca->keys()->merge($combustiblePorPlaca->keys())->unique();

        return $placas->map(function (string $placa) use ($kmPorPlaca, $combustiblePorPlaca, $metaPorPlaca) {
            $km = $kmPorPlaca->get($placa, ['km_total' => 0.0, 'dias_con_datos' => 0]);
            $combustible = $combustiblePorPlaca->get($placa, ['galones_total' => 0.0, 'total_pagado' => 0.0]);
            // 11 (meta estándar de la flota) cuando la placa todavía no
            // tiene fila en Documentación (ej. la reporta MyGeotab pero
            // nadie la ha registrado ahí) — solo si la fila SÍ existe y su
            // meta es null se respeta como "sin meta asignada" intencional.
            $meta = $metaPorPlaca->has($placa) ? $metaPorPlaca->get($placa)->meta_km_gl : 11.0;

            // null (no 0) cuando todavía no hay tanqueadas revisadas en el
            // rango: un costo/rendimiento en 0 se leería como "gratis", no
            // como "sin datos".
            $rendimiento = $combustible['galones_total'] > 0 ? $km['km_total'] / $combustible['galones_total'] : null;
            $costoKm = $combustible['total_pagado'] > 0 && $km['km_total'] > 0 ? $combustible['total_pagado'] / $km['km_total'] : null;

            return [
                'placa' => $placa,
                'km_total' => round($km['km_total'], 1),
                'dias_con_datos' => $km['dias_con_datos'],
                'galones_total' => round($combustible['galones_total'], 2),
                'total_pagado' => round($combustible['total_pagado'], 0),
                'rendimiento_km_gl' => $rendimiento !== null ? round($rendimiento, 2) : null,
                'costo_km' => $costoKm !== null ? round($costoKm, 0) : null,
                'meta_km_gl' => $meta !== null ? (float) $meta : null,
                'cumplimiento_pct' => $rendimiento !== null && $meta > 0 ? round($rendimiento / $meta * 100, 1) : null,
            ];
        })
            ->sortByDesc('km_total')
            ->values();
    }

    /**
     * Detalle día por día de una placa (ruta/conductor desde Modulación +
     * km de MyGeotab), para el drill-down de la tabla principal. Mismo
     * cruce por placa normalizada + keyBy que OcupacionCargaController,
     * aplicado aquí a una sola placa en vez de todas.
     */
    public function detallePlaca(Request $request): JsonResponse
    {
        $validado = $request->validate([
            'placa' => ['required', 'string', 'max:50'],
            'desde' => ['required', 'date_format:Y-m-d'],
            'hasta' => ['required', 'date_format:Y-m-d'],
        ]);
        $placa = strtoupper(trim($validado['placa']));

        $kmPorFecha = VehiculoKilometroDiario::query()
            ->where('placa', $placa)
            ->whereDate('fecha', '>=', $validado['desde'])
            ->whereDate('fecha', '<=', $validado['hasta'])
            ->get()
            ->keyBy(fn (VehiculoKilometroDiario $k) => $k->fecha->toDateString());

        // modulacion_items.placa es texto libre sin FK (puede venir en
        // minúsculas/con espacios) — se compara normalizada, igual que
        // OcupacionCargaController. modulaciones.fecha es un string plano
        // (no cast a date), por eso se usa directo como clave.
        $rutasPorFecha = ModulacionItem::with('modulacion')
            ->whereRaw('UPPER(TRIM(placa)) = ?', [$placa])
            ->whereHas('modulacion', fn ($q) => $q->whereDate('fecha', '>=', $validado['desde'])->whereDate('fecha', '<=', $validado['hasta']))
            ->get()
            ->keyBy(fn (ModulacionItem $item) => $item->modulacion->fecha);

        $fechas = $kmPorFecha->keys()->merge($rutasPorFecha->keys())->unique()->sort()->values();

        $filas = $fechas->map(function (string $fecha) use ($kmPorFecha, $rutasPorFecha) {
            $km = $kmPorFecha->get($fecha);
            $ruta = $rutasPorFecha->get($fecha);

            return [
                'fecha' => $fecha,
                'km' => $km ? round((float) $km->distancia_km, 1) : null,
                'ruta' => $ruta ? $this->resumenRuta($ruta->viajes) : null,
                'conductor' => $ruta?->nombres,
            ];
        })->values();

        return response()->json(['filas' => $filas]);
    }

    /**
     * "La ruta" de un ModulacionItem no vive en un campo suelto — son sus
     * 'viajes' (cada uno con 'destinos': barrio/lugares, o si no tiene
     * destinos, su propio barrio/lugares top-level — mismo fallback que
     * obtenerDestinosViaje() en el frontend de Modulación). Se resume como
     * la lista de barrios/lugares visitados ese día, sin repetir.
     *
     * @param  ?array<int, array<string, mixed>>  $viajes
     */
    private function resumenRuta(?array $viajes): ?string
    {
        if (empty($viajes)) {
            return null;
        }

        $paradas = collect($viajes)
            ->flatMap(function (array $viaje) {
                $destinos = $viaje['destinos'] ?? [];
                if (empty($destinos)) {
                    $destinos = [['lugares' => $viaje['lugares'] ?? '', 'barrio' => $viaje['barrio'] ?? '']];
                }

                return collect($destinos)->map(fn ($destino) => trim($destino['barrio'] ?? '') ?: trim($destino['lugares'] ?? ''));
            })
            ->filter()
            ->unique()
            ->values();

        return $paradas->isNotEmpty() ? $paradas->implode(', ') : null;
    }

    /**
     * La tabla del dashboard está agrupada por placa (texto libre, viene de
     * MyGeotab/vouchers), no por vehiculo_id — por eso la ruta recibe la
     * placa, no un Vehiculo con route-model-binding (eso causaba un 404: el
     * binding por defecto busca por id, y la placa nunca calza con un id
     * numérico). firstOrCreate por si la placa todavía no tiene fila en
     * Documentación (ej. un vehículo que ya reporta a MyGeotab pero aún no
     * se ha registrado formalmente).
     */
    public function actualizarMeta(Request $request, string $placa): RedirectResponse
    {
        $validado = $request->validate([
            'meta_km_gl' => ['nullable', 'numeric', 'min:0', 'max:999.99'],
        ]);

        $placa = strtoupper(trim($placa));
        $vehiculo = Vehiculo::query()->firstOrCreate(['placa' => $placa]);
        $vehiculo->update($validado);

        return back()->with('status', ['type' => 'success', 'message' => "Meta de {$placa} actualizada."]);
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
