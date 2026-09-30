<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('geovictoria_asistencias', function (Blueprint $table) {
            // Seguimiento de salidas después de las 18:30: hora desde la que
            // el empleado puede marcar la siguiente entrada sin caer en
            // descanso no efectivo (la calcula la automatización, ver
            // procesar_datos.py). Null si la salida fue a las 18:30 o antes.
            $table->dateTime('hora_minima_entrada')->nullable()->after('descanso_no_efectivo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('geovictoria_asistencias', function (Blueprint $table) {
            $table->dropColumn('hora_minima_entrada');
        });
    }
};
