<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicion_tiempos_inventario', function (Blueprint $table) {
            $table->integer('meta_minutos')->nullable()->after('duracion_minutos');
        });
    }

    public function down(): void
    {
        Schema::table('medicion_tiempos_inventario', function (Blueprint $table) {
            $table->dropColumn('meta_minutos');
        });
    }
};
