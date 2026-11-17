<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\Cargo;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorCargo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CargoController extends Controller
{
    public function update(Request $request, Cargo $cargo): RedirectResponse
    {
        $request->validate(['nombre' => ['required', 'string', 'max:100']]);

        $anterior = $cargo->nombre;
        $cargo->update(['nombre' => trim($request->nombre)]);

        // Propagar el nuevo nombre a colaboradores y su historial de cargos
        Colaborador::where('cargo', $anterior)->update(['cargo' => $cargo->nombre]);
        ColaboradorCargo::where('cargo', $anterior)->update(['cargo' => $cargo->nombre]);

        return back()->with('status', 'Cargo actualizado correctamente.');
    }

    public function destroy(Cargo $cargo): RedirectResponse
    {
        // Deja el campo vacío — no rompe FK porque es string libre
        Colaborador::where('cargo', $cargo->nombre)->update(['cargo' => null]);
        ColaboradorCargo::where('cargo', $cargo->nombre)->update(['cargo' => '']);

        $cargo->delete();

        return back()->with('status', 'Cargo eliminado. Los colaboradores que lo usaban quedaron con ese campo vacío.');
    }
}
