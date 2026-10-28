<?php

namespace App\Services\Seguridad;

use App\Enums\Role;
use App\Models\Seguridad\Alerta;
use App\Models\User;
use App\Notifications\Seguridad\AlertaGenerada;
use App\Support\AlertaCatalogo;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

class AlertaNotifier
{
    /**
     * HU041: notifica por correo a Administrador + el rol del pilar dueño de
     * la alerta (Seguridad/Gente/Flota/Reparto, según AlertaCatalogo).
     *
     * El envío nunca debe tumbar la acción que originó la alerta (registrar una
     * prueba, una condición de salud, etc.) — un fallo de correo (SMTP caído,
     * credenciales inválidas) solo se registra en el log.
     */
    public static function notificar(Alerta $alerta): void
    {
        $roles = array_map(fn (Role $rol) => $rol->value, AlertaCatalogo::rolesDestinatarios($alerta->tipo));

        $responsables = User::role($roles)
            ->whereNotNull('email')
            ->get();

        foreach ($responsables as $responsable) {
            try {
                Notification::send($responsable, new AlertaGenerada($alerta));
            } catch (Throwable $e) {
                Log::warning('No se pudo enviar la notificación de alerta.', [
                    'alerta_id' => $alerta->id,
                    'destinatario' => $responsable->email,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
