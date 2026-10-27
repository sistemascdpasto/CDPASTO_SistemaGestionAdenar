<?php

namespace App\Services\Flota;

use App\Models\Flota\CombustibleVoucher;
use App\Models\Flota\VehiculoKilometroDiario;
use Illuminate\Support\Collection;

/**
 * Rendimiento km/gl "tanqueada a tanqueada" (tanque lleno a tanque lleno):
 * cada intervalo son los km recorridos entre una tanqueada y la siguiente,
 * divididos entre los galones de la tanqueada que cerró ese intervalo (la
 * que efectivamente pagó ese recorrido). Reemplaza el cálculo anterior
 * (km totales del período ÷ galones totales del período), que mezclaba
 * recorridos con tanqueadas que no les correspondían y era sensible a
 * dónde cayera el filtro de fechas — ver conversación con Brian.
 */
class RendimientoCombustibleCalculator
{
    /**
     * Intervalos de TODA la placa (no limitado a un rango): hace falta la
     * tanqueada real anterior, aunque haya sido antes del rango que se
     * esté mostrando, para no distorsionar el primer intervalo visible.
     *
     * @return Collection<int, array{
     *     voucher_id: int, fecha_desde: ?string, fecha_hasta: string,
     *     km: float, galones: float, total_pagado: float,
     *     rendimiento_km_gl: ?float, costo_km: ?float,
     * }>
     */
    public function intervalosPorPlaca(string $placa): Collection
    {
        $vouchers = CombustibleVoucher::query()
            ->where('placa', $placa)
            ->where('estado', 'revisado')
            ->whereNotNull('fecha_voucher')
            ->orderBy('fecha_voucher')
            ->orderBy('id')
            ->get(['id', 'fecha_voucher', 'galones', 'total_pagado']);

        $intervalos = collect();
        $anterior = null;

        foreach ($vouchers as $voucher) {
            if ($anterior === null) {
                // La primera tanqueada conocida no tiene "anterior" con qué
                // formar un intervalo completo — queda como punto de
                // partida para la siguiente, no se reporta rendimiento.
                $anterior = $voucher;

                continue;
            }

            $fechaDesde = $anterior->fecha_voucher->copy()->addDay()->toDateString();
            $fechaHasta = $voucher->fecha_voucher->toDateString();

            $km = (float) VehiculoKilometroDiario::query()
                ->where('placa', $placa)
                ->whereDate('fecha', '>=', $fechaDesde)
                ->whereDate('fecha', '<=', $fechaHasta)
                ->sum('distancia_km');

            $galones = (float) $voucher->galones;
            $totalPagado = (float) $voucher->total_pagado;

            $intervalos->push([
                'voucher_id' => $voucher->id,
                'fecha_desde' => $fechaDesde,
                'fecha_hasta' => $fechaHasta,
                'km' => $km,
                'galones' => $galones,
                'total_pagado' => $totalPagado,
                // null (no 0) si no hubo km registrados en el intervalo:
                // un rendimiento de "0 km/gl" se leería como pésimo, no
                // como "todavía no hay kilómetros para medir este tramo".
                'rendimiento_km_gl' => ($km > 0 && $galones > 0) ? round($km / $galones, 2) : null,
                'costo_km' => ($km > 0 && $totalPagado > 0) ? round($totalPagado / $km, 0) : null,
            ]);

            $anterior = $voucher;
        }

        return $intervalos;
    }

    /**
     * Agrupa (suma km / suma galones, no promedio de razones — para no
     * sobreponderar intervalos cortos) los intervalos cuya tanqueada final
     * cae en [$desde, $hasta], que es lo que realmente se le pidió "ver" al
     * usuario con el filtro de fechas del dashboard.
     *
     * @return array{km: float, galones: float, total_pagado: float, rendimiento_km_gl: ?float, costo_km: ?float, tanqueadas: int}
     */
    public function resumenEnRango(string $placa, string $desde, string $hasta): array
    {
        $intervalos = $this->intervalosPorPlaca($placa)
            ->filter(fn (array $i) => $i['fecha_hasta'] >= $desde && $i['fecha_hasta'] <= $hasta);

        $km = $intervalos->sum('km');
        $galones = $intervalos->sum('galones');
        $totalPagado = $intervalos->sum('total_pagado');

        return [
            'km' => $km,
            'galones' => $galones,
            'total_pagado' => $totalPagado,
            'rendimiento_km_gl' => ($km > 0 && $galones > 0) ? round($km / $galones, 2) : null,
            'costo_km' => ($km > 0 && $totalPagado > 0) ? round($totalPagado / $km, 0) : null,
            'tanqueadas' => $intervalos->count(),
        ];
    }
}
