<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Catálogo de columnas dinámicas del checklist ───────────────────
        // Cada fila es una columna que el usuario definió (ej. "Presión (bar)",
        // "Carga kg", "Sello OK"). Se usa tanto al colocar como al retirar.
        Schema::create('extintor_columnas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 120)->unique();
            $table->unsignedSmallInteger('orden')->default(0);
            $table->timestamps();
        });

        // ── 2. Entidad principal: el extintor ─────────────────────────────────
        // Identificado por su número de serie. No tiene placa — se mueve entre
        // vehículos, eso se registra en extintor_asignaciones.
        Schema::create('extintores', function (Blueprint $table) {
            $table->id();
            $table->string('numero_serie', 80)->unique();   // identificador físico
            $table->string('tipo_agente', 80)->nullable();  // CO2, ABC, PQS, etc.
            $table->decimal('capacidad_kg', 6, 2)->nullable(); // capacidad en kg/lb
            $table->string('marca', 80)->nullable();
            $table->date('fecha_fabricacion')->nullable();
            $table->date('fecha_vencimiento')->nullable();  // próxima recarga/retiro
            $table->text('observaciones')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();
            $table->timestamps();
        });

        // ── 3. Historial de asignaciones a vehículos ─────────────────────────
        // Una fila = una estadía del extintor en un vehículo.
        // Si fecha_retiro es NULL el extintor sigue montado en ese vehículo.
        Schema::create('extintor_asignaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('extintor_id')->constrained('extintores')->cascadeOnDelete();
            $table->string('placa', 20);                      // vehículo
            $table->date('fecha_colocacion');                  // cuándo se montó
            $table->date('fecha_retiro')->nullable();          // cuándo se retiró (null = activo)
            // Checklist al COLOCAR (valores de las columnas dinámicas)
            // Ej. {"Presión (bar)":"12","Sello OK":"Sí"}
            $table->json('checklist_colocacion')->nullable();
            // Checklist al RETIRAR
            $table->json('checklist_retiro')->nullable();
            // Responsables
            $table->string('responsable_colocacion', 120)->nullable();
            $table->string('responsable_retiro', 120)->nullable();
            $table->text('observaciones_colocacion')->nullable();
            $table->text('observaciones_retiro')->nullable();
            $table->foreignId('user_coloco')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('user_retiro')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['extintor_id', 'fecha_colocacion']);
            $table->index(['placa', 'fecha_colocacion']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('extintor_asignaciones');
        Schema::dropIfExists('extintores');
        Schema::dropIfExists('extintor_columnas');
    }
};
