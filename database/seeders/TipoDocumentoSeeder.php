<?php

namespace Database\Seeders;

use App\Models\Gente\TipoDocumento;
use Illuminate\Database\Seeder;

class TipoDocumentoSeeder extends Seeder
{
    public function run(): void
    {
        $tipos = [
            'Cédula de ciudadanía',
            'Tarjeta de identidad',
            'Cédula de extranjería',
            'Pasaporte',
            'Permiso Especial de Permanencia (PEP)',
            'Registro civil',
        ];

        foreach ($tipos as $nombre) {
            TipoDocumento::firstOrCreate(
                ['nombre' => $nombre],
                ['es_personalizado' => false]
            );
        }
    }
}
