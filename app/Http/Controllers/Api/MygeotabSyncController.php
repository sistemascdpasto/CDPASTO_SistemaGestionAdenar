<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\SincronizarMygeotabKmRequest;
use App\Services\Flota\MygeotabKilometrosSyncService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class MygeotabSyncController extends Controller
{
    /**
     * Disparado por una tarea programada en la PC local (no hay worker de
     * cola ni scheduler confiable corriendo esto en Railway — ver memoria
     * del proyecto). Por defecto sincroniza "ayer" (el día ya cerrado al
     * momento en que corre la tarea cada mañana); acepta 'fecha' para
     * backfill manual de un día específico.
     */
    public function store(SincronizarMygeotabKmRequest $request, MygeotabKilometrosSyncService $servicio): JsonResponse
    {
        $fecha = $request->validated('fecha')
            ? Carbon::createFromFormat('Y-m-d', $request->validated('fecha'), config('app.timezone'))
            : now(config('app.timezone'))->subDay();

        try {
            $resumen = $servicio->sincronizarDia($fecha);
        } catch (\Throwable $e) {
            Log::error('MyGeotab: fallo la sincronización de kilómetros.', [
                'fecha' => $fecha->toDateString(),
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'No se pudo sincronizar con MyGeotab: '.$e->getMessage()], 502);
        }

        return response()->json([
            'fecha' => $fecha->toDateString(),
            ...$resumen,
        ]);
    }
}
