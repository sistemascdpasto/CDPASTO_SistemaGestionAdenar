<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('colaborador_padrino_historial', function (Blueprint $table) {
            $table->id();

            // El colaborador que fue apadrinado
            $table->unsignedBigInteger('colaborador_id');
            $table->foreign('colaborador_id', 'fk_cph_colaborador')
                ->references('id')->on('colaboradores')->cascadeOnDelete();

            // El padrino que lo guió
            $table->unsignedBigInteger('padrino_id');
            $table->foreign('padrino_id', 'fk_cph_padrino')
                ->references('id')->on('colaboradores')->cascadeOnDelete();

            $table->date('fecha_inicio');
            $table->date('fecha_fin')->nullable(); // null = relación activa aún

            $table->timestamps();

            $table->index(['colaborador_id', 'fecha_inicio']);
            $table->index(['padrino_id', 'fecha_inicio']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('colaborador_padrino_historial');
    }
};
