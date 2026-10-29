<?php

namespace App\Support;

/**
 * "La ruta" de un ModulacionItem no vive en un campo suelto — son sus
 * 'viajes' (cada uno con 'destinos': barrio/lugares, o si no tiene
 * destinos, su propio barrio/lugares top-level — mismo fallback que
 * obtenerDestinosViaje() en el frontend de Modulación). Se resume como la
 * lista de barrios/lugares visitados, sin repetir.
 *
 * Compartido entre AnalisisCombustibleController y
 * VehiculosDetenidosController — antes vivía duplicado como método
 * privado en el primero.
 */
class ModulacionRuta
{
    /**
     * @param  ?array<int, array<string, mixed>>  $viajes
     */
    public static function resumen(?array $viajes): ?string
    {
        if (empty($viajes)) {
            return null;
        }

        $paradas = collect($viajes)
            ->flatMap(function (array $viaje) {
                $destinos = $viaje['destinos'] ?? [];
                if (empty($destinos)) {
                    $destinos = [['lugares' => $viaje['lugares'] ?? '', 'barrio' => $viaje['barrio'] ?? '']];
                }

                return collect($destinos)->map(fn ($destino) => trim($destino['barrio'] ?? '') ?: trim($destino['lugares'] ?? ''));
            })
            ->filter()
            ->unique()
            ->values();

        return $paradas->isNotEmpty() ? $paradas->implode(', ') : null;
    }
}
