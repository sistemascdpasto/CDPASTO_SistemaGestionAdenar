<?php

namespace App\Http\Controllers;

use App\Models\Seguridad\Alerta;
use App\Models\Seguridad\AlertaDescartada;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificacionesDescartarController extends Controller
{
    /**
     * Marca una alerta como descartada para el usuario autenticado.
     * No afecta a otros usuarios ni al registro original de la alerta.
     * Si la alerta ya fue descartada por este usuario, responde 200 igualmente
     * (idempotente, útil para reintentos del frontend).
     */
    public function __invoke(Request $request, Alerta $alerta): JsonResponse
    {
        try {
            AlertaDescartada::firstOrCreate([
                'alerta_id' => $alerta->id,
                'user_id' => $request->user()->id,
            ], [
                'descartada_en' => now(),
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            // Violación de unique por race condition (dos clicks simultáneos):
            // ya está descartada, el resultado es el mismo — responder 200.
            if (! str_contains($e->getMessage(), '1062') && ! str_contains($e->getMessage(), 'UNIQUE')) {
                throw $e;
            }
        }

        return response()->json(['ok' => true]);
    }
}
