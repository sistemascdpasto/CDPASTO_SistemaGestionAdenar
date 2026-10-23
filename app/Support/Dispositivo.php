<?php

namespace App\Support;

/**
 * Nombre legible del dispositivo a partir del User-Agent («iPhone · Safari», «Android · Chrome»).
 */
class Dispositivo
{
    public static function describir(?string $userAgent): string
    {
        $ua = (string) $userAgent;

        $sistema = match (true) {
            str_contains($ua, 'iPhone') => 'iPhone',
            str_contains($ua, 'iPad') => 'iPad',
            str_contains($ua, 'Android') => 'Android',
            str_contains($ua, 'Windows') => 'Windows',
            str_contains($ua, 'Mac OS X') => 'Mac',
            str_contains($ua, 'Linux') => 'Linux',
            default => 'Dispositivo',
        };

        $navegador = match (true) {
            str_contains($ua, 'Edg/') => 'Edge',
            str_contains($ua, 'SamsungBrowser') => 'Samsung Internet',
            str_contains($ua, 'CriOS'), str_contains($ua, 'Chrome/') => 'Chrome',
            str_contains($ua, 'FxiOS'), str_contains($ua, 'Firefox/') => 'Firefox',
            str_contains($ua, 'Safari/') => 'Safari',
            default => null,
        };

        return $navegador ? "{$sistema} · {$navegador}" : $sistema;
    }
}
