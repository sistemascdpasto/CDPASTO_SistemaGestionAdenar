<?php

use App\Models\Gente\OpcionCatalogo;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $cargos = ['Conductor', 'Auxiliar logístico', 'Supervisor de ruta'];

        foreach ($cargos as $nombre) {
            OpcionCatalogo::firstOrCreate(
                ['categoria' => 'cargo_anterior', 'nombre' => $nombre],
                ['es_personalizado' => false]
            );
        }

        // Migrar valores antiguos al nuevo formato (label legible)
        $mapa = [
            'conductor' => 'Conductor',
            'auxiliar_logistico' => 'Auxiliar logístico',
            'supervisor_ruta' => 'Supervisor de ruta',
        ];

        foreach ($mapa as $old => $new) {
            DB::table('colaboradores')
                ->where('cargo_anterior', $old)
                ->update(['cargo_anterior' => $new]);
        }
    }

    public function down(): void
    {
        OpcionCatalogo::where('categoria', 'cargo_anterior')->delete();
    }
};
