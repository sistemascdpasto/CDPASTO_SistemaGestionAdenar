<?php

namespace App\Notifications\Seguridad;

use App\Models\Seguridad\Alerta;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AlertaGenerada extends Notification
{
    public function __construct(private readonly Alerta $alerta)
    {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    private const TIPO_LABELS = [
        'prueba_positiva' => 'Prueba de alcoholemia positiva',
        'salud_mala' => 'Estado de salud: Malo',
        'no_apto' => 'Colaborador No Apto para laborar',
        'calibracion_proxima' => 'Calibración de alcoholímetro próxima',
        'certificado_vencido' => 'Certificado de alcoholímetro por vencer',
        'retiro_proximo' => 'Contrato próximo a vencer',
    ];

    public function toMail(object $notifiable): MailMessage
    {
        $titulo = self::TIPO_LABELS[$this->alerta->tipo] ?? 'Alerta del módulo de Seguridad';
        $esContrato = $this->alerta->tipo === 'retiro_proximo';

        $actionUrl = $esContrato && $this->alerta->colaborador_id
            ? route('gente.contratos.show', $this->alerta->colaborador_id)
            : route('seguridad.alertas.index');

        $actionText = $esContrato ? 'Ver contrato' : 'Ver alertas';

        return (new MailMessage)
            ->subject($esContrato ? "ADENAR Contratos: {$titulo}" : "ADENAR Seguridad: {$titulo}")
            ->greeting($esContrato ? 'Alerta de vencimiento de contrato' : 'Nueva alerta en el módulo de Seguridad')
            ->line($titulo)
            ->line($this->alerta->mensaje)
            ->action($actionText, $actionUrl)
            ->line('Este es un mensaje automático del Sistema Integral de Gestión ADENAR.');
    }
}
