<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('carreta_disponibilidad_historial', function (Blueprint $table) {
            $table->id();
            $table->foreignId('carreta_id')->constrained('carretas')->cascadeOnDelete();
            $table->boolean('disponible');
            $table->text('novedad')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['carreta_id', 'created_at'], 'idx_carreta_disp_carreta_fecha');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('carreta_disponibilidad_historial');
    }
};
