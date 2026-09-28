<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('modulacion_municipios', function (Blueprint $table) {
            $table->id();
            $table->string('codigo_dane', 5)->nullable()->unique();
            $table->string('nombre', 100);
            $table->string('nombre_normalizado', 100)->unique();
            $table->string('origen', 30)->default('manual');
            $table->timestamps();
        });

        Schema::create('modulacion_barrios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('municipio_id')->constrained('modulacion_municipios')->cascadeOnDelete();
            $table->string('nombre', 200);
            $table->string('nombre_normalizado', 200);
            $table->string('origen', 30)->default('manual');
            $table->timestamps();

            $table->unique(
                ['municipio_id', 'nombre_normalizado'],
                'modulacion_barrios_municipio_nombre_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('modulacion_barrios');
        Schema::dropIfExists('modulacion_municipios');
    }
};
