<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Protege el endpoint que dispara la sincronización diaria de kilómetros de
 * MyGeotab (llamado por una tarea programada en la PC local, no por un
 * usuario autenticado en la app — mismo patrón que EnsureSimitApiToken /
 * EnsureGeovictoriaApiToken). Compara el Bearer token contra
 * MYGEOTAB_SYNC_TOKEN.
 */
class EnsureMygeotabApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = config('services.mygeotab.sync_token');
        $provisto = $request->bearerToken();

        if (! $token || ! $provisto || ! hash_equals($token, $provisto)) {
            abort(401, 'Token invalido o ausente.');
        }

        return $next($request);
    }
}
