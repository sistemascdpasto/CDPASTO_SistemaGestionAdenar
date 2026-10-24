<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fotos de vouchers de tanqueo subidas por Colaboradores. Gemini extrae
     * galones/total_pagado/fecha al subir (síncrono, ver
     * GeminiVoucherExtractorService) y deja 'estado' en procesado o error;
     * un usuario de Flota revisa/corrige antes de pasar a 'revisado' — solo
     * los revisados entran en el cálculo de rendimiento km/gl, para no
     * confiar datos financieros a un OCR sin verificar.
     */
    public function up(): void
    {
        Schema::create('combustible_vouchers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('colaborador_id')->constrained('colaboradores')->cascadeOnDelete();
            $table->string('placa', 50);
            $table->string('foto_path');
            $table->string('estado', 20)->default('pendiente');
            $table->decimal('galones', 8, 2)->nullable();
            $table->decimal('total_pagado', 10, 2)->nullable();
            $table->decimal('precio_galon', 10, 2)->nullable();
            $table->date('fecha_voucher')->nullable();
            $table->json('gemini_raw')->nullable();
            $table->text('gemini_error')->nullable();
            $table->foreignId('revisado_por_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revisado_at')->nullable();
            $table->timestamps();

            $table->index(['placa', 'fecha_voucher']);
            $table->index('estado');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('combustible_vouchers');
    }
};
