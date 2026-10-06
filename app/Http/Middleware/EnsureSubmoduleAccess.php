<?php

namespace App\Http\Middleware;

use App\Support\ModuleAccessRegistry;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Capa adicional de control de acceso, por encima de los `role:` existentes:
 * deriva el (módulo, submódulo) de la URL y verifica contra
 * ModuleAccessRegistry (rol + personalización por usuario, ver esa clase).
 *
 * Se agrega al arreglo de middleware de nivel superior de cada archivo de
 * rutas por módulo (ej. ['auth', 'active', 'submodule.access']) en vez de
 * envolver cada grupo de funcionalidad por separado: como deriva todo de la
 * URL, una sola declaración por archivo cubre todas sus rutas.
 */
class EnsureSubmoduleAccess
{
    /**
     * Prefijos de URL que no siguen el patrón modules/{modulo}/{submodulo}
     * pero sí representan un submódulo del catálogo (ver config/modulos.php).
     *
     * @var array<string, array{0: string, 1: string}>
     */
    private const SPECIAL_PREFIXES = [
        'cinco-porques' => ['reparto', 'cinco-porques'],
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        [$moduleSlug, $submoduleKey] = $this->resolve($request->segments());

        if ($moduleSlug === null || $submoduleKey === null) {
            return $next($request);
        }

        abort_unless(ModuleAccessRegistry::canAccess($user, $moduleSlug, $submoduleKey), 403);

        return $next($request);
    }

    /**
     * @param  array<int, string>  $segments
     * @return array{0: ?string, 1: ?string}
     */
    private function resolve(array $segments): array
    {
        $first = $segments[0] ?? null;

        if ($first !== null && isset(self::SPECIAL_PREFIXES[$first])) {
            return self::SPECIAL_PREFIXES[$first];
        }

        if ($first === 'modules' && isset($segments[1], $segments[2])) {
            return [$segments[1], $segments[2]];
        }

        return [null, null];
    }
}
