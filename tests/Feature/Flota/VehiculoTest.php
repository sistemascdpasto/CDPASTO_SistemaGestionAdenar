<?php

namespace Tests\Feature\Flota;

use App\Models\Flota\Vehiculo;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class VehiculoTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsFlota(): User
    {
        $role = Role::firstOrCreate(['name' => 'Flota', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function actingAsAdministrador(): User
    {
        $role = Role::firstOrCreate(['name' => 'Administrador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_it_can_store_a_vehiculo_with_multiple_documents(): void
    {
        Storage::fake('public');
        $user = $this->actingAsFlota();

        $response = $this->actingAs($user)->post(route('flota.vehiculos.store'), [
            'placa' => 'ABC123',
            'truck_type' => 'Tractocamión',
            'modelo' => '2022',
            'capacidad_pallets' => 20,
            'is_active' => true,
            'documento_soat' => [
                UploadedFile::fake()->create('soat.pdf', 100, 'application/pdf'),
                UploadedFile::fake()->create('soat-2.pdf', 100, 'application/pdf'),
            ],
        ]);

        $response->assertRedirect(route('flota.vehiculos.index'));

        $vehiculo = Vehiculo::where('placa', 'ABC123')->firstOrFail();
        $this->assertCount(2, $vehiculo->documentos);
        Storage::disk('public')->assertExists($vehiculo->documentos->first()->path);
    }

    public function test_it_can_view_and_edit_a_vehiculo(): void
    {
        $user = $this->actingAsFlota();

        $vehiculo = Vehiculo::create([
            'placa' => 'XYZ999',
            'truck_type' => 'Sencillo',
            'modelo' => '2020',
            'capacidad_pallets' => 10,
            'is_active' => true,
        ]);

        $this->actingAs($user)->get(route('flota.vehiculos.show', $vehiculo))->assertOk();
        $this->actingAs($user)->get(route('flota.vehiculos.edit', $vehiculo))->assertOk();

        $this->actingAs($user)->put(route('flota.vehiculos.update', $vehiculo), [
            'placa' => 'XYZ999',
            'truck_type' => 'Doble troque',
            'modelo' => '2021',
            'capacidad_pallets' => 12,
            'is_active' => true,
        ])->assertRedirect(route('flota.vehiculos.index'));

        $this->assertSame('Doble troque', $vehiculo->fresh()->truck_type);
    }

    public function test_flota_no_puede_eliminar_un_vehiculo_pero_administrador_si(): void
    {
        $flota = $this->actingAsFlota();
        $admin = $this->actingAsAdministrador();

        $vehiculo = Vehiculo::create(['placa' => 'DEL123', 'is_active' => true]);

        $this->actingAs($flota)->delete(route('flota.vehiculos.destroy', $vehiculo))
            ->assertForbidden();
        $this->assertNotSoftDeleted($vehiculo);

        $this->actingAs($admin)->delete(route('flota.vehiculos.destroy', $vehiculo))
            ->assertRedirect(route('flota.vehiculos.index'));
        $this->assertSoftDeleted($vehiculo);
    }

    public function test_it_stores_and_updates_the_document_expiry_dates(): void
    {
        Storage::fake('public');
        $user = $this->actingAsFlota();

        $this->actingAs($user)->post(route('flota.vehiculos.store'), [
            'placa' => 'EXP123',
            'is_active' => true,
            'fecha_vencimiento_soat' => '2026-12-31',
            'fecha_vencimiento_tecnomecanica' => '2027-03-15',
        ])->assertRedirect(route('flota.vehiculos.index'));

        $vehiculo = Vehiculo::where('placa', 'EXP123')->firstOrFail();
        $this->assertSame('2026-12-31', $vehiculo->fecha_vencimiento_soat->toDateString());
        $this->assertSame('2027-03-15', $vehiculo->fecha_vencimiento_tecnomecanica->toDateString());

        $this->actingAs($user)->put(route('flota.vehiculos.update', $vehiculo), [
            'placa' => 'EXP123',
            'is_active' => true,
            'fecha_vencimiento_soat' => '2028-01-10',
            'fecha_vencimiento_tecnomecanica' => '',
        ])->assertRedirect(route('flota.vehiculos.index'));

        $vehiculo->refresh();
        $this->assertSame('2028-01-10', $vehiculo->fecha_vencimiento_soat->toDateString());
        $this->assertNull($vehiculo->fecha_vencimiento_tecnomecanica);
    }

    public function test_marcar_no_disponible_exige_la_novedad(): void
    {
        $user = $this->actingAsFlota();
        $vehiculo = Vehiculo::create(['placa' => 'TOG123', 'is_active' => true]);

        $this->actingAs($user)->patch(route('flota.vehiculos.toggle-activo', $vehiculo))
            ->assertSessionHasErrors('novedad');

        $this->assertTrue($vehiculo->fresh()->is_active);
    }

    public function test_it_can_toggle_vehiculo_availability_con_novedad_y_registra_historial(): void
    {
        $user = $this->actingAsFlota();
        $vehiculo = Vehiculo::create(['placa' => 'TOG123', 'is_active' => true]);

        $this->actingAs($user)
            ->patch(route('flota.vehiculos.toggle-activo', $vehiculo), [
                'novedad' => 'Falla mecánica en el motor.',
            ])
            ->assertRedirect();

        $vehiculo->refresh();
        $this->assertFalse($vehiculo->is_active);
        $this->assertSame('Falla mecánica en el motor.', $vehiculo->novedad_no_disponible);
        $this->assertSame(1, $vehiculo->disponibilidadHistorial()->count());
        $this->assertFalse($vehiculo->disponibilidadHistorial()->latest()->first()->disponible);

        $this->actingAs($user)->patch(route('flota.vehiculos.toggle-activo', $vehiculo))
            ->assertRedirect();

        $vehiculo->refresh();
        $this->assertTrue($vehiculo->is_active);
        $this->assertNull($vehiculo->novedad_no_disponible);
        $this->assertSame(2, $vehiculo->disponibilidadHistorial()->count());
        $this->assertTrue($vehiculo->disponibilidadHistorial()->latest()->first()->disponible);
    }
}
