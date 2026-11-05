<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Guarda las categorías de licencia de conducción seleccionadas en el paso 4
 * del wizard de colaboradores (HU02). Es un arreglo JSON (ej. ["A1","B2"])
 * porque un conductor puede tener una o varias categorías simultáneas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('colaboradores', function (Blueprint $table) {
            $table->json('licencia_conduccion_categorias')->nullable()->after('restricciones_licencia');
        });
    }

    public function down(): void
    {
        Schema::table('colaboradores', function (Blueprint $table) {
            $table->dropColumn('licencia_conduccion_categorias');
        });
    }
};
