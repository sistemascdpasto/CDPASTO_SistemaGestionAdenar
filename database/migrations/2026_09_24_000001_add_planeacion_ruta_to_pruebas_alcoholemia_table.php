<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pruebas_alcoholemia', function (Blueprint $table) {
            $table->boolean('pertenece_planeacion')->default(false)->after('estado');
            $table->foreignId('modulacion_id')->nullable()->after('pertenece_planeacion')->constrained('modulaciones')->nullOnDelete();
            $table->string('ruta_asignada')->nullable()->after('modulacion_id');
        });
    }

    public function down(): void
    {
        Schema::table('pruebas_alcoholemia', function (Blueprint $table) {
            $table->dropForeign(['modulacion_id']);
            $table->dropColumn(['pertenece_planeacion', 'modulacion_id', 'ruta_asignada']);
        });
    }
};
