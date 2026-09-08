<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('eventos_tripulacion', function (Blueprint $table) {
            // Aumentar precisión a 4 decimales para evitar redondeo en comparaciones
            $table->decimal('adherencia_tiempo', 8, 4)->nullable()->change();
            $table->decimal('entrega_en_rango', 8, 4)->nullable()->change();
            $table->decimal('adherencia_checklist_pre', 8, 4)->nullable()->change();
            $table->decimal('adherencia_checklist_post', 8, 4)->nullable()->change();
            $table->decimal('modulacion', 8, 4)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('eventos_tripulacion', function (Blueprint $table) {
            $table->decimal('adherencia_tiempo', 6, 2)->nullable()->change();
            $table->decimal('entrega_en_rango', 6, 2)->nullable()->change();
            $table->decimal('adherencia_checklist_pre', 6, 2)->nullable()->change();
            $table->decimal('adherencia_checklist_post', 6, 2)->nullable()->change();
            $table->decimal('modulacion', 6, 2)->nullable()->change();
        });
    }
};
