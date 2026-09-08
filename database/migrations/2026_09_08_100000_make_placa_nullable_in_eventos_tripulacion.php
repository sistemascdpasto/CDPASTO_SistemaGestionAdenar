<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('eventos_tripulacion', function (Blueprint $table) {
            // La placa puede venir vacía en algunas filas del Excel; solo la fecha es obligatoria.
            $table->string('placa')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('eventos_tripulacion', function (Blueprint $table) {
            $table->string('placa')->nullable(false)->change();
        });
    }
};
