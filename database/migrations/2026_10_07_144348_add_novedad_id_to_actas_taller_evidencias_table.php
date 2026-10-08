<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('actas_taller_evidencias', function (Blueprint $table) {
            $table->foreignId('novedad_id')
                ->nullable()
                ->after('acta_taller_id')
                ->constrained('actas_taller_novedades')
                ->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('actas_taller_evidencias', function (Blueprint $table) {
            $table->dropConstrainedForeignId('novedad_id');
        });
    }
};
