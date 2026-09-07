<?php

namespace Database\Seeders;

use App\Models\Seguridad\GlossaryTerm;
use Illuminate\Database\Seeder;

/**
 * Carga el glosario técnico oficial de INVÍAS (invias.gov.co/glosario).
 *
 * El sitio de INVÍAS bloquea por IP los datacenters extranjeros (Railway está
 * en NL y recibe 403), así que el comando `glossary:scrape` no puede
 * ejecutarse en producción. Los términos se scrapean desde una IP colombiana
 * y se versionan en database/data/glosario_invias.json; este seeder los
 * sincroniza sin pisar los términos editados a mano (source = 'manual').
 */
class GlosarioInviasSeeder extends Seeder
{
    public const CATEGORIA = 'GLOSARIO TÉCNICO INVÍAS';

    public function run(): void
    {
        $ruta = database_path('data/glosario_invias.json');

        if (! is_file($ruta)) {
            $this->command?->warn("No se encontró {$ruta}; se omite el glosario INVÍAS.");

            return;
        }

        /** @var array<int, array{nombre: string, definicion: string}> $terminos */
        $terminos = json_decode((string) file_get_contents($ruta), true) ?: [];

        $creados = 0;
        $actualizados = 0;

        foreach ($terminos as $termino) {
            $nombre = trim($termino['nombre'] ?? '');
            $definicion = trim($termino['definicion'] ?? '');

            if ($nombre === '' || $definicion === '') {
                continue;
            }

            $existente = GlossaryTerm::withTrashed()
                ->where('nombre', $nombre)
                ->where('categoria', self::CATEGORIA)
                ->first();

            if ($existente) {
                // No se toca lo editado a mano.
                if ($existente->isManual()) {
                    continue;
                }

                if ($existente->definicion !== $definicion) {
                    $existente->update(['definicion' => $definicion]);
                    $actualizados++;
                }

                continue;
            }

            GlossaryTerm::create([
                'nombre' => $nombre,
                'definicion' => $definicion,
                'categoria' => self::CATEGORIA,
                'source' => 'scraped',
            ]);
            $creados++;
        }

        $this->command?->info("Glosario INVÍAS: {$creados} creados, {$actualizados} actualizados (".count($terminos).' en el archivo).');
    }
}
