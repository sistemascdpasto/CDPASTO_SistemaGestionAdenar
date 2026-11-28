<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Normaliza todos los cargos existentes a MAYÚSCULAS en las tablas donde
 * el cargo es texto libre:
 *
 *   colaboradores.cargo
 *   colaborador_cargos.cargo
 *   colaborador_contratos.cargo
 *   cargos.nombre
 *   eventos_tripulacion.cargo
 *   compensaciones_variables_diarias.cargo
 *   modulacion_items.cargo
 *   modulacion_novedades.cargo
 *   modulacion_items.tripulacion (JSON: cargo de cada miembro)
 *
 * Así todo el sistema muestra: CONDUCTOR, AUXILIAR DE REPARTO, RESPONSABLE DE REPARTO.
 */
return new class extends Migration
{
    public function up(): void
    {
        $tablas = [
            ['colaboradores', 'cargo'],
            ['colaborador_cargos', 'cargo'],
            ['colaborador_contratos', 'cargo'],
            ['cargos', 'nombre'],
            ['eventos_tripulacion', 'cargo'],
            ['compensaciones_variables_diarias', 'cargo'],
            ['modulacion_items', 'cargo'],
            ['modulacion_novedades', 'cargo'],
        ];

        foreach ($tablas as [$tabla, $columna]) {
            if (! $this->tablaExiste($tabla)) {
                continue;
            }

            DB::table($tabla)
                ->whereNotNull($columna)
                ->where($columna, '!=', '')
                ->update([$columna => DB::raw("UPPER(TRIM({$columna}))")]);
        }

        // JSON de tripulación en modulacion_items: cargo de cada miembro a mayúsculas
        if ($this->tablaExiste('modulacion_items')) {
            $items = DB::table('modulacion_items')
                ->whereNotNull('tripulacion')
                ->where('tripulacion', '!=', '[]')
                ->where('tripulacion', '!=', '')
                ->get(['id', 'tripulacion']);

            foreach ($items as $item) {
                $tripulacion = json_decode($item->tripulacion, true);
                if (! is_array($tripulacion)) {
                    continue;
                }

                $cambio = false;
                foreach ($tripulacion as $i => $miembro) {
                    if (is_array($miembro) && ! empty($miembro['cargo'])) {
                        $mayus = mb_strtoupper(trim((string) $miembro['cargo']), 'UTF-8');
                        if ($mayus !== $miembro['cargo']) {
                            $tripulacion[$i]['cargo'] = $mayus;
                            $cambio = true;
                        }
                    }
                }

                if ($cambio) {
                    DB::table('modulacion_items')
                        ->where('id', $item->id)
                        ->update(['tripulacion' => json_encode($tripulacion, JSON_UNESCAPED_UNICODE)]);
                }
            }
        }
    }

    public function down(): void
    {
        // No reversible: no se guarda la capitalización original.
    }

    private function tablaExiste(string $tabla): bool
    {
        return Schema::hasTable($tabla);
    }
};
