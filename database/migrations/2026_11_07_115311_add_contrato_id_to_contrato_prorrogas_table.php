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
        Schema::table('contrato_prorrogas', function (Blueprint $table) {
            $table->foreignId('contrato_id')
                ->nullable()
                ->after('colaborador_id')
                ->constrained('colaborador_contratos')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('contrato_prorrogas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('contrato_id');
        });
    }
};
