<?php

namespace App\Http\Controllers\WebAuthn;

use App\Models\User;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Laragear\WebAuthn\Http\Requests\AssertedRequest;
use Laragear\WebAuthn\Http\Requests\AssertionRequest;

/**
 * Inicio de sesión con huella / Face ID (passkey).
 */
class WebAuthnLoginController
{
    /**
     * Reto para que el dispositivo firme con una de sus llaves guardadas (sin pedir usuario).
     */
    public function options(AssertionRequest $request): Responsable
    {
        return $request->secureLogin()->toVerify();
    }

    /**
     * Verifica la firma del dispositivo e inicia la sesión (dispara el evento Login como el
     * ingreso con contraseña: Nexus lo registra y aplica bloqueos, anuncios y ubicación).
     */
    public function login(AssertedRequest $request): JsonResponse
    {
        // Igual que con contraseña: un usuario desactivado no puede entrar.
        $user = $request->login(callbacks: fn (User $user) => (bool) $user->is_active);

        if (! $user) {
            throw ValidationException::withMessages([
                'passkey' => 'No fue posible ingresar con esta huella. Ingresa con tu cédula y contraseña.',
            ]);
        }

        return response()->json(['redirect' => redirect()->intended(route('dashboard', absolute: false))->getTargetUrl()]);
    }
}
