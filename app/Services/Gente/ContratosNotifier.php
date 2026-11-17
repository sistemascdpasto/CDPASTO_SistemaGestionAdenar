<?php

namespace App\Services\Gente;

use App\Enums\Role;
use App\Mail\Gente\ContratosPorVencerMail;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class ContratosNotifier
{
    /**
     * Envía un único correo agrupado con todos los contratos próximos a vencer
     * a cada usuario con rol Contratos (y Administrador).
     *
     * @param  Collection<int, array{nombre_completo: string, fecha_vencimiento: \Carbon\Carbon}>  $contratos
     */
    public static function notificarVencimientos(Collection $contratos, bool $soloFrecuentes = false): void
    {
        $query = User::role([Role::Contratos->value, Role::Administrador->value])
            ->whereNotNull('email');

        if ($soloFrecuentes) {
            $query->where('alertas_contratos_tres_veces_dia', true);
        }

        $destinatarios = $query->get();

        foreach ($destinatarios as $destinatario) {
            try {
                Mail::to($destinatario->email)
                    ->send(new ContratosPorVencerMail($contratos));
            } catch (Throwable $e) {
                Log::warning('No se pudo enviar el correo de contratos por vencer.', [
                    'destinatario' => $destinatario->email,
                    'contratos'    => $contratos->count(),
                    'error'        => $e->getMessage(),
                ]);
            }
        }
    }
}
