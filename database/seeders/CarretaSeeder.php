<?php

namespace Database\Seeders;

use App\Models\Flota\Carreta;
use Illuminate\Database\Seeder;

/**
 * Carga inicial de las 51 carretas de tipo Furgón con identificación
 * provisional (F-001 a F-051) — Brian las edita luego desde el CRUD con la
 * identificación real de cada una. Idempotente: no duplica si se corre más
 * de una vez.
 */
class CarretaSeeder extends Seeder
{
    public function run(): void
    {
        for ($i = 1; $i <= 51; $i++) {
            $identificacion = 'F-'.str_pad((string) $i, 3, '0', STR_PAD_LEFT);

            Carreta::firstOrCreate(
                ['identificacion' => $identificacion],
                ['tipo' => 'Furgón', 'is_active' => true],
            );
        }
    }
}
