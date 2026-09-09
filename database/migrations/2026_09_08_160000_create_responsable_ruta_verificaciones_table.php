<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Registro de tiempos de verificación de carga del vehículo
 * por parte del Responsable de Ruta.
 *
 * Flujo:
 *  1. Se crea un registro con `inicio` al pulsar "Inicio".
 *  2. Posteriormente se completa `fin` al pulsar "Finalización".
 *  3. Solo UN registro (inicio o inicio+fin) por día y por responsable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('responsable_ruta_verificaciones', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('colaborador_id');
            $table->foreign('colaborador_id')
                  ->references('id')
                  ->on('colaboradores')
                  ->onDelete('cascade');

            // Fecha calendario del registro (para la unique de 1x día)
            $table->date('fecha');

            // Fecha/hora exactas del inicio y fin de la verificación
            $table->timestamp('inicio')->useCurrent();
            $table->timestamp('fin')->nullable();

            // Tiempo calculado (en minutos) para facilitar reportes
            $table->unsignedInteger('duracion_minutos')->nullable();

            // Quién hizo cada acción
            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')
                  ->references('id')
                  ->on('users')
                  ->onDelete('set null');

            $table->unsignedBigInteger('closed_by')->nullable();
            $table->foreign('closed_by')
                  ->references('id')
                  ->on('users')
                  ->onDelete('set null');

            $table->timestamps();

            // Restricción clave: SOLO un registro por colaborador + día
            $table->unique(['colaborador_id', 'fecha']);

            $table->index(['fecha']);
            $table->index(['colaborador_id', 'fecha']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('responsable_ruta_verificaciones');
    }
};
