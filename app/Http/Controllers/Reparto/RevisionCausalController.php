<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reparto\StoreRevisionCausalRequest;
use App\Models\Reparto\RevisionCausal;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class RevisionCausalController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('reparto/revision-causales/index', [
            'causales' => RevisionCausal::orderBy('orden')->orderBy('nombre')->get(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('reparto/revision-causales/create');
    }

    public function store(StoreRevisionCausalRequest $request): RedirectResponse
    {
        RevisionCausal::create([
            ...$request->validated(),
            'orden' => (RevisionCausal::max('orden') ?? 0) + 1,
        ]);

        return to_route('reparto.revision-causales.index')->with('status', 'Causal creada correctamente.');
    }

    public function edit(RevisionCausal $revisionCausal): Response
    {
        return Inertia::render('reparto/revision-causales/edit', [
            'causal' => $revisionCausal,
        ]);
    }

    public function update(StoreRevisionCausalRequest $request, RevisionCausal $revisionCausal): RedirectResponse
    {
        $revisionCausal->update($request->validated());

        return to_route('reparto.revision-causales.index')->with('status', 'Causal actualizada correctamente.');
    }

    public function toggleActivo(RevisionCausal $revisionCausal): RedirectResponse
    {
        $revisionCausal->update(['is_active' => ! $revisionCausal->is_active]);

        return back()->with('status', $revisionCausal->is_active ? 'Causal activada.' : 'Causal desactivada.');
    }

    public function destroy(RevisionCausal $revisionCausal): RedirectResponse
    {
        try {
            $revisionCausal->delete();
        } catch (QueryException) {
            return back()->with('error', 'No se puede eliminar: esta causal ya está usada en novedades registradas. Desactívala en su lugar.');
        }

        return to_route('reparto.revision-causales.index')->with('status', 'Causal eliminada correctamente.');
    }
}
