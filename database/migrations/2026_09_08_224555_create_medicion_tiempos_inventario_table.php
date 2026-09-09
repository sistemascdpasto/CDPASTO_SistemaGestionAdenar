<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('medicion_tiempos_inventario', function (Blueprint $table) {
            $table->id();
            $table->date('fecha_medicion');
            $table->string('placa_vehiculo', 20);
            $table->string('centro', 100)->nullable();
            $table->string('regional', 100)->nullable();
            $table->string('cedula_colaborador', 20)->nullable();
            $table->string('nombre_colaborador', 100)->nullable();
            
            // Campos de tiempo de inventario
            $table->time('hora_inicio')->nullable();
            $table->time('hora_fin')->nullable();
            $table->integer('duracion_minutos')->nullable();
            $table->string('tipo_inventario', 50)->nullable(); // Ej: inicial, final, parcial
            
            // Estado y observaciones
            $table->string('estado', 50)->default('completado');
            $table->text('observaciones')->nullable();
            
            // Referencias
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('colaborador_id')->nullable()->constrained('colaboradores')->onDelete('set null');
            $table->foreignId('vehiculo_id')->nullable()->constrained('vehiculos')->onDelete('set null');
            
            // Campos de auditoría
            $table->string('creado_por', 100)->nullable();
            $table->timestamp('fecha_creacion')->useCurrent();
            
            $table->timestamps();
            
            // Índices
            $table->index(['fecha_medicion', 'placa_vehiculo'], 'idx_fecha_placa');
            $table->index('user_id', 'idx_user_id');
            $table->index('colaborador_id', 'idx_colaborador_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('medicion_tiempos_inventario');
    }
};
