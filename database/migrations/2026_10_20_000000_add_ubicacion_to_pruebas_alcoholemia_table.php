<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Dónde se tomó cada prueba: la marca de agua de las fotos ya no queda fija en Pasto.
     */
    public function up(): void
    {
        Schema::table('pruebas_alcoholemia', function (Blueprint $table) {
            $table->string('ubicacion', 160)->nullable()->after('ruta_asignada');
            $table->decimal('latitud', 10, 7)->nullable()->after('ubicacion');
            $table->decimal('longitud', 10, 7)->nullable()->after('latitud');
            // gps: ubicación del dispositivo · ip: aproximada por IP · predeterminada: sin datos.
            $table->string('ubicacion_fuente', 15)->nullable()->after('longitud');
        });
    }

    public function down(): void
    {
        Schema::table('pruebas_alcoholemia', function (Blueprint $table) {
            $table->dropColumn(['ubicacion', 'latitud', 'longitud', 'ubicacion_fuente']);
        });
    }
};
