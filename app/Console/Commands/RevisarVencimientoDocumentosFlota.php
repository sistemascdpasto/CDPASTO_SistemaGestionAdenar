<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\Flota\Vehiculo;
use App\Models\User;
use App\Notifications\Flota\VencimientoDocumentoVehiculo;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

class RevisarVencimientoDocumentosFlota extends Command
{
    protected $signature = 'flota:revisar-vencimiento-documentos';

    protected $description = 'Notifica por correo a Flota/Administrador/Reparto los vehículos con SOAT (15 días antes) o tecnomecánica (30 días antes) próximos a vencer.';

    /**
     * Configuración por tipo de documento: columna con la fecha de
     * vencimiento, columna que registra para qué fecha ya se avisó, y días
     * de anticipación del aviso.
     *
     * @var array<string, array{fecha: string, control: string, dias_config: string}>
     */
    private const DOCUMENTOS = [
        VencimientoDocumentoVehiculo::TIPO_SOAT => [
            'fecha' => 'fecha_vencimiento_soat',
            'control' => 'soat_alerta_enviada_para',
            'dias_config' => 'flota.dias_alerta_soat',
        ],
        VencimientoDocumentoVehiculo::TIPO_TECNOMECANICA => [
            'fecha' => 'fecha_vencimiento_tecnomecanica',
            'control' => 'tecnomecanica_alerta_enviada_para',
            'dias_config' => 'flota.dias_alerta_tecnomecanica',
        ],
    ];

    public function handle(): int
    {
        $destinatarios = User::role([
            Role::Flota->value,
            Role::Administrador->value,
            Role::Reparto->value,
        ])
            ->whereNotNull('email')
            ->get();

        if ($destinatarios->isEmpty()) {
            $this->warn('No hay usuarios con rol Flota, Administrador o Reparto con correo registrado.');

            return self::SUCCESS;
        }

        $hoy = Carbon::today();
        $enviadas = 0;

        foreach (self::DOCUMENTOS as $tipo => $config) {
            $limite = $hoy->copy()->addDays((int) config($config['dias_config']));

            Vehiculo::query()
                ->whereNotNull($config['fecha'])
                ->whereDate($config['fecha'], '<=', $limite)
                ->where(function ($query) use ($config) {
                    $query->whereNull($config['control'])
                        ->orWhereColumn($config['control'], '!=', $config['fecha']);
                })
                ->each(function (Vehiculo $vehiculo) use ($tipo, $config, $destinatarios, &$enviadas) {
                    $fechaVencimiento = $vehiculo->{$config['fecha']};

                    foreach ($destinatarios as $destinatario) {
                        try {
                            Notification::send(
                                $destinatario,
                                new VencimientoDocumentoVehiculo($vehiculo, $tipo, $fechaVencimiento)
                            );
                        } catch (Throwable $e) {
                            Log::warning('No se pudo enviar el aviso de vencimiento de documento de flota.', [
                                'vehiculo_id' => $vehiculo->id,
                                'tipo' => $tipo,
                                'destinatario' => $destinatario->email,
                                'error' => $e->getMessage(),
                            ]);
                        }
                    }

                    $vehiculo->forceFill([
                        $config['control'] => $fechaVencimiento->toDateString(),
                    ])->save();

                    $enviadas++;
                });
        }

        $this->info("Vehículos notificados por vencimiento de documentos: {$enviadas}");

        return self::SUCCESS;
    }
}
