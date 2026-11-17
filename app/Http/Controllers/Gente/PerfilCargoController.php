<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\PerfilCargo;
use App\Models\Seguridad\ColaboradorCargo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class PerfilCargoController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'nombre'       => ['required', 'string', 'max:150', 'unique:perfiles_cargos,nombre'],
            'observaciones' => ['required', 'string', 'max:5000'],
        ]);

        PerfilCargo::create($request->only('nombre', 'observaciones'));

        return back()->with('status', 'Perfil de cargo agregado correctamente.');
    }

    public function update(Request $request, PerfilCargo $perfilCargo): RedirectResponse
    {
        $request->validate([
            'nombre'       => ['required', 'string', 'max:150'],
            'observaciones' => ['required', 'string', 'max:5000'],
        ]);

        $nombreAnterior = $perfilCargo->nombre;
        $perfilCargo->update($request->only('nombre', 'observaciones'));

        // Propagar cambios al historial de cargos
        ColaboradorCargo::where('perfil_nombre', $nombreAnterior)
            ->update([
                'perfil_nombre' => $perfilCargo->nombre,
                'perfil'        => $perfilCargo->observaciones,
            ]);

        return back()->with('status', 'Perfil actualizado correctamente.');
    }

    public function destroy(PerfilCargo $perfilCargo): RedirectResponse
    {
        // Deja el perfil vacío en el historial — datos históricos se conservan como texto
        ColaboradorCargo::where('perfil_nombre', $perfilCargo->nombre)
            ->update(['perfil_nombre' => null]);

        $perfilCargo->delete();

        return back()->with('status', 'Perfil eliminado. El texto de funciones se conserva en el historial existente.');
    }
}
