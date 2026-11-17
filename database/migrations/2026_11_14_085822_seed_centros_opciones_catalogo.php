<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $centros = ['UC', 'UD', 'KA', 'SUR', 'JL', 'MOVILIZADOR', 'INCAPACIDAD JL'];
        $centrosTrabajo = ['Sura riesgo I', 'Sura riesgo IV'];

        foreach ($centros as $nombre) {
            DB::table('opciones_catalogo')->insertOrIgnore([
                'categoria'        => 'centro',
                'nombre'           => $nombre,
                'es_personalizado' => false,
                'created_at'       => now(),
                'updated_at'       => now(),
            ]);
        }

        foreach ($centrosTrabajo as $nombre) {
            DB::table('opciones_catalogo')->insertOrIgnore([
                'categoria'        => 'centro_trabajo',
                'nombre'           => $nombre,
                'es_personalizado' => false,
                'created_at'       => now(),
                'updated_at'       => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('opciones_catalogo')
            ->whereIn('categoria', ['centro', 'centro_trabajo'])
            ->where('es_personalizado', false)
            ->delete();
    }
};
