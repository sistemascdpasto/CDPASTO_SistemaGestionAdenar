<?php

namespace App\Support;

/**
 * MyGeotab antepone "CO" a la placa real en esta cuenta (ej. "COLJU894"
 * para el vehículo "LJU894", confirmado con Brian) — un prefijo de
 * país/flota del dispositivo, no parte de la placa colombiana real
 * (siempre 6 caracteres: 3 letras + 3 números). Sin quitarlo, nunca
 * calzaría con vehiculos.placa, modulacion_items.placa ni
 * combustible_vouchers.placa, que sí usan la placa real. Se compara
 * longitud (8 = "CO" + 6) en vez de asumir que ninguna placa real empieza
 * con "CO", para no truncar una que sí empiece así por sus propias letras.
 *
 * Compartido entre MygeotabKilometrosSyncService y VehiculoDetenidoDetector
 * — antes vivía duplicado como método privado en el primero.
 */
class MygeotabPlaca
{
    public static function normalizar(string $placaMygeotab): string
    {
        $placa = strtoupper(trim($placaMygeotab));

        if (str_starts_with($placa, 'CO') && strlen($placa) === 8) {
            return substr($placa, 2);
        }

        return $placa;
    }
}
