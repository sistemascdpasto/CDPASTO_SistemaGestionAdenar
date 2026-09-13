<?php

namespace App\Http\Controllers\Flota;

use App\Http\Controllers\Controller;
use App\Http\Requests\Flota\StoreVehiculoRequest;
use App\Http\Requests\Flota\UpdateVehiculoRequest;
use App\Models\Flota\Vehiculo;
use App\Models\Flota\VehiculoDisponibilidadHistorial;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class VehiculoController extends Controller
{
    /**
     * Campos de documentos (PDF/imagen) almacenados en flota/documentos.
     */
    private const DOCUMENTO_FIELDS = [
        'documento_soat',
        'documento_rtm',
        'documento_codigo_qr',
        'documento_licencia_transito',
    ];

    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();

        $vehiculos = Vehiculo::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('placa', 'like', "%{$search}%")
                        ->orWhere('truck_type', 'like', "%{$search}%")
                        ->orWhere('modelo', 'like', "%{$search}%");
                });
            })
            ->orderBy('placa')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('flota/vehiculos/index', [
            'vehiculos' => $vehiculos,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('flota/vehiculos/create');
    }

    public function store(StoreVehiculoRequest $request): RedirectResponse
    {
        $data = $request->validated();

        foreach (self::DOCUMENTO_FIELDS as $field) {
            unset($data[$field]);
        }

        if ($request->hasFile('imagen')) {
            $data['imagen'] = $request->file('imagen')->store('flota', 'public');
        }

        $vehiculo = Vehiculo::create([
            ...$data,
            'is_active' => $request->boolean('is_active', true),
        ]);

        $this->storeDocuments($request, $vehiculo);

        return to_route('flota.vehiculos.index')->with('status', 'Vehículo creado correctamente.');
    }

    public function show(Vehiculo $vehiculo): Response
    {
        $vehiculoData = $vehiculo->toArray();
        $vehiculoData = [...$vehiculoData, ...$this->documentPaths($vehiculo)];

        return Inertia::render('flota/vehiculos/show', [
            'vehiculo' => $vehiculoData,
        ]);
    }

    public function edit(Vehiculo $vehiculo): Response
    {
        $vehiculoData = $vehiculo->toArray();
        $vehiculoData = [...$vehiculoData, ...$this->documentPaths($vehiculo)];

        return Inertia::render('flota/vehiculos/edit', [
            'vehiculo' => $vehiculoData,
        ]);
    }

    public function update(UpdateVehiculoRequest $request, Vehiculo $vehiculo): RedirectResponse
    {
        $data = $request->validated();

        foreach (self::DOCUMENTO_FIELDS as $field) {
            unset($data[$field]);
        }

        if ($request->hasFile('imagen')) {
            if ($vehiculo->imagen) {
                Storage::disk('public')->delete($vehiculo->imagen);
            }

            $data['imagen'] = $request->file('imagen')->store('flota', 'public');
        }

        $vehiculo->update([
            ...$data,
            'is_active' => $request->boolean('is_active', true),
        ]);

        $this->storeDocuments($request, $vehiculo);

        return to_route('flota.vehiculos.index')->with('status', 'Vehículo actualizado correctamente.');
    }

    /**
     * Botón dedicado en el listado para marcar el vehículo como
     * disponible/no disponible, sin pasar por el formulario de edición.
     * Al marcarlo como no disponible es obligatorio digitar la novedad;
     * cada cambio queda registrado en el historial para los indicadores
     * de disponibilidad.
     */
    public function toggleActivo(Request $request, Vehiculo $vehiculo): RedirectResponse
    {
        $marcandoNoDisponible = $vehiculo->is_active;
        $novedad = null;

        if ($marcandoNoDisponible) {
            $novedad = $request->validate([
                'novedad' => ['required', 'string', 'max:500'],
            ], [
                'novedad.required' => 'Escribe la novedad por la que el vehículo no está disponible.',
            ])['novedad'];
        }

        $vehiculo->update([
            'is_active' => ! $vehiculo->is_active,
            'novedad_no_disponible' => $novedad,
        ]);

        $vehiculo->disponibilidadHistorial()->create([
            'disponible' => $vehiculo->is_active,
            'novedad' => $novedad,
            'user_id' => $request->user()?->id,
        ]);

        return back()->with('status', $vehiculo->is_active ? 'Vehículo marcado como disponible.' : 'Vehículo marcado como no disponible.');
    }

    /**
     * Indicadores de disponibilidad de la flota: snapshot actual, tendencia
     * de cambios de estado y ranking de vehículos con más incidentes, a
     * partir del historial que deja toggleActivo().
     */
    public function indicadores(Request $request): Response
    {
        $desde = $request->input('desde', now()->subMonths(5)->startOfMonth()->toDateString());
        $hasta = $request->input('hasta', now()->toDateString());

        $totalVehiculos = Vehiculo::count();
        $disponibles = Vehiculo::where('is_active', true)->count();
        $noDisponibles = $totalVehiculos - $disponibles;
        $pctDisponibilidad = $totalVehiculos > 0 ? round($disponibles / $totalVehiculos * 100, 1) : 0;

        $historial = VehiculoDisponibilidadHistorial::with('vehiculo:id,placa')
            ->whereDate('created_at', '>=', $desde)
            ->whereDate('created_at', '<=', $hasta)
            ->orderBy('created_at')
            ->get();

        $cambiosPorMes = $historial
            ->groupBy(fn ($h) => $h->created_at->format('Y-m'))
            ->map(fn ($g, $mes) => [
                'mes' => $mes,
                'no_disponible' => $g->where('disponible', false)->count(),
                'disponible' => $g->where('disponible', true)->count(),
            ])
            ->values();

        $eventosNoDisponible = $historial->where('disponible', false);

        $rankingIncidentes = $eventosNoDisponible
            ->groupBy('vehiculo_id')
            ->map(fn ($g) => ['placa' => $g->first()->vehiculo?->placa ?? '—', 'total' => $g->count()])
            ->sortByDesc('total')
            ->take(5)
            ->values();

        $tiempoPromedioNoDisponible = $this->tiempoPromedioNoDisponibleDias($historial);

        $novedadesRecientes = VehiculoDisponibilidadHistorial::with(['vehiculo:id,placa', 'user:id,name'])
            ->where('disponible', false)
            ->whereNotNull('novedad')
            ->latest()
            ->take(10)
            ->get()
            ->map(fn ($h) => [
                'placa' => $h->vehiculo?->placa ?? '—',
                'novedad' => $h->novedad,
                'fecha' => $h->created_at->format('Y-m-d H:i'),
                'usuario' => $h->user?->name,
            ]);

        return Inertia::render('flota/vehiculos/indicadores', [
            'kpis' => [
                'total_vehiculos' => $totalVehiculos,
                'disponibles' => $disponibles,
                'no_disponibles' => $noDisponibles,
                'pct_disponibilidad' => $pctDisponibilidad,
                'cambios_periodo' => $historial->count(),
                'tiempo_promedio_no_disponible' => $tiempoPromedioNoDisponible,
            ],
            'cambios_por_mes' => $cambiosPorMes,
            'ranking_incidentes' => $rankingIncidentes,
            'novedades_recientes' => $novedadesRecientes,
            'filters' => compact('desde', 'hasta'),
        ]);
    }

    /**
     * Empareja cada evento "no disponible" con el siguiente "disponible" del
     * mismo vehículo para estimar cuántos días dura en promedio cada baja.
     *
     * @param  \Illuminate\Support\Collection<int, VehiculoDisponibilidadHistorial>  $historial
     */
    private function tiempoPromedioNoDisponibleDias($historial): ?float
    {
        $duraciones = [];

        foreach ($historial->groupBy('vehiculo_id') as $eventos) {
            $inicioNoDisponible = null;

            foreach ($eventos->sortBy('created_at') as $evento) {
                if (! $evento->disponible) {
                    $inicioNoDisponible = $evento->created_at;
                } elseif ($inicioNoDisponible) {
                    $duraciones[] = $inicioNoDisponible->diffInHours($evento->created_at) / 24;
                    $inicioNoDisponible = null;
                }
            }
        }

        return count($duraciones) > 0 ? round(array_sum($duraciones) / count($duraciones), 1) : null;
    }

    public function destroy(Vehiculo $vehiculo): RedirectResponse
    {
        foreach ($this->documentPaths($vehiculo) as $paths) {
            foreach ($paths as $path) {
                Storage::disk('public')->delete($path['path']);
            }
        }

        $vehiculo->delete();

        return to_route('flota.vehiculos.index')->with('status', 'Vehículo eliminado correctamente.');
    }

    private function storeDocuments(Request $request, Vehiculo $vehiculo): void
    {
        foreach (self::DOCUMENTO_FIELDS as $field) {
            $files = $request->file($field, []);
            $files = is_array($files) ? $files : [$files];

            foreach (array_filter($files) as $file) {
                $vehiculo->documentos()->create([
                    'campo' => $field,
                    'path' => $file->store('flota/documentos', 'public'),
                    'fecha_documento' => now()->toDateString(),
                ]);
            }
        }
    }

    private function documentPaths(Vehiculo $vehiculo): array
    {
        $paths = [];

        foreach (self::DOCUMENTO_FIELDS as $field) {
            $paths[$field] = [];
        }

        foreach ($vehiculo->documentos as $documento) {
            $paths[$documento->campo][] = [
                'path' => $documento->path,
                'fecha' => $documento->fecha_documento?->format('Y-m-d'),
            ];
        }

        return $paths;
    }
}
