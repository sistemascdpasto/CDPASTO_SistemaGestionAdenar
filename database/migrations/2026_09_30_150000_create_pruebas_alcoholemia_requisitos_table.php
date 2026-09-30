<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pruebas_alcoholemia_requisitos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('colaborador_id')->constrained('colaboradores')->cascadeOnDelete();
            $table->date('fecha');
            $table->string('tipo', 40);
            $table->timestamps();

            $table->unique(['colaborador_id', 'fecha']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pruebas_alcoholemia_requisitos');
    }
};
