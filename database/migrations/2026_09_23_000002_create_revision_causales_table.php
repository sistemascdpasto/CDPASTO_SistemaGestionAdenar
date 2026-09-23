<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('revision_causales', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->boolean('requiere_especificacion')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('orden')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revision_causales');
    }
};
