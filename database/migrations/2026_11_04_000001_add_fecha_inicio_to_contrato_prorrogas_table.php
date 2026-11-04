<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contrato_prorrogas', function (Blueprint $table) {
            $table->date('fecha_inicio')->nullable()->after('fecha_anterior');
        });
    }

    public function down(): void
    {
        Schema::table('contrato_prorrogas', function (Blueprint $table) {
            $table->dropColumn('fecha_inicio');
        });
    }
};
