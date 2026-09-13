<?php

use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\EnsureGeovictoriaApiToken;
use App\Http\Middleware\EnsureModuleAccess;
use App\Http\Middleware\EnsureSimitApiToken;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\PreventSearchIndexing;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->trustProxies(at: '*');

        // Al final del stack global: se aplica a toda respuesta, web y api.
        $middleware->append(SecurityHeaders::class);

        // NOTA (2026-09-14): hubo un ForceHttps aquí que causó
        // ERR_TOO_MANY_REDIRECTS en producción dos veces seguidas (una vez
        // mal ordenado antes de TrustProxies, y ni corrigiendo el orden se
        // resolvió — Railway no está devolviendo lo que se asumió sobre
        // X-Forwarded-Proto). Se quita por completo hasta diagnosticar con
        // datos reales de producción en vez de asumir cómo reenvía Railway
        // las cabeceras. Railway ya sirve el dominio *.up.railway.app solo
        // por HTTPS de cara al usuario, así que no había urgencia real de
        // forzarlo desde la app.
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            PreventSearchIndexing::class,
        ]);

        $middleware->alias([
            'active' => EnsureAccountIsActive::class,
            'module.access' => EnsureModuleAccess::class,
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
            'simit.token' => EnsureSimitApiToken::class,
            'geovictoria.token' => EnsureGeovictoriaApiToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->respond(function (Response $response, Throwable $exception, Request $request) {
            if (app()->environment(['local', 'testing'])) {
                return $response;
            }

            $status = $response->getStatusCode();

            if ($status === 403) {
                return Inertia::render('errors/403')->toResponse($request)->setStatusCode(403);
            }

            if ($status === 419) {
                return back()->with('status', 'La página expiró, por favor intenta de nuevo.');
            }

            if (in_array($status, [404, 500, 503], true)) {
                return Inertia::render('errors/error', ['status' => $status])
                    ->toResponse($request)
                    ->setStatusCode($status);
            }

            return $response;
        });
    })->create();
