<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\TipoDocumento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TipoDocumentoController extends Controller
{
    /**
     * Lista todos los tipos de documento (base + personalizados),
     * devuelve solo los nombres ordenados.
     */
    public function index(): JsonResponse
    {
        $nombres = TipoDocumento::orderBy('es_personalizado')
            ->orderBy('nombre')
            ->pluck('nombre');

        return response()->json($nombres);
    }

    /**
     * Crea un nuevo tipo de documento personalizado si no existe ya.
     * Devuelve el nombre normalizado para que el select lo seleccione.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'nombre' => ['required', 'string', 'max:100'],
        ]);

        $nombre = trim($request->string('nombre'));

        $tipo = TipoDocumento::firstOrCreate(
            ['nombre' => $nombre],
            ['es_personalizado' => true]
        );

        return response()->json(['nombre' => $tipo->nombre], 201);
    }
}
