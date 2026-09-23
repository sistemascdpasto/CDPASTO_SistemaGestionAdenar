<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('revision_novedad_evidencias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('novedad_id')->constrained('revision_novedades')->cascadeOnDelete();
            $table->string('path');
            $table->unsignedSmallInteger('orden')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revision_novedad_evidencias');
    }
};
