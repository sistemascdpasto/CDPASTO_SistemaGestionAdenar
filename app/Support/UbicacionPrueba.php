<?php

namespace App\Support;

use Cdpasto\NexusAgent\Location;

/**
 * Ubicación con la que se registra una prueba de alcoholemia (marca de agua y trazabilidad).
 *
 * La toma el agente de Nexus desde el navegador del responsable (con su permiso) o, si no lo
 * dio, la aproxima por IP. Sin ningún dato se usa la ubicación predeterminada del CD.
 */
class UbicacionPrueba
{
    public static function predeterminada(): string
    {
        return config('app.ubicacion_pruebas', 'Pasto, Nariño · Colombia');
    }

    /**
     * @return array{ubicacion: string, latitud: ?float, longitud: ?float, ubicacion_fuente: string}
     */
    public static function actual(): array
    {
        $location = class_exists(Location::class) ? Location::current() : null;

        if (! $location || empty($location['label'])) {
            return ['ubicacion' => self::predeterminada(), 'latitud' => null, 'longitud' => null, 'ubicacion_fuente' => 'predeterminada'];
        }

        return [
            'ubicacion' => mb_substr((string) $location['label'], 0, 160),
            'latitud' => $location['latitude'] ?? null,
            'longitud' => $location['longitude'] ?? null,
            'ubicacion_fuente' => $location['source'] ?? 'ip',
        ];
    }
}
