<?php

namespace App\Console\Commands;

use App\Models\Flota\Vehiculo;
use App\Models\Seguridad\Alerta;
use App\Services\Seguridad\AlertaNotifier;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class RevisarVencimientoDocumentosFlota extends Command
{
    protected $signature = 'flota:revisar-vencimiento-documentos';

    protected $description = 'Genera alertas (pantalla + correo a Flota/Administrador) por vehículos con SOAT (15 días antes) o tecnomecánica (30 días antes) próximos a vencer.';

    private const LABELS = [
        'vencimiento_soat' => 'SOAT',
        'vencimiento_tecnomecanica' => 'revisión tecnicomecánica (RTM)',
    ];

    /**
     * Configuración por tipo de documento: columna con la fecha de
     * vencimiento, columna que registra para qué fecha ya se avisó, y días
     * de anticipación del aviso.
     *
     * @var array<string, array{fecha: string, control: string, dias_config: string}>
     */
    private const DOCUMENTOS = [
        'vencimiento_soat' => [
            'fecha' => 'fecha_vencimiento_soat',
            'control' => 'soat_alerta_enviada_para',
            'dias_config' => 'flota.dias_alerta_soat',
        ],
        'vencimiento_tecnomecanica' => [
            'fecha' => 'fecha_vencimiento_tecnomecanica',
            'control' => 'tecnomecanica_alerta_enviada_para',
            'dias_config' => 'flota.dias_alerta_tecnomecanica',
        ],
    ];

    public function handle(): int
    {
        $hoy = Carbon::today();
        $creadas = 0;

        foreach (self::DOCUMENTOS as $tipo => $config) {
            $limite = $hoy->copy()->addDays((int) config($config['dias_config']));

            Vehiculo::query()
                ->whereNotNull($config['fecha'])
                ->whereDate($config['fecha'], '<=', $limite)
                ->where(function ($query) use ($config) {
                    $query->whereNull($config['control'])
                        ->orWhereColumn($config['control'], '!=', $config['fecha']);
                })
                ->each(function (Vehiculo $vehiculo) use ($tipo, $config, &$creadas) {
                    $fechaVencimiento = $vehiculo->{$config['fecha']};

                    $alerta = Alerta::create([
                        'tipo' => $tipo,
                        'mensaje' => $this->mensaje($vehiculo->placa, $tipo, $fechaVencimiento),
                        'contexto' => ['vehiculo_id' => $vehiculo->id],
                    ]);
                    AlertaNotifier::notificar($alerta);

                    $vehiculo->forceFill([
                        $config['control'] => $fechaVencimiento->toDateString(),
                    ])->save();

                    $creadas++;
                });
        }

        $this->info("Alertas de vencimiento de documentos generadas: {$creadas}");

        return self::SUCCESS;
    }

    private function mensaje(string $placa, string $tipo, Carbon $fechaVencimiento): string
    {
        $label = self::LABELS[$tipo] ?? 'documento';
        $fecha = $fechaVencimiento->copy()->locale('es')->isoFormat('D [de] MMMM [de] YYYY');
        $dias = (int) Carbon::today()->diffInDays($fechaVencimiento->copy()->startOfDay(), false);

        $cuandoVence = match (true) {
            $dias < 0 => 'ya está vencido',
            $dias === 0 => 'vence hoy',
            $dias === 1 => 'vence mañana',
            default => "vence en {$dias} días",
        };

        return "El {$label} del vehículo con placa {$placa} {$cuandoVence}. Fecha de vencimiento: {$fecha}.";
    }
}
