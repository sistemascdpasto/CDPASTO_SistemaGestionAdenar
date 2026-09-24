<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('revisiones_aleatorias', function (Blueprint $table) {
            $table->dropUnique('revisiones_aleatorias_fecha_unique');
            $table->unsignedTinyInteger('numero_del_dia')->nullable()->after('fecha');
        });

        // Bajo el constraint anterior (unique por fecha) nunca pudo existir más
        // de una fila por día, así que todo registro existente es la revisión 1.
        DB::table('revisiones_aleatorias')->update(['numero_del_dia' => 1]);

        Schema::table('revisiones_aleatorias', function (Blueprint $table) {
            $table->unsignedTinyInteger('numero_del_dia')->nullable(false)->change();
            $table->unique(['fecha', 'numero_del_dia']);
            $table->unique(['fecha', 'vehiculo_id']);
        });
    }

    public function down(): void
    {
        Schema::table('revisiones_aleatorias', function (Blueprint $table) {
            $table->dropUnique(['fecha', 'numero_del_dia']);
            $table->dropUnique(['fecha', 'vehiculo_id']);
            $table->dropColumn('numero_del_dia');
            $table->unique('fecha');
        });
    }
};
