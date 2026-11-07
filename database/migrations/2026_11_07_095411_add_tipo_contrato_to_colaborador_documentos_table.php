<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('colaborador_documentos', function (Blueprint $table) {
            $table->string('tipo_contrato')->nullable()->after('nombre_original');
        });
    }

    public function down(): void
    {
        Schema::table('colaborador_documentos', function (Blueprint $table) {
            $table->dropColumn('tipo_contrato');
        });
    }
};
