<?php

namespace App\Http\Controllers\Flota;

use App\Http\Controllers\Controller;
use App\Http\Requests\Flota\StoreVehiculoRequest;
use App\Http\Requests\Flota\UpdateVehiculoRequest;
use App\Models\Flota\Vehiculo;
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
