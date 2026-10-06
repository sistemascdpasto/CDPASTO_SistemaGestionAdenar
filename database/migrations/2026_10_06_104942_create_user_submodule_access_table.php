<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_submodule_access', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Claves de config('modulos'), ej. module_slug='reparto', submodule_key='revision-aleatoria'.
            $table->string('module_slug');
            $table->string('submodule_key');
            $table->timestamps();

            $table->unique(['user_id', 'module_slug', 'submodule_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_submodule_access');
    }
};
