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
            ...$request->safe()->except('documento', 'documentos', 'imagenes'),
            'documento_path' => $request->file('documento')?->store('dispositivos', 'public'),
        ]);

        // Guardar imágenes
        foreach ($request->file('imagenes', []) as $archivo) {
            $dispositivo->imagenes()->create(['path' => $archivo->store('alcoholimetros', 'public')]);
        }

        $this->storeDocumentos($request, $dispositivo);

        return to_route('seguridad.dispositivos.show', $dispositivo)->with('status', 'Dispositivo registrado correctamente.');
    }

    public function show(Alcoholimetro $dispositivo): Response
    {
        $dispositoData = $dispositivo->toArray();
        $dispositoData['imagenes_paths'] = $dispositivo->imagenes()->pluck('path')->map(fn($path) => '/storage/' . $path)->toArray();
        $dispositoData['documentos_paths'] = $this->documentPaths($dispositivo);
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
        $dispositoData['documentos_paths'] = $this->documentPaths($dispositivo);
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
            ...$request->safe()->except('documento', 'documentos', 'imagenes', 'deleted_imagenes_indices', 'deleted_documentos_indices'),
            'documento_path' => $request->file('documento')?->store('dispositivos', 'public') ?? $dispositivo->documento_path,
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

        // Eliminar documentos marcados para eliminación (solo los de la tabla relacional)
        $deletedDocumentosIndices = $request->input('deleted_documentos_indices', []);
        if (!empty($deletedDocumentosIndices)) {
            $documentos = $dispositivo->documentos()->get();
            foreach ($deletedDocumentosIndices as $index) {
                if (isset($documentos[$index])) {
                    $documento = $documentos[$index];
                    Storage::disk('public')->delete($documento->path);
                    $documento->delete();
                }
            }
        }

        $this->storeDocumentos($request, $dispositivo);

        return to_route('seguridad.dispositivos.index')->with('status', 'Dispositivo actualizado correctamente.');
    }

    public function destroy(Alcoholimetro $dispositivo): RedirectResponse
    {
        $dispositivo->delete();

        return to_route('seguridad.dispositivos.index')->with('status', 'Dispositivo eliminado correctamente.');
    }

    private function storeDocumentos(Request $request, Alcoholimetro $dispositivo): void
    {
        $archivos = [];

        if ($request->hasFile('documento')) {
            $doc = $request->file('documento');
            if ($doc && $doc->isValid()) {
                $archivos[] = $doc;
            }
        }

        $docs = $request->file('documentos', []);
        if (!is_array($docs)) {
            $docs = [$docs];
        }

        foreach ($docs as $doc) {
            if ($doc && $doc->isValid()) {
                $archivos[] = $doc;
            }
        }

        foreach ($archivos as $archivo) {
            $path = $archivo->store('dispositivos/documentos', 'public');
            $dispositivo->documentos()->create(['path' => $path]);

            if (!$dispositivo->documento_path) {
                $dispositivo->update(['documento_path' => $path]);
            }
        }
    }

    /**
     * Rutas de los documentos subidos con el sistema nuevo (tabla
     * `alcoholimetro_documentos`, uno o varios). El documento legado de una
     * sola columna (`documento_path`) se muestra aparte porque no es
     * borrable individualmente por indice (solo se reemplaza como un todo).
     *
     * @return array<int, array{path: string, nombre: string}>
     */
    private function documentPaths(Alcoholimetro $dispositivo): array
    {
        return $dispositivo->documentos->map(fn ($documento) => [
            'path' => '/storage/' . $documento->path,
            'nombre' => basename($documento->path),
        ])->all();
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
