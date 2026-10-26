<?php

use App\Models\Flota\Vehiculo;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Meta estándar de rendimiento para toda la flota (pilar Flota, pedida
     * por Brian): 11 km/galón. Se aplica a todos los vehículos existentes y
     * queda como valor por defecto para los que se creen después.
     */
    public function up(): void
    {
        // Sigue nullable (no NOT NULL): "sin meta asignada" sigue siendo un
        // estado válido que el dashboard distingue de "bajo meta" — solo
        // cambia el valor por defecto para los vehículos que se creen sin
        // especificarlo.
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->decimal('meta_km_gl', 6, 2)->default(11)->nullable()->change();
        });

        Vehiculo::query()->update(['meta_km_gl' => 11]);
    }

    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->decimal('meta_km_gl', 6, 2)->nullable()->default(null)->change();
        });
    }
};
