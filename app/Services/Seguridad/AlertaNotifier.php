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
     * HU041: notifica por correo a los responsables de la alerta.
     *
     * Los contratos próximos a vencer (tipo 'retiro_proximo') van
     * exclusivamente al rol 'Contratos' — distinto del resto de pilares,
     * porque ese rol además admite un envío "solo frecuentes" (los avisos
     * de mediodía/tarde, ver routes/console.php) filtrado por la casilla
     * alertas_contratos_tres_veces_dia del usuario. El resto de tipos
     * (Seguridad, Flota, Reparto) se resuelven por pilar vía AlertaCatalogo.
     *
     * El envío nunca debe tumbar la acción que originó la alerta (registrar una
     * prueba, una condición de salud, etc.) — un fallo de correo (SMTP caído,
     * credenciales inválidas) solo se registra en el log.
     */
    public static function notificar(Alerta $alerta, bool $soloFrecuentes = false): void
    {
        if ($alerta->tipo === 'retiro_proximo') {
            $query = User::role(Role::Contratos->value)->whereNotNull('email');

            if ($soloFrecuentes) {
                $query->where('alertas_contratos_tres_veces_dia', true);
            }

            $responsables = $query->get();
        } else {
            $roles = array_map(fn (Role $rol) => $rol->value, AlertaCatalogo::rolesDestinatarios($alerta->tipo));
            $responsables = User::role($roles)->whereNotNull('email')->get();
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
