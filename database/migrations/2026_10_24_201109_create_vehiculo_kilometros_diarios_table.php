<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kilómetros diarios por vehículo traídos de MyGeotab (suma de
     * Trip.distance del día por dispositivo). 'placa' es texto libre sin FK
     * a vehiculos (igual que modulacion_items.placa) porque viene del campo
     * licensePlate/name del dispositivo en MyGeotab, no de un selector
     * interno — se normaliza a mayúsculas/trim al guardar y al cruzar.
     */
    public function up(): void
    {
        Schema::create('vehiculo_kilometros_diarios', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->string('placa', 50);
            $table->string('mygeotab_device_id', 100)->nullable();
            $table->decimal('distancia_km', 10, 2)->default(0);
            $table->decimal('odometro_fin', 12, 2)->nullable();
            $table->timestamps();

            $table->unique(['fecha', 'placa']);
            $table->index('placa');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehiculo_kilometros_diarios');
    }
};
