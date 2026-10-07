<?php

namespace App\Console\Commands;

use App\Models\Seguridad\Alerta;
use App\Models\Seguridad\Colaborador;
use App\Services\Seguridad\AlertaNotifier;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class RevisarVencimientoContratos extends Command
{
    protected $signature = 'seguridad:revisar-vencimiento-contratos';

    protected $description = 'Genera alertas para colaboradores cuyo contrato está próximo a vencer (HU03)';

    public function handle(): int
    {
        $limite = Carbon::now()->addDays((int) config('seguridad.dias_alerta_vencimiento_contrato'));
        $creadas = 0;

        Colaborador::query()
            ->completos()
            ->where('is_active', true)
            ->whereNotNull('fecha_retiro_empresa')
            ->where('fecha_retiro_empresa', '<=', $limite)
            ->each(function (Colaborador $colaborador) use (&$creadas) {
                $yaExiste = Alerta::query()
                    ->where('colaborador_id', $colaborador->id)
                    ->where('tipo', 'retiro_proximo')
                    ->where('atendida', false)
                    ->exists();

                if (! $yaExiste) {
                    $alerta = Alerta::create([
                        'tipo' => 'retiro_proximo',
                        'colaborador_id' => $colaborador->id,
                        'mensaje' => "El contrato de {$colaborador->nombre_completo} vence el {$colaborador->fecha_retiro_empresa->toDateString()}.",
                    ]);
                    AlertaNotifier::notificar($alerta);
                    $creadas++;
                }
            });

        $this->info("Alertas de vencimiento de contrato generadas: {$creadas}");

        return self::SUCCESS;
    }
}
