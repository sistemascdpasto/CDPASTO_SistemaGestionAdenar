<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('colaborador_padrino_indicadores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('colaborador_id')
                ->constrained('colaboradores')
                ->cascadeOnDelete();
            $table->unsignedTinyInteger('mes');   // 1–12
            $table->unsignedSmallInteger('anio'); // 2024…

            // 4 indicadores toggle: true = 100%, false = 0%
            $table->boolean('safety_together')->default(true);
            $table->boolean('comunicacion_asertiva')->default(true);
            $table->boolean('habilidades')->default(true);
            $table->boolean('eventos_seguridad')->default(true);

            $table->timestamps();

            // Clave única por colaborador + mes + año
            $table->unique(['colaborador_id', 'mes', 'anio'], 'uq_padrino_indicadores');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('colaborador_padrino_indicadores');
    }
};
