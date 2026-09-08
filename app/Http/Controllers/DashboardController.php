<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Controllers\Colaborador\PortalController;
use App\Models\User;
use App\Services\Dashboard\DashboardResumenService;
use App\Services\Seguridad\EvaluacionCalculator;
use App\Services\Seguridad\IndiceRiesgoCalculator;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request, DashboardResumenService $resumen): Response
    {
        $user = $request->user();

        if ($user->hasRole(Role::Administrador->value)) {
            return Inertia::render('dashboard/admin', [
                'stats' => [
                    'totalUsers' => User::count(),
                    'activeUsers' => User::where('is_active', true)->count(),
                    'inactiveUsers' => User::where('is_active', false)->count(),
                    'byRole' => collect(Role::moduleRoles())
                        ->map(fn (Role $role, string $slug) => [
                            'slug' => $slug,
                            'role' => $role->value,
                            'count' => User::role($role->value)->count(),
                        ])
                        ->values(),
                ],
                'resumen' => $resumen->paraPilares(array_keys(Role::moduleRoles())),
            ]);
        }

        if ($user->hasRole(Role::Colaborador->value)) {
            return app(PortalController::class)->index(
                $request,
                app(EvaluacionCalculator::class),
                app(IndiceRiesgoCalculator::class),
            );
        }

        $modules = collect(Role::moduleRoles())
            ->filter(fn (Role $role) => $user->hasRole($role->value))
            ->keys()
            ->values();

        return Inertia::render('dashboard/role', [
            'modules' => $modules,
            'resumen' => $resumen->paraPilares($modules->all()),
        ]);
    }
}
