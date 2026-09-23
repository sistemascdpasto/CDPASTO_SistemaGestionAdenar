<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('revisiones_aleatorias', function (Blueprint $table) {
            $table->id();
            $table->date('fecha')->unique();
            $table->foreignId('vehiculo_id')->nullable()->constrained('vehiculos')->nullOnDelete();
            $table->timestamp('vehiculo_seleccionado_en')->nullable();
            $table->foreignId('responsable_id')->nullable()->constrained('revision_responsables')->nullOnDelete();
            $table->timestamp('responsable_seleccionado_en')->nullable();
            $table->enum('resultado', ['sin_novedades', 'con_novedades'])->nullable();
            $table->timestamp('finalizada_en')->nullable();
            $table->foreignId('user_id')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revisiones_aleatorias');
    }
};
