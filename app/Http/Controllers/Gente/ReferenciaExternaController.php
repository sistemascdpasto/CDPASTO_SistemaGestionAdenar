<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Services\Seguridad\InstitucionesSenaService;
use App\Services\Seguridad\UbicacionesColombiaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Endpoints JSON de solo lectura que respaldan los selects externos del
 * wizard de colaboradores (HU02, Paso 1). Mantienen las URLs/llamadas a
 * terceros en el servidor en vez de exponerlas al navegador.
 */
class ReferenciaExternaController extends Controller
{
    public function departamentos(UbicacionesColombiaService $service): JsonResponse
    {
        return response()->json(['data' => $service->departamentos()]);
    }

    public function ciudades(Request $request, UbicacionesColombiaService $service): JsonResponse
    {
        $departamentoId = $request->integer('departamento_id');

        if (! $departamentoId) {
            return response()->json(['data' => []]);
        }

        return response()->json(['data' => $service->ciudades($departamentoId)]);
    }

    /**
     * Dado el nombre de una ciudad, devuelve el departamento al que pertenece.
     * Se usa al editar para precargar el campo de departamento.
     */
    public function buscarDepartamento(Request $request, UbicacionesColombiaService $service): JsonResponse
    {
        $request->validate(['ciudad' => ['required', 'string', 'max:100']]);

        $departamento = $service->buscarDepartamentoDeCiudad($request->string('ciudad'));

        return response()->json(['data' => $departamento]);
    }

    public function institucionesSena(InstitucionesSenaService $service): JsonResponse
    {
        return response()->json(['data' => $service->instituciones()]);
    }
}
