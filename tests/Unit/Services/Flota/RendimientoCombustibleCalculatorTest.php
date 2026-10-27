<?php

namespace Tests\Unit\Services\Flota;

use App\Models\Flota\CombustibleVoucher;
use App\Models\Flota\VehiculoKilometroDiario;
use App\Models\Seguridad\Colaborador;
use App\Services\Flota\RendimientoCombustibleCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RendimientoCombustibleCalculatorTest extends TestCase
{
    use RefreshDatabase;

    private function voucher(string $placa, float $galones, float $totalPagado, ?string $fecha): CombustibleVoucher
    {
        $colaborador = Colaborador::create([
            'cedula' => '100'.rand(100000, 999999),
            'nombres' => 'Prueba',
            'apellidos' => 'Voucher',
            'cargo' => 'Conductor',
            'turno' => 'manana',
            'area' => 'Ruta Norte',
            'is_active' => true,
        ]);

        return CombustibleVoucher::create([
            'colaborador_id' => $colaborador->id,
            'placa' => $placa,
            'foto_path' => 'x.jpg',
            'estado' => 'revisado',
            'galones' => $galones,
            'total_pagado' => $totalPagado,
            'fecha_voucher' => $fecha,
        ]);
    }

    public function test_la_primera_tanqueada_no_forma_un_intervalo_completo(): void
    {
        $this->voucher('COPSX001', 5, 70000, '2026-10-10');

        $intervalos = app(RendimientoCombustibleCalculator::class)->intervalosPorPlaca('COPSX001');

        $this->assertCount(0, $intervalos);
    }

    public function test_calcula_el_rendimiento_entre_dos_tanqueadas_consecutivas(): void
    {
        $this->voucher('COPSX001', 5, 70000, '2026-10-10');
        VehiculoKilometroDiario::create(['fecha' => '2026-10-11', 'placa' => 'COPSX001', 'distancia_km' => 60]);
        VehiculoKilometroDiario::create(['fecha' => '2026-10-15', 'placa' => 'COPSX001', 'distancia_km' => 40]);
        $this->voucher('COPSX001', 5, 72000, '2026-10-15');

        $intervalos = app(RendimientoCombustibleCalculator::class)->intervalosPorPlaca('COPSX001');

        $this->assertCount(1, $intervalos);
        $this->assertSame('2026-10-11', $intervalos[0]['fecha_desde']);
        $this->assertSame('2026-10-15', $intervalos[0]['fecha_hasta']);
        $this->assertEquals(100.0, $intervalos[0]['km']);
        // 100 km con los 5 galones de la tanqueada que CERRÓ el intervalo
        // (la del 10-15), no con los de la que lo abrió.
        $this->assertEquals(20.0, $intervalos[0]['rendimiento_km_gl']);
        $this->assertEquals(720.0, $intervalos[0]['costo_km']); // 72000/100
    }

    public function test_km_antes_de_la_primera_tanqueada_no_se_cuenta_en_el_siguiente_intervalo(): void
    {
        // Recorrido grande ANTES de que exista cualquier tanqueada registrada
        // — no debe colarse en el primer intervalo medible.
        VehiculoKilometroDiario::create(['fecha' => '2026-10-05', 'placa' => 'COPSX001', 'distancia_km' => 500]);
        $this->voucher('COPSX001', 5, 70000, '2026-10-10');
        VehiculoKilometroDiario::create(['fecha' => '2026-10-12', 'placa' => 'COPSX001', 'distancia_km' => 50]);
        $this->voucher('COPSX001', 5, 70000, '2026-10-14');

        $intervalos = app(RendimientoCombustibleCalculator::class)->intervalosPorPlaca('COPSX001');

        $this->assertEquals(50.0, $intervalos[0]['km']);
    }

    public function test_resumen_en_rango_suma_km_y_galones_en_vez_de_promediar_razones(): void
    {
        $this->voucher('COPSX001', 5, 70000, '2026-10-01');
        VehiculoKilometroDiario::create(['fecha' => '2026-10-02', 'placa' => 'COPSX001', 'distancia_km' => 100]);
        $this->voucher('COPSX001', 5, 70000, '2026-10-05'); // intervalo 1: 100km/5gl = 20 km/gl

        VehiculoKilometroDiario::create(['fecha' => '2026-10-10', 'placa' => 'COPSX001', 'distancia_km' => 10]);
        $this->voucher('COPSX001', 1, 14000, '2026-10-12'); // intervalo 2: 10km/1gl = 10 km/gl

        $resumen = app(RendimientoCombustibleCalculator::class)->resumenEnRango('COPSX001', '2026-10-01', '2026-10-31');

        // Agrupado: (100+10) km / (5+1) gl = 18.33 — no el promedio simple
        // de 20 y 10 (15), que sobreponderaría el intervalo corto.
        $this->assertEquals(110.0, $resumen['km']);
        $this->assertEquals(6.0, $resumen['galones']);
        $this->assertEquals(round(110 / 6, 2), $resumen['rendimiento_km_gl']);
        $this->assertSame(2, $resumen['tanqueadas']);
    }

    public function test_resumen_en_rango_solo_cuenta_intervalos_cuya_tanqueada_final_cae_en_el_rango(): void
    {
        $this->voucher('COPSX001', 5, 70000, '2026-10-01');
        VehiculoKilometroDiario::create(['fecha' => '2026-10-02', 'placa' => 'COPSX001', 'distancia_km' => 100]);
        $this->voucher('COPSX001', 5, 70000, '2026-10-05'); // cierra fuera del rango de noviembre

        VehiculoKilometroDiario::create(['fecha' => '2026-11-02', 'placa' => 'COPSX001', 'distancia_km' => 40]);
        $this->voucher('COPSX001', 2, 28000, '2026-11-03'); // cierra dentro del rango de noviembre

        $resumen = app(RendimientoCombustibleCalculator::class)->resumenEnRango('COPSX001', '2026-11-01', '2026-11-30');

        // Aunque la tanqueada que ABRIÓ este intervalo fue en octubre (fuera
        // del rango), el intervalo sí cuenta porque la que lo CERRÓ cae en
        // noviembre — y usa el km real desde esa tanqueada anterior, no
        // desde el inicio del rango.
        $this->assertEquals(40.0, $resumen['km']);
        $this->assertEquals(2.0, $resumen['galones']);
        $this->assertSame(1, $resumen['tanqueadas']);
    }

    public function test_un_voucher_sin_fecha_no_entra_al_calculo(): void
    {
        $this->voucher('COPSX001', 5, 70000, '2026-10-10');
        $this->voucher('COPSX001', 5, 70000, null);
        $this->voucher('COPSX001', 5, 70000, '2026-10-15');

        $intervalos = app(RendimientoCombustibleCalculator::class)->intervalosPorPlaca('COPSX001');

        // Solo las dos tanqueadas con fecha forman un intervalo; la sin
        // fecha no puede ubicarse en la línea de tiempo.
        $this->assertCount(1, $intervalos);
    }
}
