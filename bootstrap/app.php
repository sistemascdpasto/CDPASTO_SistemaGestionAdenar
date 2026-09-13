<?php

use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\EnsureGeovictoriaApiToken;
use App\Http\Middleware\EnsureModuleAccess;
use App\Http\Middleware\EnsureSimitApiToken;
use App\Http\Middleware\ForceHttps;
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

        // ForceHttps va al PRINCIPIO del grupo web/api, no del stack global:
        // el stack global corre TrustProxies primero (interpreta el
        // X-Forwarded-Proto que manda Railway), y solo después de eso
        // $request->secure() refleja la conexión real del navegador. Si
        // ForceHttps corriera antes de TrustProxies (vía prepend() global),
        // siempre vería la conexión interna como HTTP y redirigiría en
        // bucle infinito — eso fue exactamente lo que tumbó la página.
        $middleware->web(prepend: [ForceHttps::class], append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            PreventSearchIndexing::class,
        ]);
        $middleware->api(prepend: [ForceHttps::class]);

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
