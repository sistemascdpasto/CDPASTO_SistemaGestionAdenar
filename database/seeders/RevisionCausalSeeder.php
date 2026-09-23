<?php

namespace Database\Seeders;

use App\Models\Reparto\RevisionCausal;
use Illuminate\Database\Seeder;

/**
 * Causales iniciales para las novedades de la Revisión Aleatoria de
 * Vehículos/SKU. Idempotente: no duplica si se corre más de una vez.
 */
class RevisionCausalSeeder extends Seeder
{
    public function run(): void
    {
        $causales = [
            'Faltante',
            'Producto roto',
            'Producto dañado',
            'Producto vencido',
            'Producto abierto',
            'Producto deteriorado',
            'Error de inventario',
        ];

        foreach ($causales as $orden => $nombre) {
            RevisionCausal::firstOrCreate(['nombre' => $nombre], ['orden' => $orden, 'is_active' => true]);
        }

        RevisionCausal::firstOrCreate(
            ['nombre' => 'Otro'],
            ['orden' => count($causales), 'is_active' => true, 'requiere_especificacion' => true],
        );
    }
}
