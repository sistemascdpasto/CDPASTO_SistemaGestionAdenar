<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('extintor_inspecciones', function (Blueprint $table) {
            // Separar observaciones de inspección de las de recarga
            // y añadir flag que indica si esta inspección incluye una recarga
            $table->renameColumn('observaciones', 'observaciones_inspeccion');
            $table->boolean('incluye_recarga')->default(false)->after('fecha_proxima_recarga');
            $table->text('observaciones_recarga')->nullable()->after('incluye_recarga');
        });
    }

    public function down(): void
    {
        Schema::table('extintor_inspecciones', function (Blueprint $table) {
            $table->renameColumn('observaciones_inspeccion', 'observaciones');
            $table->dropColumn(['incluye_recarga', 'observaciones_recarga']);
        });
    }
};
