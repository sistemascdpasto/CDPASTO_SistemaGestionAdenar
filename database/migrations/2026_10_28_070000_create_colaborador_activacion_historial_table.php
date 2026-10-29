<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('colaborador_activacion_historial', function (Blueprint $table) {
            $table->id();
            $table->foreignId('colaborador_id')->constrained('colaboradores')->cascadeOnDelete();
            $table->boolean('is_active');
            $table->string('tipo', 30); // 'activacion', 'desactivacion', 'reingreso', 'ingreso'
            $table->datetime('fecha');
            $table->string('motivo')->nullable();
            $table->text('observaciones')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['colaborador_id', 'fecha']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('colaborador_activacion_historial');
    }
};
