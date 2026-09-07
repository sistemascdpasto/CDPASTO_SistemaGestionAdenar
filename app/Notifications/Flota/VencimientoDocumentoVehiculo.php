<?php

namespace App\Notifications\Flota;

use App\Models\Flota\Vehiculo;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

class VencimientoDocumentoVehiculo extends Notification
{
    use Queueable;

    public const TIPO_SOAT = 'soat';

    public const TIPO_TECNOMECANICA = 'tecnomecanica';

    private const LABELS = [
        self::TIPO_SOAT => 'SOAT',
        self::TIPO_TECNOMECANICA => 'revisión tecnicomecánica (RTM)',
    ];

    public function __construct(
        private readonly Vehiculo $vehiculo,
        private readonly string $tipo,
        private readonly Carbon $fechaVencimiento,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $label = self::LABELS[$this->tipo] ?? 'documento';
        $fecha = $this->fechaVencimiento->copy()->locale('es')->isoFormat('D [de] MMMM [de] YYYY');
        $dias = (int) Carbon::today()->diffInDays($this->fechaVencimiento->copy()->startOfDay(), false);

        $cuandoVence = match (true) {
            $dias < 0 => 'ya está vencido',
            $dias === 0 => 'vence hoy',
            $dias === 1 => 'vence mañana',
            default => "vence en {$dias} días",
        };

        return (new MailMessage)
            ->subject("ADENAR Flota: {$label} del vehículo {$this->vehiculo->placa} próximo a vencer")
            ->greeting("Hola {$notifiable->name},")
            ->line("El {$label} del vehículo con placa **{$this->vehiculo->placa}** {$cuandoVence}.")
            ->line("Fecha de vencimiento: {$fecha}.")
            ->action('Ver documentación del vehículo', route('flota.vehiculos.show', $this->vehiculo))
            ->line('Este es un mensaje automático del Sistema Integral de Gestión ADENAR.');
    }
}
