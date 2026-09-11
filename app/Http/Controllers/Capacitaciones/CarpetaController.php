<?php

namespace App\Http\Controllers\Capacitaciones;

use App\Http\Controllers\Controller;
use App\Models\Capacitaciones\CapacitacionBanner;
use App\Models\Capacitaciones\CapacitacionCarpeta;
use App\Models\Capacitaciones\CapacitacionMaterial;
use App\Models\Capacitaciones\CapacitacionRevision;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class CarpetaController extends Controller
{
    public function index(Request $request): Response
    {
        $buscar = $request->query('buscar');
        $carpetaId = $request->query('carpeta_id');
        $fechaInicio = $request->query('fecha_inicio');
        $fechaFin = $request->query('fecha_fin');
        $estadoFiltro = $request->query('estado'); // completado, en_proceso, sin_actividad

        try {
            // 1. Carpetas disponibles (solo raíz, ordenadas de forma ascendente)
            $carpetas = CapacitacionCarpeta::query()
                ->whereNull('parent_id')
                ->withCount('materiales')
                ->orderBy('nombre', 'asc')
                ->get();

            // 2. Filtros para materiales
            $queryMateriales = CapacitacionMaterial::query()
                ->where('estado', 'publicado')
                ->when($carpetaId, fn ($q) => $q->where('carpeta_id', $carpetaId));

            $totalMateriales = (clone $queryMateriales)->count();
            $materialesIds = (clone $queryMateriales)->pluck('id');

            // 3. Métricas por trabajador optimizada con consultas agrupadas
            // Obtener conteos y última revisión con una sola consulta agrupada
            $revisionesPorUsuario = DB::table('capacitacion_revisiones')
                ->whereIn('material_id', $materialesIds)
                ->when($fechaInicio, fn ($q) => $q->whereDate('revisada_at', '>=', $fechaInicio))
                ->when($fechaFin, fn ($q) => $q->whereDate('revisada_at', '<=', $fechaFin))
                ->select('user_id')
                ->selectRaw('COUNT(DISTINCT material_id) as revisadas_count')
                ->selectRaw('MAX(revisada_at) as ultima_revision_at')
                ->groupBy('user_id')
                ->get()
                ->keyBy('user_id');

            // Obtener colaboradores con role de una vez
            $colaboradoresList = User::query()
                ->role('Colaborador')
                ->with('colaborador:id,user_id,nombres,apellidos,cedula,area,cargo')
                ->get()
                ->map(function ($u) use ($totalMateriales, $revisionesPorUsuario) {
                    $colab = $u->colaborador;
                    $revisionData = $revisionesPorUsuario->get($u->id);
                    $revisadas = $revisionData ? (int) $revisionData->revisadas_count : 0;
                    $porcentaje = $totalMateriales > 0 ? min(100, (int) round(($revisadas / $totalMateriales) * 100)) : 0;
                    $ultimaRevisionAt = $revisionData ? $revisionData->ultima_revision_at : null;

                    $estadoKey = 'sin_actividad';
                    if ($totalMateriales > 0 && $revisadas >= $totalMateriales) {
                        $estadoKey = 'completado';
                    } elseif ($revisadas > 0) {
                        $estadoKey = 'en_proceso';
                    }

                    return [
                        'user_id' => $u->id,
                        'nombre_completo' => $colab ? "{$colab->nombres} {$colab->apellidos}" : ($u->name ?? 'Usuario'),
                        'cedula' => $colab?->cedula ?? $u->identification_number ?? '—',
                        'cargo' => $colab?->cargo ?? '—',
                        'area' => $colab?->area ?? '—',
                        'revisadas_count' => $revisadas,
                        'total_materiales' => $totalMateriales,
                        'faltantes_count' => max(0, $totalMateriales - $revisadas),
                        'porcentaje' => $porcentaje,
                        'estado_key' => $estadoKey,
                        'completado' => $estadoKey === 'completado',
                        'en_proceso' => $estadoKey === 'en_proceso',
                        'sin_actividad' => $estadoKey === 'sin_actividad',
                        'ultima_revision' => $ultimaRevisionAt ? Carbon::parse($ultimaRevisionAt)->diffForHumans() : 'Sin actividad',
                        'ultima_revision_raw' => $ultimaRevisionAt,
                    ];
                });

            // Filtrado por estado de colaborador si fue solicitado
            $colaboradoresFiltrados = $colaboradoresList->when($estadoFiltro && $estadoFiltro !== 'todos', function ($col, $st) {
                return $col->where('estado_key', $st);
            })->when($buscar, function ($col, $b) {
                $q = strtolower($b);
                return $col->filter(function ($item) use ($q) {
                    return str_contains(strtolower($item['nombre_completo']), $q) ||
                           str_contains(strtolower($item['cedula']), $q) ||
                           str_contains(strtolower($item['cargo']), $q) ||
                           str_contains(strtolower($item['area']), $q);
                });
            })->values();

            // 4. Resumen por estado para gráfica de distribución
            $distribucionEstados = [
                [
                    'name' => 'Completaron 100%',
                    'key' => 'completado',
                    'cantidad' => $colaboradoresList->where('estado_key', 'completado')->count(),
                    'color' => '#10B981', // Emerald
                ],
                [
                    'name' => 'En proceso',
                    'key' => 'en_proceso',
                    'cantidad' => $colaboradoresList->where('estado_key', 'en_proceso')->count(),
                    'color' => '#0D9488', // Teal
                ],
                [
                    'name' => 'Sin actividad',
                    'key' => 'sin_actividad',
                    'cantidad' => $colaboradoresList->where('estado_key', 'sin_actividad')->count(),
                    'color' => '#F59E0B', // Amber
                ],
            ];

            // 5. Ranking de Capacitaciones más consultadas
            $rankingCapacitaciones = CapacitacionMaterial::query()
                ->with('carpeta:id,nombre,color')
                ->whereIn('id', $materialesIds)
                ->withCount(['revisiones' => function ($q) use ($fechaInicio, $fechaFin) {
                    $q->when($fechaInicio, fn ($sub) => $sub->whereDate('revisada_at', '>=', $fechaInicio))
                      ->when($fechaFin, fn ($sub) => $sub->whereDate('revisada_at', '<=', $fechaFin));
                }])
                ->with(['revisiones' => function ($q) use ($fechaInicio, $fechaFin) {
                    $q->when($fechaInicio, fn ($sub) => $sub->whereDate('revisada_at', '>=', $fechaInicio))
                      ->when($fechaFin, fn ($sub) => $sub->whereDate('revisada_at', '<=', $fechaFin))
                      ->with('user.colaborador:id,user_id,nombres,apellidos,cedula,area,cargo')
                      ->latest('revisada_at')
                      ->take(10); // Limitar a 10 revisiones más recientes por material
                }])
                ->orderByDesc('revisiones_count')
                ->take(10)
                ->get()
                ->map(function ($mat) {
                    return [
                        'id' => $mat->id,
                        'titulo' => $mat->titulo,
                        'tipo' => $mat->tipo,
                        'carpeta' => $mat->carpeta,
                        'revisiones_count' => $mat->revisiones_count,
                        'trabajadores' => $mat->revisiones->map(function ($r) {
                            $colab = $r->user?->colaborador;
                            return [
                                'user_id' => $r->user_id,
                                'nombre' => $colab ? "{$colab->nombres} {$colab->apellidos}" : ($r->user?->name ?? 'Usuario'),
                                'cedula' => $colab?->cedula ?? $r->user?->identification_number ?? '—',
                                'cargo' => $colab?->cargo ?? '—',
                                'fecha' => $r->revisada_at ? $r->revisada_at->diffForHumans() : '—',
                                'fecha_exacta' => $r->revisada_at ? $r->revisada_at->format('d/m/Y H:i') : '—',
                            ];
                        })->values(),
                    ];
                });

            // 6. Actividad reciente en tiempo real
            $actividadReciente = CapacitacionRevision::query()
                ->whereIn('material_id', $materialesIds)
                ->when($fechaInicio, fn ($q) => $q->whereDate('revisada_at', '>=', $fechaInicio))
                ->when($fechaFin, fn ($q) => $q->whereDate('revisada_at', '<=', $fechaFin))
                ->with([
                    'user.colaborador:id,user_id,nombres,apellidos,cedula',
                    'material' => fn ($q) => $q->with('carpeta:id,nombre,color'),
                ])
                ->latest('revisada_at')
                ->take(10)
                ->get()
                ->map(function ($rev) {
                    $colab = $rev->user?->colaborador;
                    $mat = $rev->material;

                    return [
                        'id' => $rev->id,
                        'trabajador_nombre' => $colab ? "{$colab->nombres} {$colab->apellidos}" : ($rev->user?->name ?? 'Usuario'),
                        'trabajador_cedula' => $colab?->cedula ?? $rev->user?->identification_number ?? '—',
                        'capacitacion_titulo' => $mat?->titulo ?? 'Capacitación',
                        'carpeta' => $mat?->carpeta,
                        'revisada_humano' => $rev->revisada_at ? $rev->revisada_at->diffForHumans() : '—',
                        'revisada_exacta' => $rev->revisada_at ? $rev->revisada_at->format('d/m/Y H:i') : '—',
                    ];
                });

            // 7. Gráfica de actividad temporal (Revisiones por día / fecha)
            $graficaActividad = CapacitacionRevision::query()
                ->whereIn('material_id', $materialesIds)
                ->when($fechaInicio, fn ($q) => $q->whereDate('revisada_at', '>=', $fechaInicio))
                ->when($fechaFin, fn ($q) => $q->whereDate('revisada_at', '<=', $fechaFin))
                ->selectRaw('DATE(revisada_at) as fecha, COUNT(*) as total')
                ->groupBy('fecha')
                ->orderBy('fecha')
                ->take(15)
                ->get()
                ->map(function ($row) {
                    return [
                        'fecha' => Carbon::parse($row->fecha)->format('d M'),
                        'fecha_completa' => Carbon::parse($row->fecha)->format('d/m/Y'),
                        'revisiones' => (int) $row->total,
                    ];
                });

            return Inertia::render('capacitaciones/index', [
                'carpetas' => $carpetas,
                'recientes' => CapacitacionMaterial::query()->with('carpeta:id,nombre,color')->latest('id')->take(8)->get(),
                'distribucionEstados' => $distribucionEstados,
                'colaboradores' => $colaboradoresFiltrados,
                'colaboradoresResumen' => [
                    'total' => $colaboradoresList->count(),
                    'completados' => $colaboradoresList->where('estado_key', 'completado')->count(),
                    'en_proceso' => $colaboradoresList->where('estado_key', 'en_proceso')->count(),
                    'sin_actividad' => $colaboradoresList->where('estado_key', 'sin_actividad')->count(),
                ],
                'rankingCapacitaciones' => $rankingCapacitaciones,
                'actividadReciente' => $actividadReciente,
                'graficaActividad' => $graficaActividad,
                'banner' => CapacitacionBanner::actual()->only(['frase', 'sub_frase', 'imagen_url']),
                'filters' => [
                    'buscar' => $buscar ?? '',
                    'carpeta_id' => $carpetaId ?? '',
                    'fecha_inicio' => $fechaInicio ?? '',
                    'fecha_fin' => $fechaFin ?? '',
                    'estado' => $estadoFiltro ?? '',
                ],
            ]);
        } catch (\Exception $e) {
            // Si hay un error, log y retornar datos vacíos para evitar pantalla en blanco
            \Log::error('Error en capacitaciones index: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return Inertia::render('capacitaciones/index', [
                'carpetas' => [],
                'recientes' => [],
                'distribucionEstados' => [],
                'colaboradores' => [],
                'colaboradoresResumen' => [
                    'total' => 0,
                    'completados' => 0,
                    'en_proceso' => 0,
                    'sin_actividad' => 0,
                ],
                'rankingCapacitaciones' => [],
                'actividadReciente' => [],
                'graficaActividad' => [],
                'banner' => CapacitacionBanner::actual()->only(['frase', 'sub_frase', 'imagen_url']),
                'filters' => [
                    'buscar' => $buscar ?? '',
                    'carpeta_id' => $carpetaId ?? '',
                    'fecha_inicio' => $fechaInicio ?? '',
                    'fecha_fin' => $fechaFin ?? '',
                    'estado' => $estadoFiltro ?? '',
                ],
                'error' => 'Hubo un error al cargar los datos. Por favor, intenta nuevamente.',
            ]);
        }
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'parent_id' => ['nullable', 'exists:capacitacion_carpetas,id'],
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:1000'],
            'color' => ['nullable', 'string', 'max:30'],
            'icono' => ['nullable', 'string', 'max:50'],
            'visible_colaborador' => ['nullable', 'boolean'],
            'portada' => ['nullable', 'image', 'max:10240'],
        ]);

        $portadaPath = null;
        if ($request->hasFile('portada') && $request->file('portada')->isValid()) {
            $file = $request->file('portada');
            $safeName = time() . '_portada_' . preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $file->getClientOriginalName());
            $portadaPath = $file->storeAs('capacitaciones/portadas', $safeName, 'public');
        }

        CapacitacionCarpeta::create([
            'parent_id' => $data['parent_id'] ?? null,
            'nombre' => $data['nombre'],
            'descripcion' => $data['descripcion'] ?? null,
            'color' => $data['color'] ?? '#0D9488',
            'icono' => $data['icono'] ?? 'folder',
            'visible_colaborador' => $request->boolean('visible_colaborador', true),
            'portada_path' => $portadaPath,
            'created_by' => $request->user()?->id,
        ]);

        return back()->with('status', 'Carpeta creada exitosamente.');
    }

    public function show(Request $request, CapacitacionCarpeta $carpeta): Response
    {
        $buscar = $request->query('buscar');

        // Subcarpetas de la carpeta actual (ordenadas de forma ascendente)
        $subcarpetas = $carpeta->subcarpetas()
            ->withCount('materiales')
            ->orderBy('nombre', 'asc')
            ->get();

        $materiales = $carpeta->materiales()
            ->when($buscar, function ($q, $texto) {
                $q->where('titulo', 'like', "%{$texto}%")
                  ->orWhere('descripcion', 'like', "%{$texto}%");
            })
            ->orderBy('orden')
            ->latest('id')
            ->get()
            ->map(function ($material) {
                return [
                    'id' => $material->id,
                    'titulo' => $material->titulo,
                    'descripcion' => $material->descripcion,
                    'tipo' => $material->tipo,
                    'archivo_path' => $material->archivo_path ? Storage::url($material->archivo_path) : null,
                    'archivo_nombre_original' => $material->archivo_nombre_original,
                    'tamano_humano' => $material->tamano_humano,
                    'mime_type' => $material->mime_type,
                    'enlace_externo' => $material->enlace_externo,
                    'created_at' => $material->created_at,
                ];
            });

        return Inertia::render('capacitaciones/show', [
            'carpeta' => $carpeta,
            'subcarpetas' => $subcarpetas,
            'ancestros' => $carpeta->getAncestros(),
            'materiales' => $materiales,
            'filters' => [
                'buscar' => $buscar ?? '',
            ],
        ]);
    }

    public function update(Request $request, CapacitacionCarpeta $carpeta): RedirectResponse
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:1000'],
            'color' => ['nullable', 'string', 'max:30'],
            'icono' => ['nullable', 'string', 'max:50'],
            'visible_colaborador' => ['nullable', 'boolean'],
            'portada' => ['nullable', 'image', 'max:10240'],
        ]);

        $portadaPath = $carpeta->portada_path;
        if ($request->hasFile('portada') && $request->file('portada')->isValid()) {
            if ($portadaPath && Storage::disk('public')->exists($portadaPath)) {
                Storage::disk('public')->delete($portadaPath);
            }
            $file = $request->file('portada');
            $safeName = time() . '_portada_' . preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $file->getClientOriginalName());
            $portadaPath = $file->storeAs('capacitaciones/portadas', $safeName, 'public');
        }

        $carpeta->update([
            'nombre' => $data['nombre'],
            'descripcion' => $data['descripcion'] ?? null,
            'color' => $data['color'] ?? $carpeta->color,
            'icono' => $data['icono'] ?? $carpeta->icono,
            'visible_colaborador' => $request->has('visible_colaborador') ? $request->boolean('visible_colaborador') : $carpeta->visible_colaborador,
            'portada_path' => $portadaPath,
        ]);

        return back()->with('status', 'Carpeta actualizada correctamente.');
    }

    public function destroy(CapacitacionCarpeta $carpeta): RedirectResponse
    {
        if ($carpeta->portada_path && Storage::disk('public')->exists($carpeta->portada_path)) {
            Storage::disk('public')->delete($carpeta->portada_path);
        }

        foreach ($carpeta->materiales as $material) {
            if ($material->archivo_path && Storage::disk('public')->exists($material->archivo_path)) {
                Storage::disk('public')->delete($material->archivo_path);
            }
        }

        $carpeta->delete();

        return to_route('capacitaciones.index')->with('status', 'Carpeta eliminada correctamente.');
    }

    /**
     * Guardar o actualizar el banner de la vista de capacitaciones del colaborador.
     * POST /modules/capacitaciones/banner
     */
    public function saveBanner(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'frase'     => ['nullable', 'string', 'max:300'],
            'sub_frase' => ['nullable', 'string', 'max:300'],
            'imagen'    => ['nullable', 'image', 'max:4096'],
        ]);

        $banner = CapacitacionBanner::firstOrNew(['id' => 1]);

        if ($request->hasFile('imagen')) {
            // Eliminar imagen anterior si existe
            if ($banner->imagen_path && Storage::disk('public')->exists($banner->imagen_path)) {
                Storage::disk('public')->delete($banner->imagen_path);
            }
            $banner->imagen_path = $request->file('imagen')->store('capacitaciones/banner', 'public');
        }

        $banner->frase     = $validated['frase'] ?? $banner->frase;
        $banner->sub_frase = $validated['sub_frase'] ?? $banner->sub_frase;
        $banner->updated_by = $request->user()?->id;
        $banner->save();

        return back()->with('status', 'Banner actualizado correctamente.');
    }
}
