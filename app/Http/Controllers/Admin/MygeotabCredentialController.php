<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Flota\MygeotabClient;
use App\Support\MygeotabCredentials;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pantalla standalone (no hay un "Configuración" genérico en admin todavía
 * — ver app/Http/Controllers/Admin/UserController.php, es lo único que
 * había) para rotar las credenciales de MyGeotab sin redeploy, porque la
 * contraseña cambia periódicamente. El valor real vive cifrado en BD (ver
 * App\Support\MygeotabCredentials); el .env solo guarda un valor semilla
 * para el primer arranque.
 */
class MygeotabCredentialController extends Controller
{
    public function edit(): Response
    {
        $actual = MygeotabCredentials::current();

        return Inertia::render('admin/mygeotab-credenciales/edit', [
            // La contraseña NUNCA se reenvía al frontend (igual que un
            // formulario de cambio de contraseña): el campo llega vacío y
            // "dejar en blanco" significa "no cambiarla".
            'credenciales' => [
                'username' => $actual['username'],
                'database' => $actual['database'],
                'tiene_password' => filled($actual['password']),
            ],
            'fuente' => MygeotabCredentials::tieneCredencialesEnBd() ? 'base_de_datos' : 'env',
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validado = $request->validate([
            'username' => ['required', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:255'],
            'database' => ['required', 'string', 'max:100'],
        ]);

        MygeotabCredentials::actualizar($validado, $request->user());

        return back()->with('status', 'Credenciales de MyGeotab actualizadas.');
    }

    /**
     * Prueba las credenciales del formulario (antes de guardar) contra
     * MyGeotab, para dar feedback inmediato sin tener que esperar a la
     * próxima sincronización.
     */
    public function probar(Request $request, MygeotabClient $cliente): JsonResponse
    {
        $validado = $request->validate([
            'username' => ['required', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:255'],
            'database' => ['required', 'string', 'max:100'],
        ]);

        // Si dejó la contraseña en blanco, prueba con la que ya está guardada.
        if (blank($validado['password'] ?? null)) {
            $validado['password'] = MygeotabCredentials::current()['password'];
        }

        try {
            $cliente->autenticar($validado);
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json(['ok' => true, 'message' => 'Conexión exitosa con MyGeotab.']);
    }
}
