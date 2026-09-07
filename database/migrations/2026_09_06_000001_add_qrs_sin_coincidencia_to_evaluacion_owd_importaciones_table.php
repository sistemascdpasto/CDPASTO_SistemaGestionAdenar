<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('evaluacion_owd_importaciones', function (Blueprint $table) {
            // Array de objetos {qr, evaluado} para cada fila sin coincidencia de QR
            $table->json('qrs_sin_coincidencia')->nullable()->after('columnas_nuevas_detectadas');
        });
    }

    public function down(): void
    {
        Schema::table('evaluacion_owd_importaciones', function (Blueprint $table) {
            $table->dropColumn('qrs_sin_coincidencia');
        });
    }
};
