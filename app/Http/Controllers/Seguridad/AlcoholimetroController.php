<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seguridad\StoreAlcoholimetroRequest;
use App\Http\Requests\Seguridad\StoreMantenimientoRequest;
use App\Http\Requests\Seguridad\UpdateAlcoholimetroRequest;
use App\Models\Seguridad\Alcoholimetro;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class AlcoholimetroController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();

        $dispositivos = Alcoholimetro::query()
            ->when($search !== '', fn ($query) => $query->where(function ($query) use ($search) {
                $query->where('codigo', 'like', "%{$search}%")
                    ->orWhere('marca', 'like', "%{$search}%")
                    ->orWhere('modelo', 'like', "%{$search}%");
            }))
            ->orderBy('codigo')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Alcoholimetro $dispositivo) => [
                'id' => $dispositivo->id,
                'codigo' => $dispositivo->codigo,
                'marca' => $dispositivo->marca,
                'modelo' => $dispositivo->modelo,
                'estado' => $dispositivo->estado,
                'fecha_calibracion' => $dispositivo->fecha_calibracion?->toDateString(),
                'fecha_vencimiento_certificado' => $dispositivo->fecha_vencimiento_certificado?->toDateString(),
                'calibracion_proxima' => $dispositivo->calibracionProxima(),
            ]);

        return Inertia::render('seguridad/dispositivos/index', [
            'dispositivos' => $dispositivos,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('seguridad/dispositivos/create');
    }

    public function store(StoreAlcoholimetroRequest $request): RedirectResponse
    {
        $dispositivo = Alcoholimetro::create([
            ...$request->safe()->except('imagenes'),
        ]);

        // Guardar imágenes
        foreach ($request->file('imagenes', []) as $archivo) {
            $dispositivo->imagenes()->create(['path' => $archivo->store('alcoholimetros', 'public')]);
        }

        return to_route('seguridad.dispositivos.show', $dispositivo)->with('status', 'Dispositivo registrado correctamente.');
    }

    public function show(Alcoholimetro $dispositivo): Response
    {
        $dispositoData = $dispositivo->toArray();
        $dispositoData['imagenes_paths'] = $dispositivo->imagenes()->pluck('path')->map(fn($path) => '/storage/' . $path)->toArray();
        $dispositoData['fecha_calibracion'] = $dispositivo->fecha_calibracion?->toDateString();
        $dispositoData['fecha_vencimiento_certificado'] = $dispositivo->fecha_vencimiento_certificado?->toDateString();

        return Inertia::render('seguridad/dispositivos/show', [
            'dispositivo' => [
                ...$dispositoData,
                'calibracion_proxima' => $dispositivo->calibracionProxima(),
            ],
            'mantenimientos' => $dispositivo->mantenimientos()->with('realizadoPor:id,name')->get(),
        ]);
    }

    public function edit(Alcoholimetro $dispositivo): Response
    {
        $dispositoData = $dispositivo->toArray();
        $dispositoData['imagenes_paths'] = $dispositivo->imagenes()->pluck('path')->map(fn($path) => '/storage/' . $path)->toArray();
        // Formatear fechas como yyyy-MM-dd para que funcionen en <input type="date">
        $dispositoData['fecha_calibracion'] = $dispositivo->fecha_calibracion?->toDateString();
        $dispositoData['fecha_vencimiento_certificado'] = $dispositivo->fecha_vencimiento_certificado?->toDateString();

        return Inertia::render('seguridad/dispositivos/edit', [
            'dispositivo' => $dispositoData,
        ]);
    }

    public function update(UpdateAlcoholimetroRequest $request, Alcoholimetro $dispositivo): RedirectResponse
    {
        $dispositivo->update([
            ...$request->safe()->except('imagenes', 'deleted_imagenes_indices'),
        ]);

        // Eliminar imágenes marcadas para eliminación
        $deletedIndices = $request->input('deleted_imagenes_indices', []);
        if (!empty($deletedIndices)) {
            $imagenes = $dispositivo->imagenes()->get();
            foreach ($deletedIndices as $index) {
                if (isset($imagenes[$index])) {
                    $imagen = $imagenes[$index];
                    Storage::disk('public')->delete($imagen->path);
                    $imagen->delete();
                }
            }
        }

        // Agregar nuevas imágenes
        foreach ($request->file('imagenes', []) as $archivo) {
            $dispositivo->imagenes()->create(['path' => $archivo->store('alcoholimetros', 'public')]);
        }

        return to_route('seguridad.dispositivos.index')->with('status', 'Dispositivo actualizado correctamente.');
    }

    public function destroy(Alcoholimetro $dispositivo): RedirectResponse
    {
        $dispositivo->delete();

        return to_route('seguridad.dispositivos.index')->with('status', 'Dispositivo eliminado correctamente.');
    }

    public function storeMantenimiento(StoreMantenimientoRequest $request, Alcoholimetro $dispositivo): RedirectResponse
    {
        $dispositivo->mantenimientos()->create([
            ...$request->validated(),
            'realizado_por' => $request->user()->id,
        ]);

        return back()->with('status', 'Mantenimiento registrado correctamente.');
    }
}
