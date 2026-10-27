<?php

namespace App\Notifications\Reparto;

use App\Models\Flota\VehiculoEstadoMygeotab;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class VehiculoDetenido extends Notification
{
    public function __construct(private readonly VehiculoEstadoMygeotab $estado) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $minutos = (int) round($this->estado->detenido_desde->diffInMinutes(now()));
        $mapaUrl = "https://www.google.com/maps?q={$this->estado->latitud},{$this->estado->longitud}";

        return (new MailMessage)
            ->subject("ADENAR Reparto: vehículo {$this->estado->placa} detenido hace {$minutos} min")
            ->greeting('Vehículo detenido en ruta')
            ->line("La placa {$this->estado->placa} lleva detenida {$minutos} minutos (desde las {$this->estado->detenido_desde->format('H:i')}).")
            ->line("Última ubicación conocida: {$this->estado->latitud}, {$this->estado->longitud}")
            ->action('Ver ubicación en el mapa', $mapaUrl)
            ->line('Este es un mensaje automático del Sistema Integral de Gestión ADENAR.');
    }
}
