<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('eventos_tripulacion', function (Blueprint $table) {
            // Guardar excesos_tiempo_ruta tal cual viene del Excel (ej: "07:47:00 a. m.")
            $table->string('excesos_tiempo_ruta', 50)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('eventos_tripulacion', function (Blueprint $table) {
            $table->unsignedSmallInteger('excesos_tiempo_ruta')->nullable()->change();
        });
    }
};
