<?php

namespace Database\Seeders;

use App\Models\Producto;
use Illuminate\Database\Seeder;

/**
 * Carga el catálogo de productos (SKU) que usa la Revisión Aleatoria de
 * Vehículos/SKU (Reparto) para el buscador de producto/novedad.
 *
 * Los datos se versionan en database/data/productos.json (exportados desde
 * el archivo de referencia del área comercial); este seeder es idempotente
 * — actualiza por sku si ya existe, no duplica al volver a correrlo.
 */
class ProductoSeeder extends Seeder
{
    public function run(): void
    {
        $ruta = database_path('data/productos.json');

        if (! is_file($ruta)) {
            $this->command?->warn("No se encontró {$ruta}; se omite la carga de productos.");

            return;
        }

        /** @var array<int, array{sku: string, descripcion: string, tipo: ?string, hl_unidad: ?float}> $productos */
        $productos = json_decode((string) file_get_contents($ruta), true) ?: [];

        $creados = 0;
        $actualizados = 0;

        foreach ($productos as $data) {
            $sku = trim((string) ($data['sku'] ?? ''));
            $descripcion = trim((string) ($data['descripcion'] ?? ''));

            if ($sku === '' || $descripcion === '') {
                continue;
            }

            $existente = Producto::where('sku', $sku)->first();

            $atributos = [
                'descripcion' => $descripcion,
                'tipo' => $data['tipo'] ?? null,
                'hl_unidad' => $data['hl_unidad'] ?? null,
            ];

            if ($existente) {
                if (! $this->coincide($existente, $atributos)) {
                    $existente->update($atributos);
                    $actualizados++;
                }

                continue;
            }

            Producto::create(['sku' => $sku, ...$atributos]);
            $creados++;
        }

        $this->command?->info("Productos: {$creados} creados, {$actualizados} actualizados (".count($productos).' en el archivo).');
    }

    /**
     * Compara evitando el falso positivo de igualdad de floats: hl_unidad
     * vuelve de MySQL con la representación binaria propia de PHP, que no
     * siempre es bit-a-bit idéntica al valor recién parseado del JSON aunque
     * sea matemáticamente el mismo número.
     *
     * @param  array{descripcion: string, tipo: ?string, hl_unidad: ?float}  $atributos
     */
    private function coincide(Producto $existente, array $atributos): bool
    {
        if ($existente->descripcion !== $atributos['descripcion'] || $existente->tipo !== $atributos['tipo']) {
            return false;
        }

        if ($existente->hl_unidad === null || $atributos['hl_unidad'] === null) {
            return $existente->hl_unidad === $atributos['hl_unidad'];
        }

        return abs($existente->hl_unidad - $atributos['hl_unidad']) < 0.0000001;
    }
}
