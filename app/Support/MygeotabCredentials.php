<?php

namespace App\Support;

use App\Models\MygeotabCredencial;
use App\Models\User;

/**
 * Las credenciales de MyGeotab rotan periódicamente (contraseña cambia cada
 * cierto tiempo), así que no pueden vivir solo en .env (eso exigiría
 * redeploy cada vez). La fuente de verdad en tiempo de ejecución es la fila
 * singleton (id=1) de mygeotab_credenciales, cifrada con el cast 'encrypted'
 * de MygeotabCredencial. Si todavía no se ha configurado nada desde el
 * panel, se cae al valor semilla de config/services.php (.env).
 */
class MygeotabCredentials
{
    /**
     * @return array{username: ?string, password: ?string, database: ?string}
     */
    public static function current(): array
    {
        $fila = MygeotabCredencial::find(1);

        if ($fila && filled($fila->username) && filled($fila->password) && filled($fila->database)) {
            return [
                'username' => $fila->username,
                'password' => $fila->password,
                'database' => $fila->database,
            ];
        }

        return [
            'username' => config('services.mygeotab.username'),
            'password' => config('services.mygeotab.password'),
            'database' => config('services.mygeotab.database'),
        ];
    }

    /**
     * true si hay credenciales guardadas en BD (distintas del valor semilla
     * del .env) — usado por la pantalla de admin para mostrar de dónde viene
     * el valor actual.
     */
    public static function tieneCredencialesEnBd(): bool
    {
        $fila = MygeotabCredencial::find(1);

        return $fila !== null && filled($fila->username) && filled($fila->password) && filled($fila->database);
    }

    /**
     * @param  array{username?: ?string, password?: ?string, database?: ?string}  $datos
     */
    public static function actualizar(array $datos, User $actor): void
    {
        $actual = self::current();

        // updateOrCreate (no la query builder) para que pase por los casts
        // 'encrypted' del modelo — una query cruda guardaría en texto plano.
        MygeotabCredencial::updateOrCreate(
            ['id' => 1],
            [
                'username' => $datos['username'] ?? $actual['username'],
                'password' => filled($datos['password'] ?? null) ? $datos['password'] : $actual['password'],
                'database' => $datos['database'] ?? $actual['database'],
                'actualizado_por_id' => $actor->id,
            ]
        );
    }
}
