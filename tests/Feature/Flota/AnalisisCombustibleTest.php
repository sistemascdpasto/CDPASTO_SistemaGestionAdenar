<?php

namespace Tests\Feature\Flota;

use App\Models\Flota\CombustibleVoucher;
use App\Models\Flota\Vehiculo;
use App\Models\Flota\VehiculoKilometroDiario;
use App\Models\Reparto\Modulacion;
use App\Models\Reparto\ModulacionItem;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AnalisisCombustibleTest extends TestCase
{
    use RefreshDatabase;

    private function usuarioConRol(string $rol): User
    {
        Role::findOrCreate($rol, 'web');
        $user = User::factory()->create();
        $user->assignRole($rol);

        return $user;
    }

    private function sembrarVoucher(string $placa, float $galones, float $totalPagado, string $fecha, string $estado = 'revisado'): void
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

        CombustibleVoucher::create([
            'colaborador_id' => $colaborador->id,
            'placa' => $placa,
            'foto_path' => 'flota/combustible/vouchers/x/voucher.jpg',
            'estado' => $estado,
            'galones' => $galones,
            'total_pagado' => $totalPagado,
            'fecha_voucher' => $fecha,
        ]);
    }

    public function test_el_index_cruza_km_tanqueadas_y_meta_para_calcular_rendimiento(): void
    {
        $flota = $this->usuarioConRol('Flota');
        Vehiculo::create(['placa' => 'COPSX001', 'is_active' => true, 'meta_km_gl' => 20]);

        VehiculoKilometroDiario::create(['fecha' => '2026-10-20', 'placa' => 'COPSX001', 'distancia_km' => 100]);
        VehiculoKilometroDiario::create(['fecha' => '2026-10-21', 'placa' => 'COPSX001', 'distancia_km' => 100]);

        // Voucher procesado pero sin revisar por Flota: no debe contar en el cruce.
        $this->sembrarVoucher('COPSX001', 5, 70000, '2026-10-20', 'procesado');
        $this->sembrarVoucher('COPSX001', 5, 70000, '2026-10-21', 'revisado');

        $response = $this->actingAs($flota)->get(route('flota.combustible.index', ['desde' => '2026-10-01', 'hasta' => '2026-10-31']));

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->where('por_placa.0.placa', 'COPSX001')
            ->where('por_placa.0.km_total', 200)
            ->where('por_placa.0.galones_total', 5)
            ->where('por_placa.0.rendimiento_km_gl', 40)
            ->where('por_placa.0.meta_km_gl', 20)
            ->where('por_placa.0.cumplimiento_pct', 200));
    }

    public function test_detalle_placa_cruza_km_con_la_ruta_de_modulacion_por_dia(): void
    {
        $flota = $this->usuarioConRol('Flota');

        VehiculoKilometroDiario::create(['fecha' => '2026-10-20', 'placa' => 'COPSX001', 'distancia_km' => 120.5]);

        $modulacion = Modulacion::create(['fecha' => '2026-10-20']);
        ModulacionItem::create([
            'modulacion_id' => $modulacion->id,
            'placa' => 'copsx001',
            'ud' => 'RUTA-5',
            'nombres' => 'Juan Pérez',
        ]);

        $response = $this->actingAs($flota)->getJson(route('flota.combustible.detalle-placa', [
            'placa' => 'COPSX001',
            'desde' => '2026-10-01',
            'hasta' => '2026-10-31',
        ]));

        $response->assertOk()->assertJson([
            'filas' => [
                ['fecha' => '2026-10-20', 'km' => 120.5, 'ruta' => 'RUTA-5', 'conductor' => 'Juan Pérez'],
            ],
        ]);
    }

    public function test_un_usuario_de_flota_puede_actualizar_la_meta_de_un_vehiculo(): void
    {
        $flota = $this->usuarioConRol('Flota');
        $vehiculo = Vehiculo::create(['placa' => 'COPSX001', 'is_active' => true]);

        $this->actingAs($flota)->patch(route('flota.combustible.meta.update', $vehiculo), [
            'meta_km_gl' => 18.5,
        ])->assertRedirect();

        $this->assertEquals(18.5, $vehiculo->fresh()->meta_km_gl);
    }

    public function test_un_colaborador_no_puede_ver_el_dashboard_de_combustible(): void
    {
        $colaborador = $this->usuarioConRol('Colaborador');

        $this->actingAs($colaborador)->get(route('flota.combustible.index'))->assertForbidden();
    }
}
