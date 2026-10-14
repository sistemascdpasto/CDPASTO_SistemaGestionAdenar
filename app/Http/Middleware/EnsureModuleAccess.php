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
        $submodule = $request->route('submodule');
        $role = Role::forModuleSlug($module);

        // Verificacion estandar de rol de modulo
        $tieneRolModulo = $user && (
            $user->hasRole(Role::Administrador->value)
            || ($role && $user->hasRole($role->value))
        );

        // Excepcion: roles como Colaborador pueden acceder a submodulos especificos
        // que los listan en config/modulos.php (ej. plan-padrinos con rol Colaborador).
        if (! $tieneRolModulo && $user && $submodule !== null) {
            $tieneRolModulo = ModuleAccessRegistry::canAccess($user, $module, (string) $submodule);
        }

        abort_unless($tieneRolModulo, 403);

        // Verificacion granular de submodulo (rol + personalizacion por usuario).
        if ($submodule !== null) {
            abort_unless(ModuleAccessRegistry::canAccess($user, $module, (string) $submodule), 403);
        }

        return $next($request);
    }
}