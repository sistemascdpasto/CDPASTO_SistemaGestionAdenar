<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('carretas', function (Blueprint $table) {
            $table->id();
            $table->string('placa')->unique();
            $table->string('tipo')->nullable();
            $table->boolean('is_active')->default(true);
            $table->text('novedad_no_disponible')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('carretas');
    }
};
