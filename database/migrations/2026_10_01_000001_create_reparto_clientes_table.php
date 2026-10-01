<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reparto_clientes', function (Blueprint $table) {
            $table->id();
            $table->string('codigo_cliente', 30)->unique()->comment('CodigoCliente del Excel');
            $table->string('cliente', 255)->nullable()->comment('Nombre del establecimiento');
            $table->string('propietario', 255)->nullable();
            $table->string('identificacion', 30)->nullable();
            $table->decimal('longitud', 12, 6)->nullable();
            $table->decimal('latitud', 12, 6)->nullable();
            $table->string('barrio', 200)->nullable();
            $table->string('direccion', 300)->nullable();
            $table->string('departamento', 100)->nullable();
            $table->string('municipio', 100)->nullable();
            $table->string('actividad_economica', 200)->nullable();
            $table->string('telefonos', 100)->nullable();
            $table->string('correo_electronico', 150)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reparto_clientes');
    }
};
