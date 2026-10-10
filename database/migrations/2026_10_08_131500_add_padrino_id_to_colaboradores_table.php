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
        Schema::table('colaboradores', function (Blueprint $table) {
            $table->foreignId('padrino_id')
                ->nullable()
                ->after('tipo_padrino')
                ->constrained('colaboradores')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('colaboradores', function (Blueprint $table) {
            $table->dropForeign(['padrino_id']);
            $table->dropColumn('padrino_id');
        });
    }
};
