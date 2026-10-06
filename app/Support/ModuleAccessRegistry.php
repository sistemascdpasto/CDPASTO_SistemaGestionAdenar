<?php

namespace App\Support;

use App\Enums\Role;
use App\Models\User;
use App\Models\UserSubmoduleAccess;

/**
 * Único punto de verdad para el control de acceso a submódulos por usuario
 * (catálogo en config/modulos.php, datos de personalización en la tabla
 * user_submodule_access). Lo consumen:
 *  - App\Http\Middleware\EnsureSubmoduleAccess (rutas reales de cada módulo)
 *  - App\Http\Middleware\EnsureModuleAccess (páginas genéricas /modules/{m}/{s})
 *  - App\Http\Middleware\HandleInertiaRequests (navegación del sidebar)
 *  - App\Http\Controllers\Admin\UserController (panel de personalización)
 *
 * Importante: nada aquí usa cachés estáticas de datos de usuario (el server
 * corre sobre FrankenPHP, que puede reutilizar el proceso entre requests —
 * una caché estática de "accesos del usuario X" sobreviviría al request y
 * quedaría desactualizada en cuanto un admin guarde un cambio).
 */
class ModuleAccessRegistry
{
    /**
     * Catálogo normalizado: module_slug => [submodule_key => ['label' => string, 'roles' => string[]]].
     * Cachear esto SÍ es seguro: sale de config/modulos.php, que solo cambia con un deploy.
     *
     * @return array<string, array<string, array{label: string, roles: array<int, string>}>>
     */
    public static function all(): array
    {
        static $normalized = null;

        if ($normalized !== null) {
            return $normalized;
        }

        $normalized = [];

        foreach ((array) config('modulos', []) as $moduleSlug => $submodules) {
            $defaultRole = Role::forModuleSlug($moduleSlug);
            $defaultRoles = $defaultRole ? [$defaultRole->value] : [];

            foreach ($submodules as $key => $def) {
                $normalized[$moduleSlug][$key] = is_array($def)
                    ? ['label' => $def['label'], 'roles' => $def['roles'] ?? $defaultRoles]
                    : ['label' => $def, 'roles' => $defaultRoles];
            }
        }

        return $normalized;
    }

    public static function exists(string $moduleSlug, string $submoduleKey): bool
    {
        return isset(self::all()[$moduleSlug][$submoduleKey]);
    }

    public static function label(string $moduleSlug, string $submoduleKey): ?string
    {
        return self::all()[$moduleSlug][$submoduleKey]['label'] ?? null;
    }

    /**
     * @return array<int, string>
     */
    public static function rolesFor(string $moduleSlug, string $submoduleKey): array
    {
        return self::all()[$moduleSlug][$submoduleKey]['roles'] ?? [];
    }

    private static function roleEligible(User $user, string $moduleSlug, string $submoduleKey): bool
    {
        $roles = self::rolesFor($moduleSlug, $submoduleKey);

        return $roles !== [] && $user->hasAnyRole($roles);
    }

    /**
     * Submódulos explícitamente otorgados al usuario (solo tiene sentido
     * cuando `modulos_personalizados` es true; para los demás, ignorar).
     *
     * @return array<string, array<int, string>> module_slug => [submodule_key, ...]
     */
    public static function grantedKeys(User $user): array
    {
        $granted = [];

        foreach (UserSubmoduleAccess::query()->where('user_id', $user->id)->get(['module_slug', 'submodule_key']) as $row) {
            $granted[$row->module_slug][] = $row->submodule_key;
        }

        return $granted;
    }

    /**
     * ¿Puede este usuario acceder a este submódulo ahora mismo? Combina rol
     * (siempre es el piso: nunca se puede otorgar algo que el rol no permite)
     * con la personalización explícita cuando está activa.
     */
    public static function canAccess(User $user, string $moduleSlug, string $submoduleKey): bool
    {
        if ($user->hasRole(Role::Administrador->value)) {
            return true;
        }

        if (! self::exists($moduleSlug, $submoduleKey)) {
            // Sin entrada en el catálogo: no es personalizable, sigue
            // rigiéndose solo por el rol (como antes de esta funcionalidad).
            return true;
        }

        if (! self::roleEligible($user, $moduleSlug, $submoduleKey)) {
            return false;
        }

        if (! $user->modulos_personalizados) {
            return true;
        }

        return in_array($submoduleKey, self::grantedKeys($user)[$moduleSlug] ?? [], true);
    }

    /**
     * Submódulos efectivamente accesibles por el usuario ahora mismo, para
     * compartir al frontend (sidebar) — ya resuelve rol + personalización.
     *
     * @return array<string, array<int, string>> module_slug => [submodule_key, ...]
     */
    public static function accessibleSubmodules(User $user): array
    {
        $isAdmin = $user->hasRole(Role::Administrador->value);
        $granted = $user->modulos_personalizados && ! $isAdmin ? self::grantedKeys($user) : null;

        $result = [];

        foreach (self::all() as $moduleSlug => $submodules) {
            foreach ($submodules as $key => $def) {
                if (! $isAdmin && ! $user->hasAnyRole($def['roles'])) {
                    continue;
                }

                if ($granted !== null && ! in_array($key, $granted[$moduleSlug] ?? [], true)) {
                    continue;
                }

                $result[$moduleSlug][] = $key;
            }
        }

        return $result;
    }
}
