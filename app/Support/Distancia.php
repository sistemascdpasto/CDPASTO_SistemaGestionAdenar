<?php

namespace App\Support;

/**
 * Compartido entre DetectarVehiculosDetenidos (filtro de geocerca de la
 * bodega para decidir si se notifica) y VehiculosDetenidosController
 * (marcar "en bodega" en la pantalla) — antes hubiera quedado duplicado.
 */
class Distancia
{
    /**
     * Distancia en metros entre dos coordenadas (fórmula de Haversine).
     */
    public static function metros(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $radioTierraMetros = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return $radioTierraMetros * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
