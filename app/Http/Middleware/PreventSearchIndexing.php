<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Todo el sistema está detrás de /login excepto la portada ("home"). Se
 * agrega X-Robots-Tag: noindex a cualquier otra respuesta como segunda capa
 * de defensa junto con robots.txt — así un buscador que ya haya encontrado
 * un enlace directo a una pantalla interna tampoco la indexa.
 */
class PreventSearchIndexing
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $request->routeIs('home')) {
            $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        }

        return $response;
    }
}
