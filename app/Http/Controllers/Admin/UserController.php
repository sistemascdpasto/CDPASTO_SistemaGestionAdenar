<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ResetPasswordRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use App\Models\UserSubmoduleAccess;
use App\Support\ModuleAccessRegistry;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();

        $users = User::query()
            ->with('roles:id,name')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('identification_number', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'identification_number' => $user->identification_number,
                'email' => $user->email,
                'is_active' => $user->is_active,
                'roles' => $user->roles->pluck('name'),
                'modulos_personalizados' => $user->modulos_personalizados,
            ]);

        return Inertia::render('admin/users/index', [
            'users' => $users,
            'filters' => ['search' => $search],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/users/create', [
            'roles' => Role::orderBy('name')->pluck('name'),
            'moduleRegistry' => $this->moduleRegistryForFrontend(),
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $user = User::create([
            ...$request->safe()->except(['roles', 'submodulos']),
            'is_active' => $request->boolean('is_active', true),
            'modulos_personalizados' => $request->boolean('modulos_personalizados'),
        ]);

        $user->syncRoles($request->validated('roles'));
        $this->syncSubmoduleAccess($user, $request->validated('submodulos', []));

        return to_route('admin.users.index')->with('status', 'Usuario creado correctamente.');
    }

    public function edit(User $user): Response
    {
        return Inertia::render('admin/users/edit', [
            'user' => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'identification_number' => $user->identification_number,
                'email' => $user->email,
                'is_active' => $user->is_active,
                'roles' => $user->roles->pluck('name'),
                'modulos_personalizados' => $user->modulos_personalizados,
                // Acceso efectivo actual (ya sea derivado del rol o la
                // personalización previa): es con lo que arranca marcado el
                // selector de submódulos al activar la personalización.
                'submodulos_actuales' => ModuleAccessRegistry::accessibleSubmodules($user),
            ],
            'roles' => Role::orderBy('name')->pluck('name'),
            'moduleRegistry' => $this->moduleRegistryForFrontend(),
        ]);
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $user->update([
            ...$request->safe()->except(['roles', 'submodulos']),
            'is_active' => $request->boolean('is_active', true),
            'modulos_personalizados' => $request->boolean('modulos_personalizados'),
        ]);

        $user->syncRoles($request->validated('roles'));
        $this->syncSubmoduleAccess($user, $request->validated('submodulos', []));

        return to_route('admin.users.index')->with('status', 'Usuario actualizado correctamente.');
    }

    /**
     * @return array<string, array<int, array{key: string, label: string}>>
     */
    private function moduleRegistryForFrontend(): array
    {
        $registry = [];

        foreach (ModuleAccessRegistry::all() as $moduleSlug => $submodules) {
            $registry[$moduleSlug] = collect($submodules)
                ->map(fn (array $def, string $key) => ['key' => $key, 'label' => $def['label']])
                ->values()
                ->all();
        }

        return $registry;
    }

    /**
     * @param  array<string, array<int, string>>  $submodulos
     */
    private function syncSubmoduleAccess(User $user, array $submodulos): void
    {
        DB::transaction(function () use ($user, $submodulos) {
            $user->submoduleAccess()->delete();

            $rows = [];
            foreach ($submodulos as $moduleSlug => $keys) {
                foreach (array_unique($keys) as $key) {
                    $rows[] = [
                        'user_id' => $user->id,
                        'module_slug' => $moduleSlug,
                        'submodule_key' => $key,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
            }

            if ($rows !== []) {
                UserSubmoduleAccess::insert($rows);
            }
        });
    }

    public function resetPassword(ResetPasswordRequest $request, User $user): RedirectResponse
    {
        $user->update(['password' => $request->validated('password')]);

        return back()->with('status', 'Contraseña restablecida correctamente.');
    }

    public function toggleStatus(User $user): RedirectResponse
    {
        $user->update(['is_active' => ! $user->is_active]);

        return back()->with('status', $user->is_active ? 'Usuario activado.' : 'Usuario desactivado.');
    }
}
