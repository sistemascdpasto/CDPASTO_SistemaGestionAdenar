<?php

namespace Tests\Feature\Flota;

use App\Models\Flota\Vehiculo;
use App\Models\Reparto\Modulacion;
use App\Models\Reparto\ModulacionItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class OcupacionCargaTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsFlota(): User
    {
        $role = Role::findOrCreate('Flota', 'web');
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_calcula_el_porcentaje_de_ocupacion_sumando_los_viajes_del_dia(): void
    {
        $user = $this->actingAsFlota();

        Vehiculo::create(['placa' => 'ABC123', 'capacidad_carga_kg' => 5000]);

        $modulacion = Modulacion::create(['fecha' => '2026-10-08']);
        ModulacionItem::create([
            'modulacion_id' => $modulacion->id,
            'placa' => 'ABC123',
            'viajes' => [
                ['lugares' => 'Zona Norte', 'barrio' => '', 'cliente' => 'Cliente A', 'peso' => '2,5'],
                ['lugares' => 'Zona Sur', 'barrio' => '', 'cliente' => 'Cliente B', 'peso' => '1.8'],
            ],
        ]);

        // (2.5 + 1.8) ton = 4300 kg de 5000 kg => 86%
        $response = $this->actingAs($user)->get(route('flota.ocupacion-carga.index', [
            'desde' => '2026-10-01',
            'hasta' => '2026-10-31',
        ]));

        $response->assertInertia(function ($page) {
            $page->where('filas.0.placa', 'ABC123')
                ->where('filas.0.peso_toneladas', 4.3)
                ->where('filas.0.ocupacion_pct', 86)
                ->where('kpis.promedio_ocupacion', 86)
                ->where('kpis.rutas_sobrecargadas', 0)
                ->where('kpis.vehiculos_sin_capacidad', 0);
        });
    }

    public function test_marca_sin_capacidad_cuando_el_vehiculo_no_tiene_capacidad_registrada(): void
    {
        $user = $this->actingAsFlota();

        // Sin capacidad_carga_kg registrada.
        Vehiculo::create(['placa' => 'XYZ999']);

        $modulacion = Modulacion::create(['fecha' => '2026-10-08']);
        ModulacionItem::create([
            'modulacion_id' => $modulacion->id,
            'placa' => 'XYZ999',
            'viajes' => [
                ['lugares' => 'Zona Centro', 'barrio' => '', 'cliente' => 'Cliente C', 'peso' => '3'],
            ],
        ]);

        $response = $this->actingAs($user)->get(route('flota.ocupacion-carga.index', [
            'desde' => '2026-10-01',
            'hasta' => '2026-10-31',
        ]));

        $response->assertInertia(function ($page) {
            $page->where('filas.0.ocupacion_pct', null)
                ->where('kpis.vehiculos_sin_capacidad', 1)
                ->where('kpis.promedio_ocupacion', null);
        });
    }

    public function test_rutas_sin_peso_registrado_no_aparecen_en_el_listado(): void
    {
        $user = $this->actingAsFlota();

        Vehiculo::create(['placa' => 'DEF456', 'capacidad_carga_kg' => 4000]);

        $modulacion = Modulacion::create(['fecha' => '2026-10-08']);
        ModulacionItem::create([
            'modulacion_id' => $modulacion->id,
            'placa' => 'DEF456',
            'viajes' => [],
        ]);

        $response = $this->actingAs($user)->get(route('flota.ocupacion-carga.index', [
            'desde' => '2026-10-01',
            'hasta' => '2026-10-31',
        ]));

        $response->assertInertia(fn ($page) => $page->where('kpis.total_rutas', 0)->where('filas', []));
    }
}
