<?php

namespace App\Console\Commands;

use App\Models\Gente\ContratoProrroga;
use App\Models\Seguridad\Alerta;
use App\Models\Seguridad\Colaborador;
use App\Services\Seguridad\AlertaNotifier;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class RevisarVencimientoContratos extends Command
{
    protected $signature = 'seguridad:revisar-vencimiento-contratos 
                            {--force : Reenviar notificación a usuarios con rol Contratos aunque la alerta ya exista}
                            {--solo-frecuentes : Notificar únicamente a usuarios con la casilla de 3 veces al día marcada}';

    protected $description = 'Genera alertas para colaboradores cuyo contrato (o última prórroga) está próximo a vencer (HU03)';

    public function handle(): int
    {
        $diasAnticipacion = (int) config('seguridad.dias_alerta_vencimiento_contrato');
        $limite = Carbon::now()->addDays($diasAnticipacion);
        $procesadas = 0;
        $soloFrecuentes = (bool) $this->option('solo-frecuentes');

        Colaborador::query()
            ->completos()
            ->where('is_active', true)
            ->whereNotNull('fecha_retiro_empresa')
            ->whereDoesntHave('prorrogas', fn ($q) => $q->where('tipo', 'finalizacion'))
            ->with(['prorrogas' => fn ($q) => $q->where('tipo', 'prorroga')->orderByDesc('created_at')])
            ->each(function (Colaborador $colaborador) use ($limite, &$procesadas, $soloFrecuentes) {
                // Usar la fecha_nueva de la última prórroga si existe,
                // igual que como lo muestra la pantalla de contratos
                // (fecha_vencimiento_vigente = $ultimaProrroga?->fecha_nueva ?? fecha_retiro_empresa).
                $ultimaProrroga = $colaborador->prorrogas->first();
                $fechaVencimiento = $ultimaProrroga?->fecha_nueva ?? $colaborador->fecha_retiro_empresa;

                if (! $fechaVencimiento || $fechaVencimiento->gt($limite)) {
                    return;
                }

                $alerta = Alerta::query()
                    ->where('colaborador_id', $colaborador->id)
                    ->where('tipo', 'retiro_proximo')
                    ->where('atendida', false)
                    ->first();

                if (! $alerta) {
                    $alerta = Alerta::create([
                        'tipo' => 'retiro_proximo',
                        'colaborador_id' => $colaborador->id,
                        'mensaje' => "El contrato de {$colaborador->nombre_completo} vence el {$fechaVencimiento->toDateString()}.",
                    ]);
                }

                AlertaNotifier::notificar($alerta, $soloFrecuentes);
                $procesadas++;
            });

        $this->info("Alertas de vencimiento de contrato procesadas/notificadas: {$procesadas}");

        return self::SUCCESS;
    }
}
