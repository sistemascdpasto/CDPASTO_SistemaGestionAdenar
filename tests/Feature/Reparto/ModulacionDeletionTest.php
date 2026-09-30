<?php

namespace Tests\Feature\Reparto;

use App\Models\Reparto\Modulacion;
use App\Models\Reparto\ModulacionItem;
use App\Models\Reparto\ModulacionNovedad;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ModulacionDeletionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::findOrCreate('Reparto', 'web');
    }

    private function usuarioReparto(): User
    {
        $user = User::factory()->create();
        $user->assignRole('Reparto');

        return $user;
    }

    private function crearPlaneacion(): Modulacion
    {
        return Modulacion::create([
            'fecha' => '2026-09-29',
            'ud_programado_por' => 'Usuario de prueba',
        ]);
    }

    private function crearRuta(Modulacion $modulacion, string $placa): ModulacionItem
    {
        return ModulacionItem::create([
            'modulacion_id' => $modulacion->id,
            'placa' => $placa,
            'tripulacion' => [],
            'viajes' => [],
        ]);
    }

    public function test_guardar_planeacion_redirige_a_sus_detalles_en_modo_lectura(): void
    {
        $this->actingAs($this->usuarioReparto())
            ->post(route('reparto.modulacion.storeBatch'), [
                'fecha' => '2026-09-29',
                'rutas' => [
                    [
                        'placa' => 'AAA111',
                        'tripulacion' => [],
                        'viajes' => [],
                    ],
                ],
            ])
            ->assertRedirect(route('reparto.modulacion.index', [
                'fecha' => '2026-09-29',
                'readOnly' => 'true',
            ]));

        $modulacion = Modulacion::query()->where('fecha', '2026-09-29')->firstOrFail();
        $this->assertDatabaseHas('modulacion_items', [
            'modulacion_id' => $modulacion->id,
            'placa' => 'AAA111',
        ]);
    }

    public function test_guardar_varios_municipios_en_un_viaje_sin_barrios(): void
    {
        $this->actingAs($this->usuarioReparto())
            ->post(route('reparto.modulacion.storeBatch'), [
                'fecha' => '2026-09-29',
                'rutas' => [
                    [
                        'placa' => 'AAA111',
                        'tripulacion' => [],
                        'viajes' => [
                            [
                                'lugares' => 'Albán',
                                'barrio' => null,
                                'destinos' => [
                                    ['lugares' => 'Albán', 'barrio' => null],
                                    ['lugares' => 'La Unión', 'barrio' => null],
                                ],
                                'cliente' => '125',
                                'peso' => '12.5',
                            ],
                        ],
                    ],
                ],
            ])
            ->assertRedirect(route('reparto.modulacion.index', [
                'fecha' => '2026-09-29',
                'readOnly' => 'true',
            ]));

        $modulacion = Modulacion::query()->where('fecha', '2026-09-29')->firstOrFail();
        $ruta = $modulacion->items()->where('placa', 'AAA111')->firstOrFail();
        $viaje = $ruta->viajes[0];

        $this->assertCount(2, $viaje['destinos']);
        $this->assertSame('Albán', $viaje['destinos'][0]['lugares']);
        $this->assertNull($viaje['destinos'][0]['barrio']);
        $this->assertSame('La Unión', $viaje['destinos'][1]['lugares']);
        $this->assertNull($viaje['destinos'][1]['barrio']);
        $this->assertSame('125', $viaje['cliente']);
        $this->assertSame('12.5', $viaje['peso']);
    }

    public function test_detalles_de_planeacion_acepta_solicitud_de_exportacion_desde_historial(): void
    {
        $modulacion = $this->crearPlaneacion();

        $this->actingAs($this->usuarioReparto())
            ->get(route('reparto.modulacion.index', [
                'fecha' => $modulacion->fecha,
                'readOnly' => 'true',
                'exportExcel' => 'true',
            ]))
            ->assertInertia(fn ($page) => $page
                ->component('reparto/modulacion/index')
                ->where('readOnly', true)
                ->where('exportExcel', true));
    }

    public function test_tripulacion_recibe_colaboradores_con_su_area_incluyendo_responsable_de_reparto(): void
    {
        Colaborador::create([
                'cedula' => '900111111',
                'nombres' => 'Ana',
                'apellidos' => 'Operativa',
                'cargo' => 'RESPONSABLE DE REPARTO',
                'area' => 'Operativa',
                'estado_registro' => 'completo',
                'is_active' => true,
        ]);

        Colaborador::create([
                'cedula' => '900222222',
                'nombres' => 'Beto',
                'apellidos' => 'Administrativo',
                'cargo' => 'AUXILIAR ADMINISTRATIVO',
                'area' => 'Administrativa',
                'estado_registro' => 'completo',
                'is_active' => true,
        ]);

        $this->actingAs($this->usuarioReparto())
                ->get(route('reparto.modulacion.index', ['fecha' => '2026-09-29']))
                ->assertInertia(fn ($page) => $page
                    ->component('reparto/modulacion/index')
                    ->has('colaboradores', 2)
                    ->where('colaboradores.0.cargo', 'RESPONSABLE DE REPARTO')
                    ->where('colaboradores.0.area', 'Operativa'));
    }

    public function test_eliminar_una_ruta_con_otras_rutas_conserva_la_planeacion(): void
    {
        $modulacion = $this->crearPlaneacion();
        $rutaEliminada = $this->crearRuta($modulacion, 'AAA111');
        $rutaConservada = $this->crearRuta($modulacion, 'BBB222');

        $this->actingAs($this->usuarioReparto())
            ->delete(route('reparto.modulacion.destroyItem', $rutaEliminada->id))
            ->assertRedirect();

        $this->assertDatabaseMissing('modulacion_items', ['id' => $rutaEliminada->id]);
        $this->assertDatabaseHas('modulacion_items', ['id' => $rutaConservada->id]);
        $this->assertDatabaseHas('modulaciones', ['id' => $modulacion->id]);
    }

    public function test_eliminar_un_viaje_de_tres_conserva_la_placa_tripulacion_y_otros_viajes(): void
    {
        $modulacion = $this->crearPlaneacion();
        $ruta = $this->crearRuta($modulacion, 'AAA111');
        $otraRuta = $this->crearRuta($modulacion, 'BBB222');
        $ruta->update([
            'viajes' => [
                ['lugares' => 'Albán', 'barrio' => 'Centro'],
                ['lugares' => 'Pasto', 'barrio' => 'Centro'],
                ['lugares' => 'Ipiales', 'barrio' => 'Centro'],
            ],
            'tripulacion' => [
                ['colaborador_id' => 101, 'cedula' => '123456', 'nombres' => 'Colaborador Ruta A'],
            ],
        ]);

        $this->actingAs($this->usuarioReparto())
            ->delete(route('reparto.modulacion.destroyViaje', [
                'id' => $ruta->id,
                'viajeIndex' => 0,
            ]), [
                'return_fecha' => $modulacion->fecha,
                'return_read_only' => true,
            ])
            ->assertRedirect(route('reparto.modulacion.index', [
                'fecha' => $modulacion->fecha,
                'readOnly' => 'true',
            ]));

        $this->assertSame([
            ['lugares' => 'Pasto', 'barrio' => 'Centro'],
            ['lugares' => 'Ipiales', 'barrio' => 'Centro'],
        ], $ruta->fresh()->viajes);
        $this->assertSame('AAA111', $ruta->fresh()->placa);
        $this->assertSame('Colaborador Ruta A', $ruta->fresh()->tripulacion[0]['nombres']);
        $this->assertDatabaseHas('modulacion_items', ['id' => $ruta->id]);
        $this->assertDatabaseHas('modulacion_items', ['id' => $otraRuta->id]);
        $this->assertDatabaseHas('modulaciones', ['id' => $modulacion->id]);
    }

    public function test_eliminar_el_ultimo_viaje_elimina_solo_su_ruta_si_hay_otras(): void
    {
        $modulacion = $this->crearPlaneacion();
        $rutaSinViajes = $this->crearRuta($modulacion, 'AAA111');
        $rutaSinViajes->update([
            'viajes' => [['lugares' => 'Albán', 'barrio' => 'Centro']],
        ]);
        $otraRuta = $this->crearRuta($modulacion, 'BBB222');

        $this->actingAs($this->usuarioReparto())
            ->delete(route('reparto.modulacion.destroyViaje', [
                'id' => $rutaSinViajes->id,
                'viajeIndex' => 0,
            ]))
            ->assertRedirect();

        $this->assertDatabaseMissing('modulacion_items', ['id' => $rutaSinViajes->id]);
        $this->assertDatabaseHas('modulacion_items', ['id' => $otraRuta->id]);
        $this->assertDatabaseHas('modulaciones', ['id' => $modulacion->id]);
    }

    public function test_eliminar_el_ultimo_viaje_de_la_ultima_ruta_elimina_la_planeacion(): void
    {
        $modulacion = $this->crearPlaneacion();
        $ruta = $this->crearRuta($modulacion, 'AAA111');
        $ruta->update([
            'viajes' => [['lugares' => 'Albán', 'barrio' => 'Centro']],
        ]);
        $novedad = ModulacionNovedad::create([
            'modulacion_id' => $modulacion->id,
            'nombres' => 'Novedad de prueba',
        ]);

        $this->actingAs($this->usuarioReparto())
            ->delete(route('reparto.modulacion.destroyViaje', [
                'id' => $ruta->id,
                'viajeIndex' => 0,
            ]))
            ->assertRedirect();

        $this->assertDatabaseMissing('modulacion_items', ['id' => $ruta->id]);
        $this->assertDatabaseMissing('modulacion_novedades', ['id' => $novedad->id]);
        $this->assertDatabaseMissing('modulaciones', ['id' => $modulacion->id]);
    }

    public function test_eliminar_la_ultima_ruta_elimina_permanentemente_la_planeacion(): void
    {
        $modulacion = $this->crearPlaneacion();
        $ruta = $this->crearRuta($modulacion, 'AAA111');
        $novedad = ModulacionNovedad::create([
            'modulacion_id' => $modulacion->id,
            'nombres' => 'Novedad de prueba',
        ]);

        $this->actingAs($this->usuarioReparto())
            ->delete(route('reparto.modulacion.destroyItem', $ruta->id))
            ->assertRedirect();

        $this->assertDatabaseMissing('modulacion_items', ['id' => $ruta->id]);
        $this->assertDatabaseMissing('modulacion_novedades', ['id' => $novedad->id]);
        $this->assertDatabaseMissing('modulaciones', ['id' => $modulacion->id]);

        $this->get(route('reparto.modulacion.index', [
            'fecha' => $modulacion->fecha,
            'readOnly' => 'true',
        ]))->assertInertia(fn ($page) => $page
            ->component('reparto/modulacion/index')
            ->where('modulacion', null));
    }

    public function test_eliminar_desde_historial_elimina_la_planeacion_y_sus_rutas(): void
    {
        $modulacion = $this->crearPlaneacion();
        $ruta = $this->crearRuta($modulacion, 'AAA111');

        $this->actingAs($this->usuarioReparto())
            ->delete(route('reparto.modulacion.destroy', $modulacion->id))
            ->assertRedirect(route('reparto.modulacion.historial'));

        $this->assertDatabaseMissing('modulacion_items', ['id' => $ruta->id]);
        $this->assertDatabaseMissing('modulaciones', ['id' => $modulacion->id]);

        $this->get(route('reparto.modulacion.index', [
            'fecha' => $modulacion->fecha,
            'readOnly' => 'true',
        ]))->assertInertia(fn ($page) => $page
            ->component('reparto/modulacion/index')
            ->where('modulacion', null));
    }
}
