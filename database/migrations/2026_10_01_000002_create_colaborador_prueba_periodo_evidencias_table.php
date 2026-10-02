<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('colaborador_prueba_periodo_evidencias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('colaborador_prueba_periodo_id')
                ->constrained('colaborador_pruebas_periodo')
                ->cascadeOnDelete();
            $table->string('path');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('colaborador_prueba_periodo_evidencias');
    }
};
