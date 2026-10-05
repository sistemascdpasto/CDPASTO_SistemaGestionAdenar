<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Columnas creadas por el usuario — globales, sin mes/año.
        // Persisten hasta que el usuario las elimina explícitamente.
        Schema::create('colaborador_padrino_columnas_extra', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->unsignedSmallInteger('orden')->default(0);
            $table->timestamps();
        });

        // Valores mensuales de cada celda (columna × colaborador × mes/año).
        // La misma columna global tiene un valor distinto por cada período.
        Schema::create('colaborador_padrino_columnas_extra_valores', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('columna_extra_id');
            $table->foreign('columna_extra_id', 'fk_ppcev_columna')
                ->references('id')
                ->on('colaborador_padrino_columnas_extra')
                ->cascadeOnDelete();

            $table->unsignedBigInteger('colaborador_id');
            $table->foreign('colaborador_id', 'fk_ppcev_colaborador')
                ->references('id')
                ->on('colaboradores')
                ->cascadeOnDelete();

            $table->unsignedTinyInteger('mes');    // 1–12
            $table->unsignedSmallInteger('anio');  // 2024…
            $table->boolean('valor')->default(true); // true=100%, false=0%
            $table->timestamps();

            // Una sola fila por columna × colaborador × período
            $table->unique(
                ['columna_extra_id', 'colaborador_id', 'mes', 'anio'],
                'uq_ppcev_col_colab_periodo'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('colaborador_padrino_columnas_extra_valores');
        Schema::dropIfExists('colaborador_padrino_columnas_extra');
    }
};
