<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehiculo_disponibilidad_historial', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehiculo_id')->constrained('vehiculos')->cascadeOnDelete();
            $table->boolean('disponible');
            $table->text('novedad')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['vehiculo_id', 'created_at'], 'idx_veh_disp_vehiculo_fecha');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehiculo_disponibilidad_historial');
    }
};
