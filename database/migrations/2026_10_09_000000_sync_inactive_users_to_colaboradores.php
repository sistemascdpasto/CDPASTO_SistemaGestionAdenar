<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Los usuarios desactivados en Gestión de usuarios antes de existir la sincronización
 * dejaron a su colaborador activo: se alinean una sola vez.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('colaboradores')
            ->where('is_active', true)
            ->whereIn('user_id', DB::table('users')->where('is_active', false)->select('id'))
            ->update(['is_active' => false, 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Sin reversa: no se puede saber qué colaboradores estaban activos antes.
    }
};
