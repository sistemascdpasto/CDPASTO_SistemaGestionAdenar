<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega meses_visibles a capacitacion_carpetas.
 *
 * JSON nullable: array de números 1-12 que representan los meses
 * en los que la carpeta debe mostrarse automáticamente a los colaboradores,
 * independientemente del valor de visible_colaborador.
 *
 * Ejemplo: [1, 3, 6] → visible en enero, marzo y junio.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('capacitacion_carpetas', function (Blueprint $table) {
            $table->json('meses_visibles')->nullable()->after('visible_colaborador');
        });
    }

    public function down(): void
    {
        Schema::table('capacitacion_carpetas', function (Blueprint $table) {
            $table->dropColumn('meses_visibles');
        });
    }
};
