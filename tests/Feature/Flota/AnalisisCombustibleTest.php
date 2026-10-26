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

    public function test_la_tendencia_diaria_cruza_km_y_tanqueadas_del_mismo_dia_sin_duplicar_por_formato_de_fecha(): void
    {
        $flota = $this->usuarioConRol('Flota');

        VehiculoKilometroDiario::create(['fecha' => '2026-10-20', 'placa' => 'COPSX001', 'distancia_km' => 150]);
        VehiculoKilometroDiario::create(['fecha' => '2026-10-21', 'placa' => 'COPSX001', 'distancia_km' => 100]);
        // Voucher el mismo día que ya tiene km: la fecha debe calzar exacto,
        // no quedar como dos filas separadas por un formato de fecha distinto
        // (esto rompía antes porque CombustibleVoucher::fecha_voucher es un
        // cast a Carbon y agrupar por el nombre del atributo producía
        // "2026-10-20 00:00:00" en vez de "2026-10-20").
        $this->sembrarVoucher('COPSX001', 7.5, 100000, '2026-10-20');

        $response = $this->actingAs($flota)->get(route('flota.combustible.index', ['desde' => '2026-10-01', 'hasta' => '2026-10-31']));

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->has('tendencia_diaria', 2)
            ->where('tendencia_diaria.0.fecha', '2026-10-20')
            ->where('tendencia_diaria.0.km', 150)
            ->where('tendencia_diaria.0.galones', 7.5)
            ->where('tendencia_diaria.1.fecha', '2026-10-21')
            ->where('tendencia_diaria.1.km', 100)
            ->where('tendencia_diaria.1.galones', 0));
    }

    public function test_la_distribucion_de_cumplimiento_clasifica_cada_vehiculo_en_su_rango(): void
    {
        $flota = $this->usuarioConRol('Flota');

        // Sin tanqueadas revisadas en el rango.
        Vehiculo::create(['placa' => 'COSINDATOS', 'is_active' => true, 'meta_km_gl' => 20]);
        VehiculoKilometroDiario::create(['fecha' => '2026-10-20', 'placa' => 'COSINDATOS', 'distancia_km' => 100]);

        // Con rendimiento pero sin meta asignada (explícito: vehiculos.meta_km_gl
        // tiene default 11 desde que se estableció la meta estándar de la
        // flota, así que "sin meta" ya no es lo que pasa si no se especifica).
        Vehiculo::create(['placa' => 'COSINMETA', 'is_active' => true, 'meta_km_gl' => null]);
        VehiculoKilometroDiario::create(['fecha' => '2026-10-20', 'placa' => 'COSINMETA', 'distancia_km' => 100]);
        $this->sembrarVoucher('COSINMETA', 5, 70000, '2026-10-20');

        // Bajo meta (<85%): rendimiento 15 vs meta 20 = 75%.
        Vehiculo::create(['placa' => 'COBAJOMETA', 'is_active' => true, 'meta_km_gl' => 20]);
        VehiculoKilometroDiario::create(['fecha' => '2026-10-20', 'placa' => 'COBAJOMETA', 'distancia_km' => 75]);
        $this->sembrarVoucher('COBAJOMETA', 5, 70000, '2026-10-20');

        // Cumple la meta: rendimiento 20 vs meta 20 = 100%.
        Vehiculo::create(['placa' => 'COCUMPLE', 'is_active' => true, 'meta_km_gl' => 20]);
        VehiculoKilometroDiario::create(['fecha' => '2026-10-20', 'placa' => 'COCUMPLE', 'distancia_km' => 100]);
        $this->sembrarVoucher('COCUMPLE', 5, 70000, '2026-10-20');

        $response = $this->actingAs($flota)->get(route('flota.combustible.index', ['desde' => '2026-10-01', 'hasta' => '2026-10-31']));

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->where('distribucion_cumplimiento.0.rango', 'Sin tanqueadas revisadas')
            ->where('distribucion_cumplimiento.0.total', 1)
            ->where('distribucion_cumplimiento.1.rango', 'Sin meta asignada')
            ->where('distribucion_cumplimiento.1.total', 1)
            ->where('distribucion_cumplimiento.2.rango', 'Bajo meta (<85%)')
            ->where('distribucion_cumplimiento.2.total', 1)
            ->where('distribucion_cumplimiento.4.rango', 'Cumple la meta (≥100%)')
            ->where('distribucion_cumplimiento.4.total', 1));
    }
}
