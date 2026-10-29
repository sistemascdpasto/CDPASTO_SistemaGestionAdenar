<?php

namespace App\Notifications\Seguridad;

use App\Models\Seguridad\Alerta;
use App\Support\AlertaCatalogo;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AlertaGenerada extends Notification
{
    public function __construct(private readonly Alerta $alerta) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $pilar = $this->alerta->pilar ?? AlertaCatalogo::pilarDeTipo($this->alerta->tipo);
        $titulo = AlertaCatalogo::labelDeTipo($this->alerta->tipo);
        $nombrePilar = AlertaCatalogo::nombrePilar($pilar);
        [$textoAccion, $urlAccion] = $this->accion($pilar);

        return (new MailMessage)
            ->subject("ADENAR {$nombrePilar}: {$titulo}")
            ->greeting("Nueva alerta en el módulo de {$nombrePilar}")
            ->line($titulo)
            ->line($this->alerta->mensaje)
            ->action($textoAccion, $urlAccion)
            ->line('Este es un mensaje automático del Sistema Integral de Gestión ADENAR.');
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function accion(string $pilar): array
    {
        $contexto = $this->alerta->contexto ?? [];

        // Contrato próximo a vencer: va directo a la ficha del contrato, no a
        // una pantalla de Alertas (lo pidió Mary al construir el módulo de
        // Contratos; el rol 'Contratos' no tiene pantalla de Alertas propia).
        if ($this->alerta->tipo === 'retiro_proximo' && $this->alerta->colaborador_id) {
            return ['Ver contrato', route('gente.contratos.show', $this->alerta->colaborador_id)];
        }

        // Vehículo detenido: el mapa es el dato más útil cuando hay
        // coordenadas; si no, cae al flujo genérico de abajo (pantalla de
        // Alertas de Reparto).
        if ($pilar === 'reparto' && isset($contexto['latitud'], $contexto['longitud'])) {
            return ['Ver ubicación en el mapa', "https://www.google.com/maps?q={$contexto['latitud']},{$contexto['longitud']}"];
        }

        if ($pilar === 'flota' && isset($contexto['vehiculo_id'])) {
            return ['Ver documentación del vehículo', route('flota.vehiculos.show', $contexto['vehiculo_id'])];
        }

        return ['Ver alertas', route("{$pilar}.alertas.index")];
    }
}
