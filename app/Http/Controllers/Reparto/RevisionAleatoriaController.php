<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Models\Flota\Vehiculo;
use App\Models\Producto;
use App\Models\Reparto\RevisionAleatoria;
use App\Models\Reparto\RevisionCausal;
use App\Models\Reparto\RevisionNovedad;
use App\Models\Reparto\RevisionResponsable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RevisionAleatoriaController extends Controller
{
    /**
     * SQLSTATE de violación de constraint de integridad (incluye unique),
     * consistente entre MySQL y SQLite (este último se usa en los tests).
     */
    private const SQLSTATE_INTEGRITY_CONSTRAINT_VIOLATION = '23000';

    public function index(): Response
    {
        $revisionesHoy = $this->revisionesDeHoy();
        $revisionActual = $revisionesHoy->first(fn (RevisionAleatoria $r) => ! $r->finalizada_en);

        return Inertia::render('reparto/revision-aleatoria/index', [
            'revision' => $revisionActual ? $this->formatRevision($revisionActual, conDetalle: true) : null,
            'revisionesHoy' => $revisionesHoy->map(fn (RevisionAleatoria $r) => $this->formatRevision($r, conDetalle: true))->values(),
            'limiteDiario' => RevisionAleatoria::POR_DIA,
            'vehiculosActivos' => Vehiculo::where('is_active', true)->orderBy('placa')->get(['id', 'placa']),
            'responsablesActivos' => RevisionResponsable::where('is_active', true)->with('colaborador:id,nombres,apellidos')->get()
                ->map(fn (RevisionResponsable $r) => ['id' => $r->id, 'nombre' => $this->nombreResponsable($r)])
                ->values(),
            'causales' => RevisionCausal::where('is_active', true)->orderBy('orden')->get(['id', 'nombre', 'requiere_especificacion']),
        ]);
    }

    /**
     * Retoma la revisión de hoy en progreso o, si no hay ninguna, arranca la
     * siguiente del día (hasta el límite de RevisionAleatoria::POR_DIA) y
     * sortea el vehículo, excluyendo los que ya salieron hoy. A prueba de
     * condiciones de carrera: los slots del día (`numero_del_dia`) y el
     * vehículo (`vehiculo_id`) están protegidos por constraints unique en
     * BD; si dos requests chocan, uno gana y el otro reintenta con la
     * siguiente opción en vez de fallar o duplicar.
     */
    public function seleccionarVehiculo(Request $request): RedirectResponse
    {
        $revision = $this->revisionEnProgresoDeHoy();

        if ($revision && $revision->vehiculo_id) {
            return back()->with('error', 'El vehículo de esta revisión ya fue seleccionado.');
        }

        if (! $revision) {
            $revision = $this->crearRevisionDelDia($request);
            if (! $revision) {
                return back()->with('error', 'Ya se realizaron las '.RevisionAleatoria::POR_DIA.' revisiones aleatorias de hoy.');
            }
        }

        $usadosHoy = RevisionAleatoria::whereDate('fecha', now()->toDateString())->whereNotNull('vehiculo_id')->pluck('vehiculo_id');
        $disponibles = Vehiculo::where('is_active', true)->whereNotIn('id', $usadosHoy)->pluck('id');
        if ($disponibles->isEmpty()) {
            return back()->with('error', 'No quedan vehículos activos sin revisar hoy.');
        }

        if (! $this->reclamarVehiculoAleatorio($revision, $disponibles)) {
            return back()->with('error', 'No fue posible asignar un vehículo, intenta de nuevo.');
        }

        return back()->with('status', 'Vehículo seleccionado.');
    }

    public function seleccionarResponsable(Request $request): RedirectResponse
    {
        $revision = $this->revisionEnProgresoDeHoy();

        if (! $revision || ! $revision->vehiculo_id) {
            return back()->with('error', 'Primero debes seleccionar el vehículo de esta revisión.');
        }

        if ($revision->responsable_id) {
            return back()->with('error', 'El responsable de esta revisión ya fue seleccionado.');
        }

        $ids = RevisionResponsable::where('is_active', true)->pluck('id');
        if ($ids->isEmpty()) {
            return back()->with('error', 'No hay responsables activos configurados para la ruleta.');
        }

        $revision->update([
            'responsable_id' => $ids->random(),
            'responsable_seleccionado_en' => now(),
        ]);

        return back()->with('status', 'Responsable seleccionado.');
    }

    public function finalizar(Request $request): RedirectResponse
    {
        $revision = $this->revisionEnProgresoDeHoy();

        if (! $revision || ! $revision->vehiculo_id || ! $revision->responsable_id) {
            return back()->with('error', 'Debes completar la selección de vehículo y responsable antes de finalizar.');
        }

        $data = $request->validate([
            'resultado' => ['required', Rule::in([RevisionAleatoria::RESULTADO_SIN_NOVEDADES, RevisionAleatoria::RESULTADO_CON_NOVEDADES])],
            'novedades' => ['required_if:resultado,'.RevisionAleatoria::RESULTADO_CON_NOVEDADES, 'array'],
            'novedades.*.sku' => ['nullable', 'string', 'max:100'],
            'novedades.*.producto' => ['required_with:novedades', 'string', 'max:255'],
            'novedades.*.cantidad_revisada' => ['nullable', 'integer', 'min:0'],
            'novedades.*.cantidad_revisada_unidad' => ['nullable', 'required_with:novedades.*.cantidad_revisada', Rule::in(array_keys(RevisionNovedad::UNIDADES_CANTIDAD_REVISADA))],
            'novedades.*.cantidad_novedad' => ['required_with:novedades', 'integer', 'min:1'],
            'novedades.*.causal_id' => ['required_with:novedades', Rule::exists('revision_causales', 'id')],
            'novedades.*.causal_especificacion' => ['nullable', 'string', 'max:500'],
            'novedades.*.observacion' => ['nullable', 'string', 'max:1000'],
            'novedades.*.evidencias' => ['nullable', 'array'],
            'novedades.*.evidencias.*' => ['nullable', 'file', 'image', 'max:5120'],
        ]);

        // No basta con exigir esto en el frontend: si la causal elegida pide
        // especificar el motivo (ej. "Otro"), el backend también lo exige.
        $causalesQueRequierenTexto = RevisionCausal::where('requiere_especificacion', true)->pluck('id')->all();
        $request->validate([
            'novedades.*.causal_especificacion' => [
                function (string $attribute, mixed $value, \Closure $fail) use ($data, $causalesQueRequierenTexto) {
                    preg_match('/novedades\.(\d+)\./', $attribute, $m);
                    $causalId = (int) ($data['novedades'][(int) ($m[1] ?? -1)]['causal_id'] ?? 0);
                    if (in_array($causalId, $causalesQueRequierenTexto, true) && trim((string) $value) === '') {
                        $fail('Debes especificar el motivo para esta causal.');
                    }
                },
            ],
        ]);

        DB::transaction(function () use ($data, $revision, $request) {
            $revision->update([
                'resultado' => $data['resultado'],
                'finalizada_en' => now(),
            ]);

            foreach ($data['novedades'] ?? [] as $i => $novedadData) {
                $novedad = $revision->novedades()->create([
                    'sku' => $novedadData['sku'] ?? null,
                    'producto' => $novedadData['producto'],
                    'cantidad_revisada' => $novedadData['cantidad_revisada'] ?? null,
                    'cantidad_revisada_unidad' => $novedadData['cantidad_revisada_unidad'] ?? null,
                    'cantidad_novedad' => $novedadData['cantidad_novedad'],
                    'causal_id' => $novedadData['causal_id'],
                    'causal_especificacion' => $novedadData['causal_especificacion'] ?? null,
                    'observacion' => $novedadData['observacion'] ?? null,
                ]);

                foreach ($request->file("novedades.{$i}.evidencias", []) as $orden => $archivo) {
                    $path = $archivo->store("revision-aleatoria/{$revision->id}/{$novedad->id}", 'public');
                    $novedad->evidencias()->create(['path' => $path, 'orden' => $orden]);
                }
            }
        });

        return to_route('reparto.revision-aleatoria.index')->with('status', 'Revisión finalizada correctamente.');
    }

    /**
     * Búsqueda en vivo del catálogo de productos para el campo "Producto"
     * del formulario de novedades (autocompletado, igual patrón que el
     * buscador de colaboradores).
     */
    public function buscarProductos(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q', ''));

        if ($q === '') {
            return response()->json([]);
        }

        // Cada palabra escrita debe aparecer (en sku o descripción), sin
        // importar el orden: buscar "aguila light" también debe encontrar
        // "Light Aguila Lata", y una sola palabra muy genérica no debe tapar
        // el resto de resultados con el límite de la lista.
        $terminos = array_filter(preg_split('/\s+/', $q));

        $productos = Producto::query()
            ->where(function (Builder $query) use ($terminos) {
                foreach ($terminos as $termino) {
                    $query->where(function (Builder $q) use ($termino) {
                        $q->where('descripcion', 'like', "%{$termino}%")
                            ->orWhere('sku', 'like', "%{$termino}%");
                    });
                }
            })
            ->orderByRaw('CASE WHEN descripcion LIKE ? THEN 0 ELSE 1 END', ["{$q}%"])
            ->orderBy('descripcion')
            ->limit(30)
            ->get(['id', 'sku', 'descripcion']);

        return response()->json($productos);
    }

    public function historial(Request $request): Response
    {
        $filtros = $request->only(['fecha', 'desde', 'hasta', 'vehiculo_id', 'responsable_id', 'causal_id', 'resultado', 'sku']);

        $query = RevisionAleatoria::query()
            ->whereNotNull('finalizada_en')
            ->with(['vehiculo:id,placa', 'responsable.colaborador:id,nombres,apellidos', 'usuario:id,name', 'novedades'])
            ->when($filtros['fecha'] ?? null, fn (Builder $q, $v) => $q->whereDate('fecha', $v))
            ->when($filtros['desde'] ?? null, fn (Builder $q, $v) => $q->whereDate('fecha', '>=', $v))
            ->when($filtros['hasta'] ?? null, fn (Builder $q, $v) => $q->whereDate('fecha', '<=', $v))
            ->when($filtros['vehiculo_id'] ?? null, fn (Builder $q, $v) => $q->where('vehiculo_id', $v))
            ->when($filtros['responsable_id'] ?? null, fn (Builder $q, $v) => $q->where('responsable_id', $v))
            ->when($filtros['resultado'] ?? null, fn (Builder $q, $v) => $q->where('resultado', $v))
            ->when($filtros['causal_id'] ?? null, fn (Builder $q, $v) => $q->whereHas('novedades', fn (Builder $qq) => $qq->where('causal_id', $v)))
            ->when($filtros['sku'] ?? null, fn (Builder $q, $v) => $q->whereHas('novedades', fn (Builder $qq) => $qq->where('sku', 'like', "%{$v}%")))
            ->orderByDesc('fecha')
            ->orderBy('numero_del_dia');

        $revisiones = $query->paginate(20)->withQueryString()->through(fn (RevisionAleatoria $r) => [
            'id' => $r->id,
            'numero_del_dia' => $r->numero_del_dia,
            'fecha' => $r->fecha->format('d/m/Y'),
            'hora' => $r->finalizada_en?->format('H:i'),
            'placa' => $r->vehiculo?->placa ?? '—',
            'responsable' => $this->nombreResponsable($r->responsable),
            'resultado' => $r->resultado,
            'total_novedades' => $r->novedades->count(),
            'usuario' => $r->usuario?->name ?? '—',
        ]);

        return Inertia::render('reparto/revision-aleatoria/historial', [
            'revisiones' => $revisiones,
            'filtros' => $filtros,
            'vehiculosDisponibles' => Vehiculo::orderBy('placa')->get(['id', 'placa']),
            'responsablesDisponibles' => RevisionResponsable::with('colaborador:id,nombres,apellidos')->get()
                ->map(fn (RevisionResponsable $r) => ['id' => $r->id, 'nombre' => $this->nombreResponsable($r)]),
            'causalesDisponibles' => RevisionCausal::orderBy('orden')->get(['id', 'nombre']),
        ]);
    }

    public function show(RevisionAleatoria $revisionAleatoria): Response
    {
        $revisionAleatoria->load(['vehiculo', 'responsable.colaborador', 'usuario', 'novedades.causal', 'novedades.evidencias']);

        return Inertia::render('reparto/revision-aleatoria/show', [
            'revision' => $this->formatRevision($revisionAleatoria, conDetalle: true),
        ]);
    }

    public function indicadores(Request $request): Response
    {
        $hasta = $request->input('hasta', now()->toDateString());
        $desde = $request->input('desde', now()->subDays(29)->toDateString());

        $filtros = $request->only(['vehiculo_id', 'responsable_id', 'causal_id', 'sku']);

        $revisionesQuery = RevisionAleatoria::query()
            ->whereNotNull('finalizada_en')
            ->whereDate('fecha', '>=', $desde)
            ->whereDate('fecha', '<=', $hasta)
            ->when($filtros['vehiculo_id'] ?? null, fn (Builder $q, $v) => $q->where('vehiculo_id', $v))
            ->when($filtros['responsable_id'] ?? null, fn (Builder $q, $v) => $q->where('responsable_id', $v))
            ->when($filtros['causal_id'] ?? null, fn (Builder $q, $v) => $q->whereHas('novedades', fn (Builder $qq) => $qq->where('causal_id', $v)))
            ->when($filtros['sku'] ?? null, fn (Builder $q, $v) => $q->whereHas('novedades', fn (Builder $qq) => $qq->where('sku', 'like', "%{$v}%")));

        $revisiones = $revisionesQuery->with(['vehiculo:id,placa', 'responsable.colaborador:id,nombres,apellidos', 'novedades.causal'])->get();

        $totalRevisiones = $revisiones->count();
        $sinNovedades = $revisiones->where('resultado', RevisionAleatoria::RESULTADO_SIN_NOVEDADES)->count();
        $conNovedades = $revisiones->where('resultado', RevisionAleatoria::RESULTADO_CON_NOVEDADES)->count();
        $todasNovedades = $revisiones->flatMap(fn (RevisionAleatoria $r) => $r->novedades);
        $totalNovedades = $todasNovedades->count();

        $causalMasFrecuente = $todasNovedades->groupBy('causal_id')
            ->sortByDesc(fn ($g) => $g->count())
            ->first()?->first()?->causal?->nombre;

        $kpis = [
            'total_revisiones' => $totalRevisiones,
            'sin_novedades' => $sinNovedades,
            'con_novedades' => $conNovedades,
            'total_novedades' => $totalNovedades,
            'productos_afectados' => $todasNovedades->pluck('sku')->filter()->unique()->count() ?: $todasNovedades->pluck('producto')->unique()->count(),
            'unidades_afectadas' => $todasNovedades->sum('cantidad_novedad'),
            'vehiculos_revisados' => $revisiones->pluck('vehiculo_id')->filter()->unique()->count(),
            'pct_con_novedades' => $totalRevisiones > 0 ? round($conNovedades / $totalRevisiones * 100, 1) : 0,
            'causal_mas_frecuente' => $causalMasFrecuente ?? '—',
        ];

        $revisionesPorDia = $revisiones->groupBy(fn (RevisionAleatoria $r) => $r->fecha->format('Y-m-d'))
            ->map(fn ($g, $fecha) => ['fecha' => $fecha, 'total' => $g->count()])
            ->sortBy('fecha')->values();

        $novedadesPorDia = $todasNovedades->groupBy(fn (RevisionNovedad $n) => $n->revision->fecha->format('Y-m-d'))
            ->map(fn ($g, $fecha) => ['fecha' => $fecha, 'total' => $g->count()])
            ->sortBy('fecha')->values();

        $porCausal = $todasNovedades->groupBy(fn (RevisionNovedad $n) => $n->causal?->nombre ?? '—')
            ->map(fn ($g, $nombre) => ['causal' => $nombre, 'total' => $g->count()])
            ->sortByDesc('total')->values();

        $porVehiculo = $revisiones->groupBy(fn (RevisionAleatoria $r) => $r->vehiculo?->placa ?? '—')
            ->map(fn ($g, $placa) => ['placa' => $placa, 'novedades' => $g->flatMap(fn ($r) => $r->novedades)->count()])
            ->filter(fn ($row) => $row['novedades'] > 0)
            ->sortByDesc('novedades')->values();

        $porResponsable = $revisiones->groupBy(fn (RevisionAleatoria $r) => $this->nombreResponsable($r->responsable))
            ->map(fn ($g, $nombre) => [
                'responsable' => $nombre,
                'revisiones' => $g->count(),
                'con_novedades' => $g->where('resultado', RevisionAleatoria::RESULTADO_CON_NOVEDADES)->count(),
            ])
            ->sortByDesc('revisiones')->values();

        $topSku = $todasNovedades->groupBy(fn (RevisionNovedad $n) => $n->sku ?: $n->producto)
            ->map(fn ($g, $sku) => ['sku' => $sku, 'producto' => $g->first()->producto, 'total' => $g->count()])
            ->sortByDesc('total')->take(10)->values();

        return Inertia::render('reparto/revision-aleatoria/indicadores', [
            'filtros' => [...$filtros, 'desde' => $desde, 'hasta' => $hasta],
            'kpis' => $kpis,
            'revisionesPorDia' => $revisionesPorDia,
            'novedadesPorDia' => $novedadesPorDia,
            'porCausal' => $porCausal,
            'porVehiculo' => $porVehiculo,
            'porResponsable' => $porResponsable,
            'topSku' => $topSku,
            'vehiculosDisponibles' => Vehiculo::orderBy('placa')->get(['id', 'placa']),
            'responsablesDisponibles' => RevisionResponsable::with('colaborador:id,nombres,apellidos')->get()
                ->map(fn (RevisionResponsable $r) => ['id' => $r->id, 'nombre' => $this->nombreResponsable($r)]),
            'causalesDisponibles' => RevisionCausal::orderBy('orden')->get(['id', 'nombre']),
        ]);
    }

    /**
     * Corrección administrativa: elimina la revisión de una fecha para
     * permitir una nueva ese día (junto con sus novedades y evidencias, por
     * cascadeOnDelete). No es un "reabrir": es rehacer desde cero.
     */
    public function destroy(RevisionAleatoria $revisionAleatoria): RedirectResponse
    {
        foreach ($revisionAleatoria->novedades as $novedad) {
            foreach ($novedad->evidencias as $evidencia) {
                Storage::disk('public')->delete($evidencia->path);
            }
        }

        $revisionAleatoria->delete();

        return to_route('reparto.revision-aleatoria.historial')->with('status', 'Revisión eliminada. Esa fecha queda libre para una nueva revisión.');
    }

    /**
     * @return Collection<int, RevisionAleatoria>
     */
    private function revisionesDeHoy(): Collection
    {
        return RevisionAleatoria::whereDate('fecha', now()->toDateString())
            ->with(['vehiculo', 'responsable.colaborador', 'usuario', 'novedades.causal', 'novedades.evidencias'])
            ->orderBy('numero_del_dia')
            ->get();
    }

    private function revisionEnProgresoDeHoy(): ?RevisionAleatoria
    {
        return $this->revisionesDeHoy()->first(fn (RevisionAleatoria $r) => ! $r->finalizada_en);
    }

    /**
     * Arranca el siguiente slot del día (1..POR_DIA). A prueba de condiciones
     * de carrera: el constraint unique(fecha, numero_del_dia) es la garantía
     * real; si el slot ya fue tomado por otro request, se reintenta con el
     * siguiente en vez de duplicar o fallar. Devuelve null si el día ya
     * completó las POR_DIA revisiones.
     */
    private function crearRevisionDelDia(Request $request): ?RevisionAleatoria
    {
        for ($slot = 1; $slot <= RevisionAleatoria::POR_DIA; $slot++) {
            try {
                return RevisionAleatoria::create([
                    'fecha' => now()->toDateString(),
                    'numero_del_dia' => $slot,
                    'user_id' => $request->user()->id,
                ]);
            } catch (QueryException $e) {
                if ($e->getCode() === self::SQLSTATE_INTEGRITY_CONSTRAINT_VIOLATION) {
                    continue;
                }

                throw $e;
            }
        }

        return null;
    }

    /**
     * Sortea un vehículo entre `$disponibles` y lo asigna a `$revision`. A
     * prueba de condiciones de carrera: el constraint unique(fecha,
     * vehiculo_id) es la garantía real; si otro request ya tomó ese
     * vehículo para hoy, se reintenta con otro candidato de la lista.
     *
     * @param  Collection<int, int>  $disponibles
     */
    private function reclamarVehiculoAleatorio(RevisionAleatoria $revision, Collection $disponibles): ?int
    {
        foreach ($disponibles->shuffle() as $vehiculoId) {
            try {
                $revision->update(['vehiculo_id' => $vehiculoId, 'vehiculo_seleccionado_en' => now()]);

                return $vehiculoId;
            } catch (QueryException $e) {
                if ($e->getCode() === self::SQLSTATE_INTEGRITY_CONSTRAINT_VIOLATION) {
                    continue;
                }

                throw $e;
            }
        }

        return null;
    }

    private function nombreResponsable(?RevisionResponsable $responsable): string
    {
        if (! $responsable || ! $responsable->colaborador) {
            return '—';
        }

        return trim("{$responsable->colaborador->nombres} {$responsable->colaborador->apellidos}");
    }

    private function formatRevision(RevisionAleatoria $revision, bool $conDetalle = false): array
    {
        $data = [
            'id' => $revision->id,
            'numero_del_dia' => $revision->numero_del_dia,
            'fecha' => $revision->fecha->format('Y-m-d'),
            'fecha_formateada' => $revision->fecha->translatedFormat('d/m/Y'),
            'vehiculo' => $revision->vehiculo ? ['id' => $revision->vehiculo->id, 'placa' => $revision->vehiculo->placa] : null,
            'vehiculo_seleccionado_en' => $revision->vehiculo_seleccionado_en?->format('H:i'),
            'responsable' => $revision->responsable ? [
                'id' => $revision->responsable->id,
                'nombre' => $this->nombreResponsable($revision->responsable),
            ] : null,
            'responsable_seleccionado_en' => $revision->responsable_seleccionado_en?->format('H:i'),
            'resultado' => $revision->resultado,
            'finalizada_en' => $revision->finalizada_en?->format('H:i'),
            'usuario' => $revision->usuario?->name,
            'total_novedades' => $revision->novedades->count(),
        ];

        if ($conDetalle) {
            $data['novedades'] = $revision->novedades->map(fn (RevisionNovedad $n) => [
                'id' => $n->id,
                'sku' => $n->sku,
                'producto' => $n->producto,
                'cantidad_revisada' => $n->cantidad_revisada,
                'cantidad_revisada_unidad' => $n->cantidad_revisada_unidad ? RevisionNovedad::UNIDADES_CANTIDAD_REVISADA[$n->cantidad_revisada_unidad] ?? null : null,
                'cantidad_novedad' => $n->cantidad_novedad,
                'causal' => $n->causal?->nombre,
                'causal_especificacion' => $n->causal_especificacion,
                'observacion' => $n->observacion,
                'evidencias' => $n->evidencias->map(fn ($e) => ['id' => $e->id, 'url' => $e->url])->values(),
            ])->values();
        }

        return $data;
    }
}
