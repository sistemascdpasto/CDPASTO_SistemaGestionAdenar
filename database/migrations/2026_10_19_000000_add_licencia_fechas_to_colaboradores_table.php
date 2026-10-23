<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('colaboradores', function (Blueprint $table) {
            $table->date('fecha_licencia')->nullable()->after('es_padrino');
            $table->date('fecha_vencimiento_licencia')->nullable()->after('fecha_licencia');
        });
    }

    public function down(): void
    {
        Schema::table('colaboradores', function (Blueprint $table) {
            $table->dropColumn(['fecha_licencia', 'fecha_vencimiento_licencia']);
        });
    }
};
