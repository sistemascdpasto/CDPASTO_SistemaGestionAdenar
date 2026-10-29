<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('opciones_catalogo', function (Blueprint $table) {
            $table->id();
            $table->string('categoria', 30);   // eps, afp, arl, ...
            $table->string('nombre', 100);
            $table->boolean('es_personalizado')->default(false); // true = creado por usuario
            $table->timestamps();

            $table->unique(['categoria', 'nombre']);
            $table->index('categoria');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('opciones_catalogo');
    }
};
