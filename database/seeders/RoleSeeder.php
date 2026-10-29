<?php

namespace Database\Seeders;

use App\Enums\Role as RoleEnum;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $modulePermissions = collect(RoleEnum::moduleRoles())
            ->keys()
            ->map(fn (string $slug) => "modules.{$slug}")
            ->push('users.manage')
            ->push('portal.colaborador');

        $modulePermissions->each(
            fn (string $name) => Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web'])
        );

        foreach (RoleEnum::cases() as $role) {
            Role::firstOrCreate(['name' => $role->value, 'guard_name' => 'web']);
        }

        foreach (RoleEnum::moduleRoles() as $slug => $role) {
            Role::findByName($role->value, 'web')->syncPermissions(["modules.{$slug}"]);
        }

        Role::findByName(RoleEnum::Colaborador->value, 'web')->syncPermissions(['portal.colaborador']);
        Role::findByName(RoleEnum::Contratos->value, 'web')->syncPermissions(['modules.gente']);

        // The Administrador role holds every permission that exists today; new
        // permissions added later are still covered by the Gate::before bypass.
        Role::findByName(RoleEnum::Administrador->value, 'web')->syncPermissions(Permission::all());
    }
}
