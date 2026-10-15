<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Inspecciones del extintor ─────────────────────────────────────────
        // Una inspección puede ser de inicio (primer chequeo al registrar el
        // extintor) o periódica (revisiones de mantenimiento posteriores).
        // Se registra independientemente de en qué vehículo esté montado.
        Schema::create('extintor_inspecciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('extintor_id')->constrained('extintores')->cascadeOnDelete();

            // inicio | periodica
            $table->string('tipo', 20)->default('periodica');

            $table->date('fecha_inspeccion');

            // Quién hizo la inspección de inicio y quién la periódica
            // (cuando es de inicio, solo responsable_inicio tiene valor)
            $table->string('responsable_inicio', 120)->nullable();
            $table->string('responsable_periodico', 120)->nullable();

            // Recarga
            $table->date('fecha_recarga')->nullable();           // cuándo se recargó
            $table->date('fecha_proxima_recarga')->nullable();   // próxima programada

            $table->text('observaciones')->nullable();

            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['extintor_id', 'fecha_inspeccion']);
        });

        // ── Evidencias de cada inspección (PDF o imágenes) ────────────────────
        Schema::create('extintor_inspeccion_evidencias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inspeccion_id')
                ->constrained('extintor_inspecciones')
                ->cascadeOnDelete();
            $table->string('path', 500);            // ruta en storage/app/public
            $table->string('nombre_original', 255)->nullable(); // nombre del archivo subido
            $table->string('tipo_mime', 100)->nullable();       // image/jpeg, application/pdf…
            $table->unsignedSmallInteger('orden')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('extintor_inspeccion_evidencias');
        Schema::dropIfExists('extintor_inspecciones');
    }
};
