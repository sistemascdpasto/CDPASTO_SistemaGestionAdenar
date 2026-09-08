<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        $user = $request->user();
        $isAdmin = $user?->hasRole(Role::Administrador->value) ?? false;
        $isColaborador = $user?->hasRole(Role::Colaborador->value) ?? false;
        $accessibleModules = $user
            ? collect(Role::moduleRoles())
                ->filter(fn (Role $role, string $slug) => $isAdmin || $user->hasRole($role->value))
                ->keys()
                ->values()
                ->all()
            : [];

        return array_merge(parent::share($request), [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            // Varios controladores ya mandan `->with('status', ...)` tras un
            // redirect (algunos como string simple, otros como
            // ['message' => ..., 'type' => 'success'|'warning'|'error']) —
            // se comparte tal cual y el toast del frontend soporta ambas formas.
            'status' => fn () => $request->session()->get('status'),
            // Flash global: cualquier controlador puede usar ->with('flash_success'/'flash_error')
            // y llegará al frontend aunque la página no pase 'flash' explícitamente.
            'flash' => fn () => [
                'success' => $request->session()->get('success'),
                'error'   => $request->session()->get('error'),
            ],
            'auth' => [
                'user' => $user,
                'roles' => $user?->getRoleNames()->all() ?? [],
                'isAdmin' => $isAdmin,
                'isColaborador' => $isColaborador,
                'accessibleModules' => $accessibleModules,
            ],
        ]);
    }
}
