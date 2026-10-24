<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Meta de rendimiento (km/galón) por vehículo, para el dashboard de
     * Análisis de Combustible — equivalente a la columna "META" del Excel
     * que se está reemplazando.
     */
    public function up(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->decimal('meta_km_gl', 6, 2)->nullable()->after('capacidad_carga_kg');
        });
    }

    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropColumn('meta_km_gl');
        });
    }
};
