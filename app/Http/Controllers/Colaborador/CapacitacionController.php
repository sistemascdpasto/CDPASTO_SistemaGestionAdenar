<?php

namespace App\Http\Controllers\Colaborador;

use App\Http\Controllers\Controller;
use App\Models\Capacitaciones\CapacitacionBanner;
use App\Models\Capacitaciones\CapacitacionCarpeta;
use App\Models\Capacitaciones\CapacitacionMaterial;
use App\Models\Capacitaciones\CapacitacionRevision;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CapacitacionController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $userId = $user->id;
        $buscar = $request->query('buscar');

        // 1. Carpetas dinámicas con cálculo eficiente de materiales y revisados (solo raíz, visibles y ordenadas de forma ascendente)
        $carpetas = CapacitacionCarpeta::query()
            ->whereNull('parent_id')
            ->where('visible_colaborador', true)
            ->withCount([
                'materiales as total_materiales' => fn ($q) => $q->where('estado', 'publicado'),
                'materiales as revisados_count' => fn ($q) => $q->where('estado', 'publicado')
                    ->whereHas('revisiones', fn ($r) => $r->where('user_id', $userId)),
            ])
            ->orderBy('nombre', 'asc')
            ->get()
            ->map(function ($carpeta) {
                $total = $carpeta->total_materiales ?? 0;
                $revisados = $carpeta->revisados_count ?? 0;
                $porcentaje = $total > 0 ? (int) round(($revisados / $total) * 100) : 0;
                $completada = $total > 0 && $revisados >= $total;

                return [
                    'id' => $carpeta->id,
                    'nombre' => $carpeta->nombre,
                    'descripcion' => $carpeta->descripcion,
                    'color' => $carpeta->color ?? '#0D9488',
                    'icono' => $carpeta->icono ?? 'folder',
                    'portada_url' => $carpeta->portada_url,
                    'total_materiales' => $total,
                    'revisados_count' => $revisados,
                    'porcentaje' => $porcentaje,
                    'completada' => $completada,
                ];
            });

        // 2. Progreso general según regla de negocio:
        // Una carpeta solo cuenta como completada si tiene materiales y se revisaron al 100%.
        $totalCategorias = $carpetas->filter(fn ($c) => $c['total_materiales'] > 0)->count();
        $categoriasCompletadas = $carpetas->filter(fn ($c) => $c['completada'])->count();
        $progresoGeneral = $totalCategorias > 0
            ? (int) round(($categoriasCompletadas / $totalCategorias) * 100)
            : 0;

        // 3. Capacitaciones destacadas (campo booleano en base de datos)
        $destacadas = CapacitacionMaterial::query()
            ->with('carpeta:id,nombre,color')
            ->where('estado', 'publicado')
            ->where('destacada', true)
            ->withExists(['revisiones as revisada' => fn ($r) => $r->where('user_id', $userId)])
            ->latest('id')
            ->take(6)
            ->get();

        // 4. Capacitaciones recientes consultadas por el usuario actual
        $recientes = CapacitacionRevision::query()
            ->where('user_id', $userId)
            ->with(['material' => function ($q) {
                $q->with('carpeta:id,nombre,color');
            }])
            ->latest('revisada_at')
            ->take(8)
            ->get()
            ->map(function ($rev) {
                $mat = $rev->material;
                if (! $mat) {
                    return null;
                }

                return [
                    'id' => $mat->id,
                    'titulo' => $mat->titulo,
                    'descripcion' => $mat->descripcion,
                    'tipo' => $mat->tipo,
                    'tamano_humano' => $mat->tamano_humano,
                    'archivo_path' => $mat->archivo_path ? Storage::url($mat->archivo_path) : null,
                    'enlace_externo' => $mat->enlace_externo,
                    'carpeta' => $mat->carpeta,
                    'revisada' => true,
                    'revisada_at' => $rev->revisada_at->toIso8601String(),
                    'revisada_humano' => $rev->revisada_at->diffForHumans(),
                ];
            })
            ->filter()
            ->values();

        // 5. Búsqueda dinámica global (carpetas, títulos y descripciones de capacitación)
        $resultadosBusqueda = null;
        if (! empty($buscar)) {
            $resultadosBusqueda = CapacitacionMaterial::query()
                ->with('carpeta:id,nombre,color')
                ->where('estado', 'publicado')
                ->where(function ($q) use ($buscar) {
                    $q->where('titulo', 'like', "%{$buscar}%")
                      ->orWhere('descripcion', 'like', "%{$buscar}%")
                      ->orWhereHas('carpeta', fn ($c) => $c->where('nombre', 'like', "%{$buscar}%"));
                })
                ->withExists(['revisiones as revisada' => fn ($r) => $r->where('user_id', $userId)])
                ->latest('id')
                ->get()
                ->map(fn ($mat) => [
                    'id' => $mat->id,
                    'titulo' => $mat->titulo,
                    'descripcion' => $mat->descripcion,
                    'tipo' => $mat->tipo,
                    'tamano_humano' => $mat->tamano_humano,
                    'archivo_url' => $mat->archivo_path ? Storage::url($mat->archivo_path) : null,
                    'enlace_externo' => $mat->enlace_externo,
                    'carpeta' => $mat->carpeta,
                    'revisada' => (bool) $mat->revisada,
                ]);
        }

        return Inertia::render('colaborador/capacitaciones/index', [
            'carpetas' => $carpetas,
            'progreso' => [
                'total_categorias' => $totalCategorias,
                'categorias_completadas' => $categoriasCompletadas,
                'porcentaje_general' => $progresoGeneral,
            ],
            'destacadas' => $destacadas,
            'recientes' => $recientes,
            'resultadosBusqueda' => $resultadosBusqueda,
            'banner' => CapacitacionBanner::actual()->only(['frase', 'sub_frase', 'imagen_url']),
            'filters' => [
                'buscar' => $buscar ?? '',
            ],
        ]);
    }

    public function showCarpeta(Request $request, CapacitacionCarpeta $carpeta): Response
    {
        $userId = $request->user()->id;
        $buscar = $request->query('buscar');

        // Subcarpetas de la carpeta actual (visibles y ordenadas de forma ascendente)
        $subcarpetas = $carpeta->subcarpetas()
            ->where('visible_colaborador', true)
            ->withCount([
                'materiales as total_materiales' => fn ($q) => $q->where('estado', 'publicado'),
                'materiales as revisados_count' => fn ($q) => $q->where('estado', 'publicado')
                    ->whereHas('revisiones', fn ($r) => $r->where('user_id', $userId)),
            ])
            ->orderBy('nombre', 'asc')
            ->get()
            ->map(function ($sub) {
                $total = $sub->total_materiales ?? 0;
                $revisados = $sub->revisados_count ?? 0;
                $porcentaje = $total > 0 ? (int) round(($revisados / $total) * 100) : 0;
                $completada = $total > 0 && $revisados >= $total;

                return [
                    'id' => $sub->id,
                    'nombre' => $sub->nombre,
                    'descripcion' => $sub->descripcion,
                    'color' => $sub->color ?? '#0D9488',
                    'portada_url' => $sub->portada_url,
                    'total_materiales' => $total,
                    'revisados_count' => $revisados,
                    'porcentaje' => $porcentaje,
                    'completada' => $completada,
                ];
            });

        $materiales = $carpeta->materiales()
            ->where('estado', 'publicado')
            ->withExists(['revisiones as revisada' => fn ($r) => $r->where('user_id', $userId)])
            ->when($buscar, function ($q, $texto) {
                $q->where('titulo', 'like', "%{$texto}%")
                  ->orWhere('descripcion', 'like', "%{$texto}%");
            })
            ->orderBy('orden')
            ->latest('id')
            ->get()
            ->map(function ($mat) {
                return [
                    'id' => $mat->id,
                    'titulo' => $mat->titulo,
                    'descripcion' => $mat->descripcion,
                    'tipo' => $mat->tipo,
                    'archivo_path' => $mat->archivo_path,
                    'archivo_url' => $mat->archivo_path ? Storage::url($mat->archivo_path) : null,
                    'archivo_nombre_original' => $mat->archivo_nombre_original,
                    'tamano_humano' => $mat->tamano_humano,
                    'mime_type' => $mat->mime_type,
                    'enlace_externo' => $mat->enlace_externo,
                    'revisada' => (bool) $mat->revisada,
                    'created_at' => $mat->created_at->toIso8601String(),
                ];
            });

        $total = $materiales->count();
        $revisados = $materiales->where('revisada', true)->count();
        $porcentaje = $total > 0 ? (int) round(($revisados / $total) * 100) : 0;

        return Inertia::render('colaborador/capacitaciones/show', [
            'carpeta' => [
                'id' => $carpeta->id,
                'nombre' => $carpeta->nombre,
                'descripcion' => $carpeta->descripcion,
                'color' => $carpeta->color ?? '#0D9488',
                'portada_url' => $carpeta->portada_url,
                'total_materiales' => $total,
                'revisados_count' => $revisados,
                'porcentaje' => $porcentaje,
                'completada' => $total > 0 && $revisados >= $total,
            ],
            'subcarpetas' => $subcarpetas,
            'ancestros' => $carpeta->getAncestros(),
            'materiales' => $materiales,
            'filters' => [
                'buscar' => $buscar ?? '',
            ],
        ]);
    }

    public function marcarRevisada(Request $request, CapacitacionMaterial $material): RedirectResponse
    {
        CapacitacionRevision::firstOrCreate(
            ['user_id' => $request->user()->id, 'material_id' => $material->id],
            ['revisada_at' => now()]
        );

        return back()->with('status', 'Capacitación marcada como revisada.');
    }

    public function descargar(Request $request, CapacitacionMaterial $material): StreamedResponse|RedirectResponse
    {
        if (! $material->archivo_path || ! Storage::disk('public')->exists($material->archivo_path)) {
            return back()->with('status', [
                'type' => 'error',
                'message' => 'El archivo no se encuentra disponible.',
            ]);
        }

        // Registrar revisión automáticamente al descargar
        CapacitacionRevision::firstOrCreate(
            ['user_id' => $request->user()->id, 'material_id' => $material->id],
            ['revisada_at' => now()]
        );

        return Storage::disk('public')->download($material->archivo_path, $material->archivo_nombre_original ?? 'archivo');
    }
}
