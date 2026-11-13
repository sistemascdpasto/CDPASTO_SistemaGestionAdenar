<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\PerfilCargo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class PerfilCargoController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:150', 'unique:perfiles_cargos,nombre'],
            'observaciones' => ['required', 'string', 'max:5000'],
        ]);

        PerfilCargo::create($validated);

        return back()->with('status', 'Perfil de cargo agregado correctamente.');
    }
}
