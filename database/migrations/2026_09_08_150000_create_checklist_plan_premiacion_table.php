<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla para el estado manual del checklist (Pre y Post) del Plan de Premiación.
 *
 * Por defecto todos los Conductores de Reparto tienen Aprobado (cl_pre = true, cl_post = true).
 * Un administrador puede cambiar individualmente a No Aprobado (false).
 * Solo se insertan registros cuando el estado difiere del default (true).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checklist_plan_premiacion', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('colaborador_id');
            $table->foreign('colaborador_id')
                  ->references('id')
                  ->on('colaboradores')
                  ->onDelete('cascade');

            $table->tinyInteger('mes');    // 1-12
            $table->smallInteger('anio'); // ej. 2026

            // true = Aprobado (100%), false = No Aprobado (0%)
            $table->boolean('cl_pre')->default(true);
            $table->boolean('cl_post')->default(true);

            // Quién hizo el último cambio
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->foreign('updated_by')
                  ->references('id')
                  ->on('users')
                  ->onDelete('set null');

            $table->timestamps();

            // Un registro por conductor/mes/año
            $table->unique(['colaborador_id', 'mes', 'anio']);

            $table->index(['mes', 'anio']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checklist_plan_premiacion');
    }
};
