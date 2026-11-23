<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cargo_examenes', function (Blueprint $table) {
            $table->id();
            // No hay tabla propia de "cargos" en este sistema — vive como
            // catálogo de texto en config('gente.colaboradores.cargos'),
            // igual que en `colaboradores.cargo`.
            $table->string('cargo');
            $table->foreignId('examen_id')->constrained('examenes')->cascadeOnDelete();
            $table->string('tipo_evaluacion'); // ingreso | periodico
            $table->boolean('obligatorio')->default(true);
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique(['cargo', 'examen_id', 'tipo_evaluacion'], 'cargo_examen_tipo_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cargo_examenes');
    }
};
