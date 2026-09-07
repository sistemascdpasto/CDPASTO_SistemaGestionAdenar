<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cinco_porques', function (Blueprint $table) {
            $table->id();

            // Quien diligencia el formato (siempre): Colaborador o Reparto.
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // Registro de colaborador vinculado, si el usuario lo tiene.
            $table->foreignId('colaborador_id')->nullable()->constrained('colaboradores')->nullOnDelete();
            // Vehículo de Documentación de Flota (opcional).
            $table->foreignId('vehiculo_id')->nullable()->constrained('vehiculos')->nullOnDelete();

            $table->date('fecha');
            $table->string('rutina', 60);
            $table->string('indicador', 60);
            $table->text('problema');

            $table->text('porque_1')->nullable();
            $table->text('porque_2')->nullable();
            $table->text('porque_3')->nullable();
            $table->text('porque_4')->nullable();
            $table->text('porque_5')->nullable();

            $table->text('causa_raiz')->nullable();
            $table->text('plan_accion')->nullable();

            // Opciones sugeridas por la IA en cada nivel + conclusión, para
            // auditar qué propuso el modelo frente a lo que quedó guardado.
            $table->json('ia_sugerencias')->nullable();

            $table->timestamps();

            $table->index(['fecha', 'indicador']);
            $table->index('colaborador_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cinco_porques');
    }
};
