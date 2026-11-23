<?php

namespace App\Console\Commands;

use App\Models\Seguridad\Alerta;
use App\Models\Seguridad\Colaborador;
use App\Services\Seguridad\AlertaNotifier;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Revisión automática de vencimiento de contratos.
 *
 * Se programa en 4 turnos diarios (ver routes/console.php):
 *   - 07:00  → revisa umbrales de 40, 35 y 5 días
 *   - 12:00  → revisa solo umbral de 35 días (segundo turno)
 *   - 17:00  → revisa solo umbral de 35 días (tercer turno)
 *
 * Reglas de envío:
 *   - Día 40 exacto : 1 correo (turno 07:00)
 *   - Día 35 exacto : 3 correos (07:00, 12:00, 17:00)
 *   - Día 5  exacto : 1 correo (turno 07:00)
 *   - Cualquier otro día: no se envía nada
 *
 * "Exacto" significa que hoy faltan exactamente N días para el vencimiento.
 * El correo de cada turno se envía aunque ya exista una alerta atendida o
 * no atendida del día anterior — cada turno del día 35 es un envío nuevo.
 * Para los días 40 y 5, solo se envía una vez por día (el turno 07:00).
 *
 * Opciones:
 *   --solo-35 : solo procesa el umbral de 35 días (usado en turnos 12:00 y 17:00)
 */
class RevisarVencimientoContratos extends Command
{
    protected $signature = 'seguridad:revisar-vencimiento-contratos
                            {--solo-35 : Procesar únicamente el umbral de 35 días (turnos de mediodía y tarde)}';

    protected $description = 'Envía correos de alerta de vencimiento de contratos en los días exactos 40, 35 y 5.';

    public function handle(): int
    {
        $solo35 = (bool) $this->option('solo-35');

        // Umbrales activos en esta ejecución
        $umbrales = $solo35
            ? ['retiro_proximo' => (int) config('gente.dias_alerta_vencimiento_contrato', 35)]
            : [
                'retiro_proximo_40' => (int) config('gente.dias_alerta_vencimiento_contrato_40', 40),
                'retiro_proximo'    => (int) config('gente.dias_alerta_vencimiento_contrato', 35),
                'retiro_proximo_5'  => (int) config('gente.dias_alerta_vencimiento_contrato_5', 5),
            ];

        $notificados = 0;

        Colaborador::query()
            ->completos()
            ->where('is_active', true)
            ->whereNotNull('fecha_retiro_empresa')
            ->whereDoesntHave('prorrogas', fn ($q) => $q->where('tipo', 'finalizacion'))
            ->with(['prorrogas' => fn ($q) => $q->where('tipo', 'prorroga')->orderByDesc('created_at')])
            ->each(function (Colaborador $colaborador) use ($umbrales, &$notificados) {
                $ultimaProrroga   = $colaborador->prorrogas->first();
                $fechaVencimiento = $ultimaProrroga?->fecha_nueva ?? $colaborador->fecha_retiro_empresa;

                if (! $fechaVencimiento) {
                    return;
                }

                $diasRestantes = (int) Carbon::today()->diffInDays($fechaVencimiento, false);

                foreach ($umbrales as $tipo => $diasUmbral) {
                    // Solo dispara el día EXACTO del umbral
                    if ($diasRestantes !== $diasUmbral) {
                        continue;
                    }

                    // Crear la alerta en BD si no existe una pendiente del mismo tipo hoy
                    $alerta = Alerta::query()
                        ->where('colaborador_id', $colaborador->id)
                        ->where('tipo', $tipo)
                        ->where('atendida', false)
                        ->whereDate('created_at', Carbon::today())
                        ->first();

                    if (! $alerta) {
                        $alerta = Alerta::create([
                            'tipo'           => $tipo,
                            'colaborador_id' => $colaborador->id,
                            'mensaje'        => "El contrato de {$colaborador->nombre_completo} vence el {$fechaVencimiento->toDateString()} ({$diasRestantes} días restantes).",
                        ]);
                    }

                    // Enviar correo en este turno
                    AlertaNotifier::notificar($alerta);

                    $notificados++;
                }
            });

        $this->info("Contratos notificados en este turno: {$notificados}");

        return self::SUCCESS;
    }
}
