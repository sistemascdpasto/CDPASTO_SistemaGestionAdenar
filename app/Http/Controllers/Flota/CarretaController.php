<?php

namespace App\Http\Controllers\Flota;

use App\Http\Controllers\Controller;
use App\Http\Requests\Flota\StoreCarretaRequest;
use App\Http\Requests\Flota\UpdateCarretaRequest;
use App\Models\Flota\Carreta;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CarretaController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();

        $carretas = Carreta::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('placa', 'like', "%{$search}%")
                        ->orWhere('tipo', 'like', "%{$search}%");
                });
            })
            ->orderBy('placa')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('flota/carretas/index', [
            'carretas' => $carretas,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('flota/carretas/create');
    }

    public function store(StoreCarretaRequest $request): RedirectResponse
    {
        Carreta::create([
            ...$request->validated(),
            'is_active' => $request->boolean('is_active', true),
        ]);

        return to_route('flota.carretas.index')->with('status', 'Carreta creada correctamente.');
    }

    public function edit(Carreta $carreta): Response
    {
        return Inertia::render('flota/carretas/edit', [
            'carreta' => $carreta,
        ]);
    }

    public function update(UpdateCarretaRequest $request, Carreta $carreta): RedirectResponse
    {
        $carreta->update([
            ...$request->validated(),
            'is_active' => $request->boolean('is_active', true),
        ]);

        return to_route('flota.carretas.index')->with('status', 'Carreta actualizada correctamente.');
    }

    /**
     * Botón dedicado en el listado para marcar la carreta como
     * disponible/no disponible, sin pasar por el formulario de edición.
     * Al marcarla como no disponible es obligatorio digitar la novedad;
     * cada cambio queda registrado en el historial.
     */
    public function toggleActivo(Request $request, Carreta $carreta): RedirectResponse
    {
        $marcandoNoDisponible = $carreta->is_active;
        $novedad = null;

        if ($marcandoNoDisponible) {
            $novedad = $request->validate([
                'novedad' => ['required', 'string', 'max:500'],
            ], [
                'novedad.required' => 'Escribe la novedad por la que la carreta no está disponible.',
            ])['novedad'];
        }

        $carreta->update([
            'is_active' => ! $carreta->is_active,
            'novedad_no_disponible' => $novedad,
        ]);

        $carreta->disponibilidadHistorial()->create([
            'disponible' => $carreta->is_active,
            'novedad' => $novedad,
            'user_id' => $request->user()?->id,
        ]);

        return back()->with('status', $carreta->is_active ? 'Carreta marcada como disponible.' : 'Carreta marcada como no disponible.');
    }

    public function destroy(Carreta $carreta): RedirectResponse
    {
        $carreta->delete();

        return to_route('flota.carretas.index')->with('status', 'Carreta eliminada correctamente.');
    }
}
