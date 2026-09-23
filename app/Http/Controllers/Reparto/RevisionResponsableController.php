<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reparto\StoreRevisionResponsableRequest;
use App\Models\Reparto\RevisionResponsable;
use App\Models\Seguridad\Colaborador;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class RevisionResponsableController extends Controller
{
    public function index(): Response
    {
        $responsables = RevisionResponsable::with('colaborador:id,cedula,nombres,apellidos,cargo')
            ->get()
            ->map(fn (RevisionResponsable $r) => [
                'id' => $r->id,
                'is_active' => $r->is_active,
                'colaborador' => [
                    'id' => $r->colaborador?->id,
                    'nombre_completo' => trim(($r->colaborador?->nombres ?? '').' '.($r->colaborador?->apellidos ?? '')),
                    'cedula' => $r->colaborador?->cedula,
                    'cargo' => $r->colaborador?->cargo,
                ],
            ]);

        return Inertia::render('reparto/revision-responsables/index', [
            'responsables' => $responsables,
        ]);
    }

    public function create(): Response
    {
        $yaAgregados = RevisionResponsable::pluck('colaborador_id');

        $colaboradores = Colaborador::where('is_active', true)
            ->whereNotIn('id', $yaAgregados)
            ->orderBy('nombres')
            ->get(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'turno']);

        return Inertia::render('reparto/revision-responsables/create', [
            'colaboradores' => $colaboradores,
        ]);
    }

    public function store(StoreRevisionResponsableRequest $request): RedirectResponse
    {
        RevisionResponsable::create([
            ...$request->validated(),
            'is_active' => true,
            'created_by' => $request->user()->id,
        ]);

        return to_route('reparto.revision-responsables.index')->with('status', 'Responsable agregado a la ruleta.');
    }

    public function toggleActivo(RevisionResponsable $revisionResponsable): RedirectResponse
    {
        $revisionResponsable->update(['is_active' => ! $revisionResponsable->is_active]);

        return back()->with('status', $revisionResponsable->is_active ? 'Responsable activado.' : 'Responsable desactivado.');
    }

    public function destroy(RevisionResponsable $revisionResponsable): RedirectResponse
    {
        $revisionResponsable->delete();

        return to_route('reparto.revision-responsables.index')->with('status', 'Responsable quitado de la ruleta.');
    }
}
