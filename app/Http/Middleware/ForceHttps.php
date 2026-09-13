<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Redirige a HTTPS en producción. Railway ya sirve la app por HTTPS y
 * reenvía X-Forwarded-Proto (trustProxies está en '*'), así que esto rara
 * vez dispara en la práctica — pero es la garantía explícita de que ninguna
 * request queda sirviendo la conexión sin cifrar.
 */
class ForceHttps
{
    public function handle(Request $request, Closure $next): Response
    {
        if (app()->environment('production') && ! $request->secure()) {
            return redirect()->to('https://'.$request->getHttpHost().$request->getRequestUri(), 301);
        }

        return $next($request);
    }
}
