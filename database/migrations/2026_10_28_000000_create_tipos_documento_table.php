<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tipos_documento', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 100)->unique();
            $table->boolean('es_personalizado')->default(false); // true = creado por usuario
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tipos_documento');
    }
};
