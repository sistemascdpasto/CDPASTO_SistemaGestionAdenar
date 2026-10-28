<?php

use App\Support\AlertaCatalogo;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `pilar` identifica a qué pilar (seguridad/gente/flota/reparto)
     * pertenece la alerta -- hoy cada pilar tenía su propio sistema de avisos
     * en paralelo (algunos solo por correo, sin pantalla); esta columna es la
     * que permite mostrarle a cada rol solo lo suyo y a Administrador todo
     * junto organizado por pilar. `contexto` guarda datos específicos del
     * tipo que no ameritan una FK dedicada (ej. placa/lat/lng de un vehículo
     * detenido, que no tiene relación garantizada con un Vehiculo).
     *
     * `pilar` queda nullable a nivel de BD (forzar NOT NULL exigiría
     * doctrine/dbal para change()) -- Alerta::booted() lo autocompleta desde
     * `tipo` en creating(), así que en la práctica siempre queda lleno.
     */
    public function up(): void
    {
        Schema::table('alertas', function (Blueprint $table) {
            $table->string('pilar', 20)->nullable()->after('tipo');
            $table->json('contexto')->nullable()->after('mensaje');
        });

        foreach (AlertaCatalogo::PILAR_POR_TIPO as $tipo => $pilar) {
            DB::table('alertas')->where('tipo', $tipo)->update(['pilar' => $pilar]);
        }
    }

    public function down(): void
    {
        Schema::table('alertas', function (Blueprint $table) {
            $table->dropColumn(['pilar', 'contexto']);
        });
    }
};
