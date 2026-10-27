<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Backfill de datos (no de esquema): el km diario ya sincronizado antes
     * de corregir App\Services\Flota\MygeotabKilometrosSyncService::normalizarPlaca()
     * quedó guardado con el prefijo "CO" que antepone MyGeotab (ej.
     * "COLJU894" en vez de "LJU894", la placa real que usan Documentación,
     * Planeación de Ruta y los vouchers). Corrige las filas existentes para
     * que el cruce funcione también con el histórico, no solo con lo que
     * se sincronice de aquí en adelante.
     */
    public function up(): void
    {
        $filas = DB::table('vehiculo_kilometros_diarios')
            ->where('placa', 'LIKE', 'CO%')
            ->whereRaw('LENGTH(placa) = 8')
            ->get(['id', 'fecha', 'placa']);

        foreach ($filas as $fila) {
            $placaReal = substr($fila->placa, 2);

            $yaExiste = DB::table('vehiculo_kilometros_diarios')
                ->where('fecha', $fila->fecha)
                ->where('placa', $placaReal)
                ->exists();

            if ($yaExiste) {
                // Ya hay una fila con la placa normalizada para esa fecha
                // (sincronizada después del fix) — se descarta el duplicado
                // viejo con el prefijo "CO" en vez de violar el único
                // (fecha, placa).
                DB::table('vehiculo_kilometros_diarios')->where('id', $fila->id)->delete();
            } else {
                DB::table('vehiculo_kilometros_diarios')->where('id', $fila->id)->update(['placa' => $placaReal]);
            }
        }
    }

    /**
     * Irreversible: una vez fusionadas, no queda registro de qué filas
     * tenían originalmente el prefijo "CO".
     */
    public function down(): void {}
};
