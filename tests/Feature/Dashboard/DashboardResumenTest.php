<?php

namespace Tests\Feature\Dashboard;

use App\Models\Flota\Varada;
use App\Models\Flota\Vehiculo;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DashboardResumenTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['Administrador', 'Seguridad', 'Reparto', 'Gente', 'Flota'] as $rol) {
            Role::findOrCreate($rol, 'web');
        }
    }

    private function usuario(string ...$roles): User
    {
        $user = User::factory()->create();
        $user->assignRole($roles);

        return $user;
    }

    public function test_el_dashboard_de_un_rol_de_pilar_trae_el_resumen_de_ese_pilar(): void
    {
        $this->actingAs($this->usuario('Flota'))
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('dashboard/role')
                ->has('resumen.pilares.flota.kpis')
                ->missing('resumen.pilares.reparto')
            );
    }

    public function test_el_dashboard_multirol_trae_un_resumen_por_cada_pilar(): void
    {
        $this->actingAs($this->usuario('Seguridad', 'Reparto'))
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('resumen.pilares.seguridad.kpis')
                ->has('resumen.pilares.reparto.pendientes')
            );
    }

    public function test_el_dashboard_de_admin_trae_el_resumen_de_los_cuatro_pilares(): void
    {
        $this->actingAs($this->usuario('Administrador'))
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('dashboard/admin')
                ->has('resumen.pilares.seguridad')
                ->has('resumen.pilares.reparto')
                ->has('resumen.pilares.gente')
                ->has('resumen.pilares.flota')
            );
    }

    public function test_los_kpis_de_flota_reflejan_vehiculos_y_varadas(): void
    {
        $vehiculo = Vehiculo::create([
            'placa' => 'ABC123',
            'is_active' => true,
            'fecha_vencimiento_soat' => now()->subDay()->toDateString(),
        ]);
        Varada::create([
            'placa' => $vehiculo->placa,
            'fecha_reportada' => now()->subDays(3),
        ]);

        $this->actingAs($this->usuario('Flota'))
            ->get('/dashboard')
            ->assertInertia(function ($page) {
                $kpis = collect($page->toArray()['props']['resumen']['pilares']['flota']['kpis']);
                $this->assertSame(1, $kpis->firstWhere('label', 'Vehículos activos')['value']);
                $this->assertSame(1, $kpis->firstWhere('label', 'SOAT vencido o por vencer')['value']);

                $pendientes = collect($page->toArray()['props']['resumen']['pilares']['flota']['pendientes']);
                $this->assertSame(1, $pendientes->firstWhere('label', 'Varadas abiertas')['value']);
            });
    }
}
