<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * placa_vehiculo es redundante con vehiculo_id (relación).
 * Se hace nullable para que el insert no falle cuando
 * solo se envía vehiculo_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicion_tiempos_inventario', function (Blueprint $table) {
            $table->string('placa_vehiculo', 20)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('medicion_tiempos_inventario', function (Blueprint $table) {
            $table->string('placa_vehiculo', 20)->nullable(false)->change();
        });
    }
};
