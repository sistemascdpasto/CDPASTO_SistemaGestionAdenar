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
        Schema::create('colaborador_padrino_criterios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('colaborador_id')
                ->nullable()
                ->constrained('colaboradores')
                ->nullOnDelete();
            $table->string('qr_safety')->index();
            $table->string('nombre_excel')->nullable();

            // Calificaciones Funcional
            $table->decimal('funcional_7_dias', 5, 2)->nullable();
            $table->decimal('funcional_30_dias', 5, 2)->nullable();
            $table->decimal('funcional_90_dias', 5, 2)->nullable();
            $table->decimal('funcional_total', 5, 2)->nullable();

            // Habilidades Técnicas
            $table->decimal('hab_tecnicas_1', 5, 2)->nullable();
            $table->decimal('hab_tecnicas_2', 5, 2)->nullable();
            $table->decimal('hab_tecnicas_3', 5, 2)->nullable();
            $table->decimal('habilidades_tecnicas_total', 5, 2)->nullable();

            // Autonomía
            $table->decimal('autonomia_1', 5, 2)->nullable();
            $table->decimal('autonomia_2', 5, 2)->nullable();
            $table->decimal('autonomia_3', 5, 2)->nullable();
            $table->decimal('autonomia_4', 5, 2)->nullable();
            $table->decimal('autonomia_total', 5, 2)->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('colaborador_padrino_criterios');
    }
};
