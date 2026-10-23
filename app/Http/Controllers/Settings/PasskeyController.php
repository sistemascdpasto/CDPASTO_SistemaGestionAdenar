<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Dispositivos con los que el usuario puede ingresar con huella / Face ID.
 */
class PasskeyController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('settings/passkeys', [
            'passkeys' => $request->user()->webAuthnCredentials()
                ->whereEnabled()
                ->latest()
                ->get(['id', 'alias', 'created_at', 'updated_at'])
                ->map(fn ($credential) => [
                    'id' => $credential->id,
                    'alias' => $credential->alias ?: 'Dispositivo',
                    'created_at' => $credential->created_at,
                    'last_used_at' => $credential->updated_at,
                ]),
        ]);
    }

    public function destroy(Request $request, string $credential): RedirectResponse
    {
        $deleted = $request->user()->webAuthnCredentials()->whereKey($credential)->delete();

        abort_unless($deleted, 404);

        return back()->with('status', 'Se quitó el ingreso con huella de ese dispositivo.');
    }
}
