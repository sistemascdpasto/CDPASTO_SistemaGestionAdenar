<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('colaborador_epp_perfiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('colaborador_id')->unique()->constrained('colaboradores')->cascadeOnDelete();

            $table->string('talla_calzado', 20)->nullable();
            $table->string('talla_camisa', 20)->nullable();
            $table->string('talla_pantalon', 20)->nullable();
            $table->string('talla_otros', 50)->nullable();

            // Compromiso de uso: se firma una sola vez (no por entrega).
            $table->timestamp('compromiso_firmado_en')->nullable();
            $table->string('compromiso_firma_path')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('colaborador_epp_perfiles');
    }
};
