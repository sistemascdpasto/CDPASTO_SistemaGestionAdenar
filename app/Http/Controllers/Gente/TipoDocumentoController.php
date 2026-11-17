<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\TipoDocumento;
use App\Models\Seguridad\Colaborador;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class TipoDocumentoController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            TipoDocumento::orderBy('es_personalizado')
                ->orderBy('nombre')
                ->pluck('nombre')
        );
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate(['nombre' => ['required', 'string', 'max:100']]);

        $tipo = TipoDocumento::firstOrCreate(
            ['nombre' => trim($request->string('nombre'))],
            ['es_personalizado' => true],
        );

        return response()->json(['nombre' => $tipo->nombre], 201);
    }

    public function update(Request $request, TipoDocumento $tipoDocumento): RedirectResponse
    {
        $request->validate(['nombre' => ['required', 'string', 'max:100']]);

        $anterior = $tipoDocumento->nombre;
        $tipoDocumento->update(['nombre' => trim($request->nombre)]);

        Colaborador::where('tipo_documento', $anterior)
            ->update(['tipo_documento' => $tipoDocumento->nombre]);

        return back()->with('status', 'Tipo de documento actualizado correctamente.');
    }

    public function destroy(TipoDocumento $tipoDocumento): RedirectResponse
    {
        Colaborador::where('tipo_documento', $tipoDocumento->nombre)
            ->update(['tipo_documento' => null]);

        $tipoDocumento->delete();

        return back()->with('status', 'Tipo de documento eliminado. Los colaboradores que lo usaban quedaron con ese campo vacío.');
    }
}
