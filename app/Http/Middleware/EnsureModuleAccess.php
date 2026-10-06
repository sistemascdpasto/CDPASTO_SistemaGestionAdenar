<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use App\Support\ModuleAccessRegistry;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureModuleAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $module = (string) $request->route('module');
        $role = Role::forModuleSlug($module);

        abort_unless(
            $user && ($user->hasRole(Role::Administrador->value) || ($role && $user->hasRole($role->value))),
            403
        );

        // Esta misma ruta genérica sirve /modules/{modulo} (sin submódulo,
        // la vista general del pilar) y /modules/{modulo}/{submodulo} (la
        // página de un submódulo puntual, ej. /modules/gente/plan-padrinos) —
        // solo la segunda tiene un submódulo que verificar.
        $submodule = $request->route('submodule');
        if ($submodule !== null) {
            abort_unless(ModuleAccessRegistry::canAccess($user, $module, (string) $submodule), 403);
        }

        return $next($request);
    }
}
