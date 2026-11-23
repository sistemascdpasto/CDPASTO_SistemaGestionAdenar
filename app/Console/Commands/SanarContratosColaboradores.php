<?php

namespace App\Console\Commands;

use App\Models\Gente\ColaboradorContrato;
use App\Models\Seguridad\Colaborador;
use Illuminate\Console\Command;

/**
 * Comando de saneamiento de datos: detecta colaboradores con
 * fecha_ingreso_empresa pero sin ningún registro en colaborador_contratos
 * y crea el primer contrato para cada uno.
 *
 * Se ejecuta una sola vez después del deploy que añadió la garantía de
 * sincronización automática en updatePaso3. No tiene efectos adversos si se
 * ejecuta varias veces (solo actúa sobre los que no tienen contratos).
 *
 * Uso:
 *   php artisan gente:sanar-contratos
 */
class SanarContratosColaboradores extends Command
{
    protected $signature = 'gente:sanar-contratos
                            {--dry-run : Muestra los colaboradores afectados sin crear registros}';

    protected $description = 'Crea el primer contrato para colaboradores con fecha_ingreso_empresa pero sin contratos en la tabla colaborador_contratos.';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $colaboradores = Colaborador::query()
            ->completos()
            ->whereNotNull('fecha_ingreso_empresa')
            ->whereDoesntHave('contratos')
            ->get(['id', 'nombres', 'apellidos', 'cedula', 'tipo_contrato', 'cargo', 'area', 'fecha_ingreso_empresa', 'fecha_retiro_empresa']);

        if ($colaboradores->isEmpty()) {
            $this->info('No se encontraron colaboradores sin contratos. Todo está sincronizado.');
            return self::SUCCESS;
        }

        $this->info("Colaboradores sin contratos: {$colaboradores->count()}");

        if ($dryRun) {
            $this->table(
                ['ID', 'Nombre', 'Cédula', 'Fecha ingreso', 'Tipo contrato'],
                $colaboradores->map(fn ($c) => [
                    $c->id,
                    "{$c->nombres} {$c->apellidos}",
                    $c->cedula,
                    $c->fecha_ingreso_empresa?->toDateString(),
                    $c->tipo_contrato ?? '(sin tipo)',
                ])->all(),
            );
            $this->line('Modo --dry-run: no se crearon registros.');
            return self::SUCCESS;
        }

        $creados = 0;
        foreach ($colaboradores as $colaborador) {
            $colaborador->contratos()->create([
                'tipo_contrato' => $colaborador->tipo_contrato,
                'cargo'         => $colaborador->cargo,
                'area'          => $colaborador->area,
                'fecha_inicio'  => $colaborador->fecha_ingreso_empresa->toDateString(),
                'fecha_fin'     => $colaborador->fecha_retiro_empresa?->toDateString(),
                'estado'        => 'activo',
            ]);
            $creados++;
            $this->line("  ✓ {$colaborador->nombres} {$colaborador->apellidos} ({$colaborador->cedula})");
        }

        $this->info("Contratos creados: {$creados}");
        return self::SUCCESS;
    }
}
