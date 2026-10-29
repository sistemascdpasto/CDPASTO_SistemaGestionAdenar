<?php

namespace App\Services\Seguridad;

use App\Enums\Role;
use App\Models\Seguridad\Alerta;
use App\Models\User;
use App\Notifications\Seguridad\AlertaGenerada;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

class AlertaNotifier
{
    /**
     * HU041: notifica por correo a Administrador/Seguridad cuando se genera una alerta.
     *
     * El envío nunca debe tumbar la acción que originó la alerta (registrar una
     * prueba, una condición de salud, etc.) — un fallo de correo (SMTP caído,
     * credenciales inválidas) solo se registra en el log.
     */
    public static function notificar(Alerta $alerta, bool $soloFrecuentes = false): void
    {
        // Si la alerta es de retiro próximo (vencimiento de contrato),
        // se envía exclusivamente a los usuarios que tengan el rol 'Contratos'.
        if ($alerta->tipo === 'retiro_proximo') {
            $query = User::role(Role::Contratos->value)->whereNotNull('email');

            if ($soloFrecuentes) {
                // En turnos intradía, solo se envía a quienes tienen la casilla de 3 veces al día marcada
                $query->where('alertas_contratos_tres_veces_dia', true);
            }

            $responsables = $query->get();
        } else {
            // Las demás alertas (seguridad) se envían a Administrador y Seguridad.
            $responsables = User::role([Role::Administrador->value, Role::Seguridad->value])
                ->whereNotNull('email')
                ->get();
        }

        foreach ($responsables as $responsable) {
            try {
                Notification::send($responsable, new AlertaGenerada($alerta));
            } catch (Throwable $e) {
                Log::warning('No se pudo enviar la notificación de alerta.', [
                    'alerta_id' => $alerta->id,
                    'tipo' => $alerta->tipo,
                    'destinatario' => $responsable->email,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
