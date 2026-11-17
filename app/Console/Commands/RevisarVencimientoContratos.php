<?php

namespace App\Console\Commands;

use App\Models\Seguridad\Alerta;
use App\Models\Seguridad\Colaborador;
use App\Services\Gente\ContratosNotifier;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class RevisarVencimientoContratos extends Command
{
    protected $signature = 'seguridad:revisar-vencimiento-contratos
                            {--solo-frecuentes : Notificar únicamente a usuarios con la casilla de 3 veces al día marcada}';

    protected $description = 'Envía correo con los contratos próximos a vencer que tengan alerta activa (HU03). Se ejecuta 3 veces al día vía scheduler.';

    public function handle(): int
    {
        $diasAnticipacion = (int) config('seguridad.dias_alerta_vencimiento_contrato');
        $limite           = Carbon::now()->addDays($diasAnticipacion);
        $soloFrecuentes   = (bool) $this->option('solo-frecuentes');

        $contratos = new Collection();

        Colaborador::query()
            ->completos()
            ->where('is_active', true)
            ->whereNotNull('fecha_retiro_empresa')
            ->whereDoesntHave('prorrogas', fn ($q) => $q->where('tipo', 'finalizacion'))
            ->with(['prorrogas' => fn ($q) => $q->where('tipo', 'prorroga')->orderByDesc('created_at')])
            ->each(function (Colaborador $colaborador) use ($limite, &$contratos) {
                $ultimaProrroga   = $colaborador->prorrogas->first();
                $fechaVencimiento = $ultimaProrroga?->fecha_nueva ?? $colaborador->fecha_retiro_empresa;

                if (! $fechaVencimiento || $fechaVencimiento->gt($limite)) {
                    return;
                }

                // Crear la alerta en BD si no existe una pendiente
                $alerta = Alerta::query()
                    ->where('colaborador_id', $colaborador->id)
                    ->where('tipo', 'retiro_proximo')
                    ->where('atendida', false)
                    ->first();

                if (! $alerta) {
                    $alerta = Alerta::create([
                        'tipo'           => 'retiro_proximo',
                        'colaborador_id' => $colaborador->id,
                        'mensaje'        => "El contrato de {$colaborador->nombre_completo} vence el {$fechaVencimiento->toDateString()}.",
                    ]);
                }

                // Solo incluir en el correo si la alerta sigue activa (pendiente)
                if (! $alerta->atendida) {
                    $contratos->push([
                        'nombre_completo'   => $colaborador->nombre_completo,
                        'fecha_vencimiento' => $fechaVencimiento,
                    ]);
                }
            });

        if ($contratos->isNotEmpty()) {
            $contratos = $contratos->sortBy('fecha_vencimiento')->values();
            ContratosNotifier::notificarVencimientos($contratos, $soloFrecuentes);
        }

        $this->info("Contratos con alerta activa notificados: {$contratos->count()}");

        return self::SUCCESS;
    }
}
