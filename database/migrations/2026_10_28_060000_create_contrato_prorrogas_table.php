<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contrato_prorrogas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('colaborador_id')->constrained('colaboradores')->cascadeOnDelete();
            $table->foreignId('registrado_por')->constrained('users');
            $table->date('fecha_anterior');       // fecha_retiro_empresa antes de la prórroga
            $table->date('fecha_nueva');          // fecha_retiro_empresa después de la prórroga
            $table->string('tipo')->default('prorroga'); // prorroga | finalizacion
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index('colaborador_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contrato_prorrogas');
    }
};
