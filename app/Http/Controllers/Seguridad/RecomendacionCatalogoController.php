<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Models\Seguridad\Recomendacion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RecomendacionCatalogoController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('seguridad/examenes-medicos/recomendaciones', [
            'recomendaciones' => Recomendacion::orderBy('categoria')->orderBy('nombre')->get(),
            'categorias' => config('gente.examenes_medicos.recomendaciones.categorias'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:255', 'unique:recomendaciones,nombre'],
            'categoria' => ['required', Rule::in(array_keys(config('gente.examenes_medicos.recomendaciones.categorias')))],
        ]);

        Recomendacion::create($data);

        return back()->with('status', 'Recomendación creada correctamente.');
    }

    public function update(Request $request, Recomendacion $recomendacion): RedirectResponse
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:255', Rule::unique('recomendaciones', 'nombre')->ignore($recomendacion->id)],
            'categoria' => ['required', Rule::in(array_keys(config('gente.examenes_medicos.recomendaciones.categorias')))],
            'activo' => ['required', 'boolean'],
        ]);

        $recomendacion->update($data);

        return back()->with('status', 'Recomendación actualizada correctamente.');
    }
}
