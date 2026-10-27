<?php

namespace Tests\Feature\Reparto;

use App\Models\Reparto\EventosTripulacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class IndicadoresEntregaRangoTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        Role::findOrCreate('Administrador', 'web');
        $user = User::factory()->create();
        $user->assignRole('Administrador');

        return $user;
    }

    public function test_filtro_de_fecha_vacio_no_revienta_sin_datos(): void
    {
        // El middleware ConvertEmptyStringsToNull convierte '' a null antes de
        // llegar al controlador; request()->input('fecha_hasta', '') devolvía
        // ese null (la llave ya existe) en vez del default, rompiendo el tipo
        // string de emptyResponse(). Sin filas que coincidan: cae a esa rama.
        $this->actingAs($this->admin())
            ->get(route('reparto.indicadores-entrega-rango.index', ['fecha_desde' => '', 'fecha_hasta' => '', 'cargo' => '']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('reparto/indicadores-entrega-rango/index'));
    }

    public function test_filtro_de_fecha_vacio_no_revienta_con_datos(): void
    {
        EventosTripulacion::create([
            'fecha' => now()->toDateString(),
            'documento' => '900900900',
            'nombre' => 'Ana Prueba',
            'cargo' => 'Conductor de Reparto',
            'placa' => 'ABC123',
            'entrega_en_rango' => 92.0,
        ]);

        $this->actingAs($this->admin())
            ->get(route('reparto.indicadores-entrega-rango.index', ['fecha_desde' => '', 'fecha_hasta' => '', 'cargo' => '']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('reparto/indicadores-entrega-rango/index')->has('kpis'));
    }
}
