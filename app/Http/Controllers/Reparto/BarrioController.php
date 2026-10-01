<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Models\Reparto\ModulacionBarrio;
use App\Models\Reparto\ModulacionMunicipio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class BarrioController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $municipioId = $request->string('municipio_id')->trim()->toString();

        $barrios = ModulacionBarrio::query()
            ->with('municipio')
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($q2) use ($search) {
                    $q2->where('nombre', 'like', "%{$search}%")
                        ->orWhere('codigo', 'like', "%{$search}%");
                });
            })
            ->when($municipioId !== '', fn ($q) => $q->where('municipio_id', $municipioId))
            ->orderBy('municipio_id')
            ->orderBy('nombre')
            ->paginate(50)
            ->withQueryString();

        $municipios = ModulacionMunicipio::orderBy('nombre')->get(['id', 'nombre']);

        return Inertia::render('reparto/barrios/index', [
            'barrios'    => $barrios,
            'municipios' => $municipios,
            'filters'    => ['search' => $search, 'municipio_id' => $municipioId],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'municipio_id' => ['required', 'exists:modulacion_municipios,id'],
            'nombre'       => ['required', 'string', 'max:200'],
            'codigo'       => ['nullable', 'string', 'max:30'],
        ]);

        $normalizado = $this->normalizar($data['nombre']);

        $existe = ModulacionBarrio::where('municipio_id', $data['municipio_id'])
            ->where('nombre_normalizado', $normalizado)
            ->exists();

        if ($existe) {
            return back()->with('error', 'Ya existe un barrio con ese nombre en el municipio seleccionado.');
        }

        ModulacionBarrio::create([
            'municipio_id'      => $data['municipio_id'],
            'nombre'            => trim($data['nombre']),
            'codigo'            => isset($data['codigo']) ? trim($data['codigo']) : null,
            'nombre_normalizado' => $normalizado,
            'origen'            => 'manual',
        ]);

        return back()->with('status', 'Barrio registrado correctamente.');
    }

    public function update(Request $request, ModulacionBarrio $barrio): RedirectResponse
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:200'],
            'codigo' => ['nullable', 'string', 'max:30'],
        ]);

        $normalizado = $this->normalizar($data['nombre']);

        $duplicado = ModulacionBarrio::where('municipio_id', $barrio->municipio_id)
            ->where('nombre_normalizado', $normalizado)
            ->where('id', '!=', $barrio->id)
            ->exists();

        if ($duplicado) {
            return back()->with('error', 'Ya existe un barrio con ese nombre en el municipio.');
        }

        $barrio->update([
            'nombre'             => trim($data['nombre']),
            'codigo'             => isset($data['codigo']) ? trim($data['codigo']) : null,
            'nombre_normalizado' => $normalizado,
        ]);

        return back()->with('status', 'Barrio actualizado correctamente.');
    }

    public function destroy(ModulacionBarrio $barrio): RedirectResponse
    {
        $barrio->delete();

        return back()->with('status', 'Barrio eliminado correctamente.');
    }

    private function normalizar(string $nombre): string
    {
        return mb_strtolower(
            str_replace(
                ['á','é','í','ó','ú','ü','ñ','Á','É','Í','Ó','Ú','Ü','Ñ'],
                ['a','e','i','o','u','u','n','a','e','i','o','u','u','n'],
                trim(preg_replace('/\s+/u', ' ', $nombre) ?? $nombre)
            )
        );
    }
}
