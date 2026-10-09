<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('epp_entregas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('colaborador_id')->constrained('colaboradores')->cascadeOnDelete();
            $table->date('fecha_entrega');

            // Un booleano por cada ítem del formato en papel (ver EppEntrega::ITEMS).
            $table->boolean('guantes')->default(false);
            $table->boolean('gafas')->default(false);
            $table->boolean('casco')->default(false);
            $table->boolean('protector_auditivo')->default(false);
            $table->boolean('proteccion_respiratoria')->default(false);
            $table->boolean('calzado')->default(false);
            $table->boolean('camisa')->default(false);
            $table->boolean('pantalon')->default(false);
            $table->boolean('otros')->default(false);
            $table->string('otros_cual', 150)->nullable();

            $table->string('firma_path')->nullable();
            $table->string('foto_path')->nullable();
            $table->text('observaciones')->nullable();
            $table->foreignId('registrado_por_id')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->index(['colaborador_id', 'fecha_entrega']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('epp_entregas');
    }
};
