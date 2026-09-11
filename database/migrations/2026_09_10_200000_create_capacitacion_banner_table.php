<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla de configuración del banner de la vista principal de capacitaciones del colaborador.
 * Solo se guarda un único registro (id = 1). Se usa upsert en el controller.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('capacitacion_banner', function (Blueprint $table) {
            $table->id();

            // Imagen rectangular (se almacena en storage/public/capacitaciones/banner/)
            $table->string('imagen_path')->nullable();

            // Frase inspiracional o mensaje principal (máx 300 caracteres)
            $table->string('frase', 300)->nullable()->default('Tu aprendizaje impulsa tu seguridad y la de tus compañeros.');

            // Sub-frase o descripción adicional (opcional)
            $table->string('sub_frase', 300)->nullable()->default('Explora los materiales disponibles y marca tu progreso.');

            // Quién hizo el último cambio
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('capacitacion_banner');
    }
};
