<?php

namespace Tests\Feature\Reparto;

use App\Models\Reparto\EventosTripulacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class IndicadoresResumenTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        Role::findOrCreate('Administrador', 'web');
        $user = User::factory()->create();
        $user->assignRole('Administrador');

        return $user;
    }

    public function test_el_resumen_ejecutivo_no_revienta_con_excesos_tiempo_ruta_como_texto(): void
    {
        // excesos_tiempo_ruta pasó a guardar la hora del día como texto
        // (ej. "07:47:00 a. m."); el agrupado por cargo no puede sumarlo.
        EventosTripulacion::create([
            'fecha' => now()->toDateString(),
            'documento' => '900900900',
            'nombre' => 'Ana Prueba',
            'cargo' => 'Conductor de Reparto',
            'placa' => 'ABC123',
            'adherencia_tiempo' => 88.0,
            'entrega_en_rango' => 92.0,
            'rechazos' => 1.5,
            'alertas_velocidad_curvas' => 1,
            'excesos_tiempo_ruta' => '07:47:00 a. m.',
            'rmd' => 4.2,
        ]);

        $this->actingAs($this->admin())
            ->get(route('reparto.indicadores-resumen.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('reparto/indicadores-resumen/index')->has('por_cargo'));
    }
}
