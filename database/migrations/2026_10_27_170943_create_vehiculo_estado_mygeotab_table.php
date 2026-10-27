<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Estado en vivo por placa según MyGeotab (DeviceStatusInfo), para el
     * módulo de Vehículos Detenidos (Reparto) — no se llama a MyGeotab en
     * cada carga de página, un comando programado (cada 5 min) actualiza
     * esta tabla y la pantalla solo la lee.
     */
    public function up(): void
    {
        Schema::create('vehiculo_estado_mygeotab', function (Blueprint $table) {
            $table->id();
            $table->string('placa', 50)->unique();
            $table->string('mygeotab_device_id', 100)->nullable();
            $table->boolean('detenido')->default(false);
            $table->decimal('velocidad', 6, 2)->nullable();
            $table->decimal('latitud', 10, 7)->nullable();
            $table->decimal('longitud', 10, 7)->nullable();
            // El 'dateTime' que reporta MyGeotab (puede ir rezagado si el
            // dispositivo dejó de comunicarse), distinto de updated_at
            // (cuándo CORRIMOS nosotros el último sondeo).
            $table->timestamp('ultima_posicion_en')->nullable();
            // Null mientras se mueve; se fija al momento real en que empezó
            // la parada actual (restando currentStateDuration de MyGeotab a
            // ultima_posicion_en) — no "cuándo lo notamos nosotros".
            $table->timestamp('detenido_desde')->nullable();
            // Dedupe del correo de alerta: null = no notificado para esta
            // parada todavía. Se limpia a null en cuanto el vehículo se
            // vuelve a mover, para que la siguiente parada sea un evento
            // nuevo.
            $table->timestamp('notificado_en')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehiculo_estado_mygeotab');
    }
};
