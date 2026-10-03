<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('colaborador_prueba_periodo_evidencias')) {
            Schema::table('colaborador_prueba_periodo_evidencias', function (Blueprint $table) {
                if (!Schema::hasColumn('colaborador_prueba_periodo_evidencias', 'colaborador_prueba_periodo_id')) {
                    $table->foreignId('colaborador_prueba_periodo_id')
                        ->nullable()
                        ->constrained('colaborador_pruebas_periodo', indexName: 'fk_cppe_cpp_id')
                        ->cascadeOnDelete();
                }
                if (!Schema::hasColumn('colaborador_prueba_periodo_evidencias', 'path')) {
                    $table->string('path')->nullable();
                }
            });
        } else {
            Schema::create('colaborador_prueba_periodo_evidencias', function (Blueprint $table) {
                $table->id();
                $table->foreignId('colaborador_prueba_periodo_id')
                    ->constrained('colaborador_pruebas_periodo', indexName: 'fk_cppe_cpp_id')
                    ->cascadeOnDelete();
                $table->string('path');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        // No se elimina la tabla existente para preservar los datos
    }
};
