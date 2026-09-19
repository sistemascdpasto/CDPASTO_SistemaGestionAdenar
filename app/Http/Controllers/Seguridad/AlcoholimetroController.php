<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seguridad\StoreAlcoholimetroRequest;
use App\Http\Requests\Seguridad\StoreMantenimientoRequest;
use App\Http\Requests\Seguridad\UpdateAlcoholimetroRequest;
use App\Models\Seguridad\Alcoholimetro;
use App\Models\Seguridad\AlcoholimetroDocumento;
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
            ...$request->safe()->except('imagenes', 'documentos', 'mantenimientos'),
        ]);

        // Guardar imágenes
        $imagenes = $request->file('imagenes', []);
        if ($imagenes instanceof \Illuminate\Http\UploadedFile) {
            $imagenes = [$imagenes];
        }
        foreach ($imagenes as $archivo) {
            if ($archivo instanceof \Illuminate\Http\UploadedFile) {
                $dispositivo->imagenes()->create(['path' => $archivo->store('alcoholimetros', 'public')]);
            }
        }

        // Guardar documentos (PDF / Excel)
        $documentos = $request->file('documentos', []);
        if ($documentos instanceof \Illuminate\Http\UploadedFile) {
            $documentos = [$documentos];
        }
        foreach ($documentos as $archivo) {
            if ($archivo instanceof \Illuminate\Http\UploadedFile) {
                $dispositivo->documentos()->create([
                    'path'          => $archivo->store('alcoholimetros/documentos', 'public'),
                    'nombre_original' => $archivo->getClientOriginalName(),
                ]);
            }
        }

        // Guardar mantenimientos enviados con el formulario
        foreach ($request->input('mantenimientos', []) as $m) {
            $dispositivo->mantenimientos()->create([
                'fecha'       => $m['fecha'],
                'descripcion' => $m['descripcion'],
                'realizado_por' => $request->user()->id,
            ]);
        }

        return to_route('seguridad.dispositivos.show', $dispositivo)->with('status', 'Dispositivo registrado correctamente.');
    }

    public function show(Alcoholimetro $dispositivo): Response
    {
        $dispositoData = $dispositivo->toArray();
        $dispositoData['imagenes_paths'] = $dispositivo->imagenes()->pluck('path')->map(fn($path) => '/storage/' . $path)->toArray();
        $dispositoData['documentos_paths'] = $dispositivo->documentos()->get()->map(fn($d) => [
            'id'              => $d->id,
            'url'             => '/storage/' . $d->path,
            'nombre_original' => $d->nombre_original ?? basename($d->path),
        ])->toArray();
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
        $dispositoData['documentos_paths'] = $dispositivo->documentos()->get()->map(fn($d) => [
            'id'              => $d->id,
            'url'             => '/storage/' . $d->path,
            'nombre_original' => $d->nombre_original ?? basename($d->path),
        ])->toArray();
        // Formatear fechas como yyyy-MM-dd para que funcionen en <input type="date">
        $dispositoData['fecha_calibracion'] = $dispositivo->fecha_calibracion?->toDateString();
        $dispositoData['fecha_vencimiento_certificado'] = $dispositivo->fecha_vencimiento_certificado?->toDateString();

        return Inertia::render('seguridad/dispositivos/edit', [
            'dispositivo' => $dispositoData,
            'mantenimientos' => $dispositivo->mantenimientos()->with('realizadoPor:id,name')->get()
                ->map(fn ($m) => [
                    'id'          => $m->id,
                    'fecha'       => $m->fecha?->toDateString(),
                    'descripcion' => $m->descripcion,
                    'realizado_por' => $m->realizadoPor?->name,
                ]),
        ]);
    }

    public function update(UpdateAlcoholimetroRequest $request, Alcoholimetro $dispositivo): RedirectResponse
    {
        $dispositivo->update([
            ...$request->safe()->except('imagenes', 'deleted_imagenes_indices', 'documentos', 'deleted_documentos_indices', 'mantenimientos'),
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
        $imagenes = $request->file('imagenes', []);
        if ($imagenes instanceof \Illuminate\Http\UploadedFile) {
            $imagenes = [$imagenes];
        }
        foreach ($imagenes as $archivo) {
            if ($archivo instanceof \Illuminate\Http\UploadedFile) {
                $dispositivo->imagenes()->create(['path' => $archivo->store('alcoholimetros', 'public')]);
            }
        }

        // Eliminar documentos marcados para eliminación
        $deletedDocIndices = $request->input('deleted_documentos_indices', []);
        if (!empty($deletedDocIndices)) {
            $documentos = $dispositivo->documentos()->get();
            foreach ($deletedDocIndices as $index) {
                if (isset($documentos[$index])) {
                    $doc = $documentos[$index];
                    Storage::disk('public')->delete($doc->path);
                    $doc->delete();
                }
            }
        }

        // Agregar nuevos documentos
        $documentos = $request->file('documentos', []);
        if ($documentos instanceof \Illuminate\Http\UploadedFile) {
            $documentos = [$documentos];
        }
        foreach ($documentos as $archivo) {
            if ($archivo instanceof \Illuminate\Http\UploadedFile) {
                $dispositivo->documentos()->create([
                    'path'            => $archivo->store('alcoholimetros/documentos', 'public'),
                    'nombre_original' => $archivo->getClientOriginalName(),
                ]);
            }
        }

        // Guardar mantenimientos nuevos enviados con el formulario
        foreach ($request->input('mantenimientos', []) as $m) {
            $dispositivo->mantenimientos()->create([
                'fecha'        => $m['fecha'],
                'descripcion'  => $m['descripcion'],
                'realizado_por' => $request->user()->id,
            ]);
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
