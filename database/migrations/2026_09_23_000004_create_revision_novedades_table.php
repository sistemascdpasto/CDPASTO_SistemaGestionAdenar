<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('revision_novedades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('revision_id')->constrained('revisiones_aleatorias')->cascadeOnDelete();
            $table->string('sku')->nullable();
            $table->string('producto');
            $table->unsignedInteger('cantidad_revisada')->nullable();
            $table->unsignedInteger('cantidad_novedad');
            $table->foreignId('causal_id')->constrained('revision_causales');
            $table->text('causal_especificacion')->nullable();
            $table->text('observacion')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revision_novedades');
    }
};
