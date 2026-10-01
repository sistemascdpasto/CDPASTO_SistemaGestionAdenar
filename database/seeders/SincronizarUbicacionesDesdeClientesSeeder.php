<?php

namespace Database\Seeders;

use App\Models\Reparto\ModulacionBarrio;
use App\Models\Reparto\ModulacionMunicipio;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Sincroniza municipios y barrios únicos de reparto_clientes
 * hacia las tablas modulacion_municipios y modulacion_barrios.
 *
 * Ejecutar con: php artisan db:seed --class=SincronizarUbicacionesDesdeClientesSeeder
 *
 * Idempotente: usa firstOrCreate, puede correrse múltiples veces sin duplicar.
 */
class SincronizarUbicacionesDesdeClientesSeeder extends Seeder
{
    public function run(): void
    {
        // Obtener pares únicos municipio+barrio desde reparto_clientes
        $pares = DB::table('reparto_clientes')
            ->select('municipio', 'barrio')
            ->whereNotNull('municipio')
            ->where('municipio', '!=', '')
            ->get();

        $municipiosSincronizados = 0;
        $barriosSincronizados    = 0;

        foreach ($pares as $par) {
            $nombreMunicipio = trim((string) $par->municipio);
            if ($nombreMunicipio === '') {
                continue;
            }

            $normMunicipio = $this->normalizar($nombreMunicipio);

            // Registrar municipio si no existe
            $municipio = ModulacionMunicipio::firstOrCreate(
                ['nombre_normalizado' => $normMunicipio],
                [
                    'nombre'             => mb_convert_case($nombreMunicipio, MB_CASE_TITLE, 'UTF-8'),
                    'nombre_normalizado' => $normMunicipio,
                    'origen'             => 'catalogo_clientes',
                ]
            );

            if ($municipio->wasRecentlyCreated) {
                $municipiosSincronizados++;
            }

            // Registrar barrio si existe y no está en el catálogo
            $nombreBarrio = trim((string) ($par->barrio ?? ''));
            if ($nombreBarrio === '') {
                continue;
            }

            $normBarrio = $this->normalizar($nombreBarrio);

            $barrio = ModulacionBarrio::firstOrCreate(
                [
                    'municipio_id'      => $municipio->id,
                    'nombre_normalizado' => $normBarrio,
                ],
                [
                    'nombre'             => mb_convert_case($nombreBarrio, MB_CASE_TITLE, 'UTF-8'),
                    'nombre_normalizado' => $normBarrio,
                    'origen'             => 'catalogo_clientes',
                ]
            );

            if ($barrio->wasRecentlyCreated) {
                $barriosSincronizados++;
            }
        }

        $this->command->info("Sincronización completada:");
        $this->command->info("  → {$municipiosSincronizados} municipios nuevos");
        $this->command->info("  → {$barriosSincronizados} barrios nuevos");
    }

    private function normalizar(string $nombre): string
    {
        return Str::ascii(mb_strtolower(trim(preg_replace('/\s+/u', ' ', $nombre) ?? $nombre), 'UTF-8'));
    }
}
