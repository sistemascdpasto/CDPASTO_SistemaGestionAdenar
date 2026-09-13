<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cabeceras de endurecimiento que no dependen de una funcionalidad concreta.
 * No incluye Content-Security-Policy: la app carga fuentes de
 * fonts.bunny.net, mapas de OpenStreetMap/Leaflet y el iframe de Waze en
 * rutas críticas, y definir una CSP correcta para eso requiere probar cada
 * pantalla — se deja como mejora aparte en vez de arriesgar romper algo.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        // SAMEORIGIN (no DENY): el detalle de vehículos previsualiza PDF
        // propio en un <iframe> same-origin.
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        // camera=(self): el registro de condiciones de salud usa
        // getUserMedia() para tomar fotos; el resto de permisos sensibles
        // del navegador no se usan en ninguna pantalla.
        $response->headers->set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self)');

        if ($request->secure() && app()->environment('production')) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
