<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('eventos_tripulacion', function (Blueprint $table) {
            // Aumentar precisión de rechazos a 4 decimales para evitar redondeo
            // que afecte la comparación con el umbral 2.4%
            // Ej: 2.384% debe guardarse como 2.3840, no redondearse a 2.38 o 2.39
            $table->decimal('rechazos', 8, 4)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('eventos_tripulacion', function (Blueprint $table) {
            $table->decimal('rechazos', 6, 2)->nullable()->change();
        });
    }
};
