<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use App\Notifications\Gente\NotificacionPruebaPeriodoColaborador;
use App\Notifications\Gente\NotificacionPruebasPeriodoHoy;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

class NotificarPruebasPeriodoHoy extends Command
{
    protected $signature = 'gente:notificar-pruebas-periodo {--force : Forzar envío sin importar si ya se envió hoy}';

    protected $description = 'Envía correo consolidado a Seguridad e individuales a cada colaborador con pruebas de 7, 30 y 90 días programadas para hoy.';

    public function handle(): int
    {
        $hoy = Carbon::today();
        $fechaKey = $hoy->format('Y-m-d');
        $cacheKeySeguridad = "pruebas_periodo_notificacion_enviada_{$fechaKey}";
        $fechaFormateada = $hoy->locale('es')->isoFormat('D [de] MMMM [de] YYYY');

        // Obtener colaboradores activos con fecha de ingreso
        $colaboradores = Colaborador::query()
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNotNull('fecha_ingreso_empresa')
                  ;
            })
            ->with(['pruebasPeriodo', 'user'])
            ->get();

        $itemsConsolidados = [];
        // 7 días se calcula como 9 días contando el mismo día de la fecha de contrato (+8 días)
        $etapasConfig = [
            '7_dias' => 8,
            '30_dias' => 30,
            '90_dias' => 90,
        ];

        $colaboradoresIndividualesEnviados = 0;

        foreach ($colaboradores as $colaborador) {
            $fechaIngreso = $colaborador->fecha_ingreso_empresa;
            if (! $fechaIngreso) {
                continue;
            }

            $fechaRetiro = $colaborador->fecha_retiro_empresa;

            foreach ($etapasConfig as $etapaKey => $dias) {
                $fechaPrueba = $fechaIngreso->copy()->addDays($dias);

                // Debe ser exactamente para HOY
                if (! $fechaPrueba->isSameDay($hoy)) {
                    continue;
                }

                // Debe cumplir la regla de retiro de contrato
                $aplicaRetiro = is_null($fechaRetiro) || $fechaRetiro->greaterThanOrEqualTo($fechaPrueba);
                if (! $aplicaRetiro) {
                    continue;
                }

                // Si ya fue realizada, no se incluye en los pendientes de hoy
                $yaRealizada = $colaborador->pruebasPeriodo->contains(
                    fn ($p) => $p->etapa === $etapaKey && $p->realizada
                );
                if ($yaRealizada) {
                    continue;
                }

                $etapaLabel = "{$dias} días";

                // Agregar al array para el correo consolidado de Seguridad
                $itemsConsolidados[] = [
                    'colaborador' => $colaborador->nombre_completo,
                    'cedula' => $colaborador->cedula,
                    'cargo' => $colaborador->cargo ?? 'Sin cargo',
                    'etapa_key' => $etapaKey,
                    'etapa_label' => $etapaLabel,
                    'fecha_programada' => $fechaPrueba->format('d/m/Y'),
                ];

                // -------------------------------------------------------------
                // ENVÍO INDIVIDUAL AL COLABORADOR
                // -------------------------------------------------------------
                $emailColaborador = $colaborador->correo ?: $colaborador->user?->email;
                if ($emailColaborador) {
                    $cacheKeyColaborador = "pruebas_periodo_colaborador_{$colaborador->id}_{$etapaKey}_{$fechaKey}";

                    if ($this->option('force') || ! Cache::has($cacheKeyColaborador)) {
                        try {
                            Notification::route('mail', $emailColaborador)
                                ->notify(new NotificacionPruebaPeriodoColaborador(
                                    $colaborador,
                                    $etapaKey,
                                    $etapaLabel,
                                    $fechaFormateada
                                ));

                            Cache::put($cacheKeyColaborador, true, now()->addDays(7));
                            $colaboradoresIndividualesEnviados++;
                        } catch (Throwable $e) {
                            Log::warning("No se pudo enviar el correo individual de prueba a colaborador {$colaborador->id}.", [
                                'email' => $emailColaborador,
                                'error' => $e->getMessage(),
                            ]);
                        }
                    }
                }
            }
        }

        // -------------------------------------------------------------
        // ENVÍO CONSOLIDADO AL ÁREA DE SEGURIDAD
        // -------------------------------------------------------------
        if (empty($itemsConsolidados)) {
            $this->info("No hay pruebas de período de prueba programadas para hoy ({$fechaKey}). No se enviaron correos.");
            return self::SUCCESS;
        }

        if ($this->option('force') || ! Cache::has($cacheKeySeguridad)) {
            $destinatariosSeguridad = User::role([Role::Seguridad->value, Role::Administrador->value])
                ->whereNotNull('email')
                ->get();

            $enviadosSeguridad = 0;
            foreach ($destinatariosSeguridad as $destinatario) {
                try {
                    Notification::send($destinatario, new NotificacionPruebasPeriodoHoy($itemsConsolidados, $fechaFormateada));
                    $enviadosSeguridad++;
                } catch (Throwable $e) {
                    Log::warning('No se pudo enviar la notificación consolidada de pruebas a Seguridad.', [
                        'destinatario' => $destinatario->email,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            Cache::put($cacheKeySeguridad, true, now()->addDays(7));
            $this->info("Correo consolidado enviado a {$enviadosSeguridad} usuario(s) de Seguridad.");
        } else {
            $this->info("La notificación consolidada para Seguridad de hoy ({$fechaKey}) ya fue enviada previamente.");
        }

        $this->info("Correos individuales enviados a colaboradores: {$colaboradoresIndividualesEnviados}.");

        return self::SUCCESS;
    }
}
