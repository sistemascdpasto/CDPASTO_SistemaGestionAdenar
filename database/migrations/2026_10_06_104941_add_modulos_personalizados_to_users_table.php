<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Cuando es true, el acceso a submódulos del usuario viene
            // exclusivamente de user_submodule_access (ver esa tabla) en vez
            // de derivarse de sus roles. Por defecto false: ningún usuario
            // existente cambia de comportamiento al desplegar esto.
            $table->boolean('modulos_personalizados')->default(false)->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('modulos_personalizados');
        });
    }
};
