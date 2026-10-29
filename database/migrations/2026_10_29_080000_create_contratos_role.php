<?php

use App\Enums\Role as RoleEnum;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        $perm = Permission::firstOrCreate(['name' => 'modules.gente', 'guard_name' => 'web']);
        $role = Role::firstOrCreate(['name' => RoleEnum::Contratos->value, 'guard_name' => 'web']);
        $role->givePermissionTo($perm);
    }

    public function down(): void
    {
        // No se elimina el rol para evitar pérdida de datos si ya fue asignado.
    }
};
