<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cargos', function (Blueprint $table) {
            // Valor mensual (COP) para Compensación Variable Diaria.
            // Null = el cargo no participa en CVD (no se calculará valor_x_dia).
            $table->unsignedInteger('valor_cvd')->nullable()->default(null)->after('perfil');
        });
    }

    public function down(): void
    {
        Schema::table('cargos', function (Blueprint $table) {
            $table->dropColumn('valor_cvd');
        });
    }
};
