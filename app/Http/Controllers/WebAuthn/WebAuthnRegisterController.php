<?php

namespace App\Http\Controllers\WebAuthn;

use App\Models\User;
use App\Support\Dispositivo;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\JsonResponse;
use Laragear\WebAuthn\Http\Requests\AttestationRequest;
use Laragear\WebAuthn\Http\Requests\AttestedRequest;
use Laragear\WebAuthn\WebAuthnData;

/**
 * Activa el ingreso con huella / Face ID (passkey) para el usuario conectado.
 */
class WebAuthnRegisterController
{
    /**
     * Instrucciones para que el dispositivo cree la llave.
     */
    public function options(AttestationRequest $request): Responsable
    {
        return $request
            // La llave queda guardada en el dispositivo: el login no pide escribir la cédula.
            ->userless()
            // Siempre se verifica a la persona (huella, rostro o PIN del celular).
            ->secureRegistration()
            // En el selector del celular se ve el nombre y la identificación de cada cuenta
            // (útil cuando varios colaboradores comparten un mismo equipo).
            ->using(fn (User $user) => WebAuthnData::make(
                (string) ($user->identification_number ?: $user->email),
                (string) $user->name,
            ))
            ->toCreate();
    }

    /**
     * Guarda la llave pública del dispositivo.
     */
    public function register(AttestedRequest $request): JsonResponse
    {
        $request->save(['alias' => Dispositivo::describir($request->userAgent())]);

        return response()->json(['message' => 'Listo: ya puedes ingresar con tu huella o Face ID en este dispositivo.']);
    }
}
