<?php

namespace Tests\Feature\Seguridad;

use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\CondicionSalud;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CondicionSaludFirmaTest extends TestCase
{
    use RefreshDatabase;

    private function seguridadUser(): User
    {
        $role = Role::create(['name' => 'Seguridad', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_it_rejects_signing_an_ingreso_record(): void
    {
        $user = $this->seguridadUser();

        $colaborador = Colaborador::create([
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'is_active' => true,
        ]);

        $ingreso = CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => now(),
            'consentimiento_aceptado' => true,
        ]);

        Storage::fake('public');

        $this->actingAs($user)->post(route('seguridad.condiciones-salud.firmar', $ingreso), [
            'firma' => UploadedFile::fake()->image('firma.png'),
        ])->assertForbidden();
    }

    public function test_it_rejects_signing_when_the_day_is_incomplete(): void
    {
        $user = $this->seguridadUser();

        $colaborador = Colaborador::create([
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'is_active' => true,
        ]);

        // Salida sin su ingreso correspondiente el mismo día.
        $salida = CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'salida',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => now(),
            'consentimiento_aceptado' => true,
        ]);

        Storage::fake('public');

        $this->actingAs($user)->post(route('seguridad.condiciones-salud.firmar', $salida), [
            'firma' => UploadedFile::fake()->image('firma.png'),
        ])->assertStatus(422);
    }

    public function test_it_signs_the_salida_record_when_the_day_is_complete(): void
    {
        $user = $this->seguridadUser();

        $colaborador = Colaborador::create([
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'is_active' => true,
        ]);

        CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => now()->setTime(7, 0),
            'consentimiento_aceptado' => true,
        ]);

        $salida = CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'salida',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => now()->setTime(16, 0),
            'consentimiento_aceptado' => true,
        ]);

        Storage::fake('public');

        $this->actingAs($user)->post(route('seguridad.condiciones-salud.firmar', $salida), [
            'firma' => UploadedFile::fake()->image('firma.png'),
        ])->assertRedirect();

        $salida->refresh();

        $this->assertNotNull($salida->firma_supervisor_path);
        $this->assertSame($user->id, $salida->firmado_por_id);
        $this->assertNotNull($salida->firmado_en);
        Storage::disk('public')->assertExists($salida->firma_supervisor_path);
    }

    public function test_it_can_update_fecha_hora_estado_and_observacion(): void
    {
        $user = $this->seguridadUser();

        $colaborador = Colaborador::create([
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'is_active' => true,
        ]);

        $ingreso = CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => '2026-09-18 08:00:00',
            'consentimiento_aceptado' => true,
        ]);

        $nuevaFechaHora = '2026-09-18T08:30';

        $response = $this->actingAs($user)->patch(route('seguridad.condiciones-salud.update', $ingreso), [
            'fecha_hora' => $nuevaFechaHora,
            'estado' => 'Regular',
            'observacion' => 'Llegó con dolor de cabeza',
        ]);

        $response->assertRedirect(route('seguridad.condiciones-salud.editar-fila', [
            'colaboradorId' => $colaborador->id,
            'fecha' => '2026-09-18',
        ]));

        $ingreso->refresh();

        $this->assertSame('2026-09-18 08:30:00', $ingreso->fecha_hora->format('Y-m-d H:i:s'));
        $this->assertSame('Regular', $ingreso->estado);
        $this->assertSame('Llegó con dolor de cabeza', $ingreso->observacion);
    }

    public function test_it_rejects_updating_to_a_date_that_already_has_a_record_for_same_momento(): void
    {
        $user = $this->seguridadUser();

        $colaborador = Colaborador::create([
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'is_active' => true,
        ]);

        // Ingreso el día 18
        CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => '2026-09-18 08:00:00',
            'consentimiento_aceptado' => true,
        ]);

        // Ingreso el día 19
        $ingresoDia19 = CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => '2026-09-19 08:00:00',
            'consentimiento_aceptado' => true,
        ]);

        // Intentar cambiar la fecha del ingreso del día 19 al día 18 (donde ya existe ingreso)
        $response = $this->actingAs($user)->patch(route('seguridad.condiciones-salud.update', $ingresoDia19), [
            'fecha_hora' => '2026-09-18T09:00',
            'estado' => 'Bueno',
        ]);

        $response->assertSessionHasErrors('fecha_hora');

        $ingresoDia19->refresh();
        $this->assertSame('2026-09-19 08:00:00', $ingresoDia19->fecha_hora->format('Y-m-d H:i:s'));
    }

    public function test_it_can_create_missing_momento_from_edit_page(): void
    {
        $user = $this->seguridadUser();

        $colaborador = Colaborador::create([
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'is_active' => true,
        ]);

        // Solo existe ingreso el día 18
        CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => '2026-09-18 08:00:00',
            'consentimiento_aceptado' => true,
        ]);

        // Crear la salida faltante desde el formulario de edición
        $response = $this->actingAs($user)->post(route('seguridad.condiciones-salud.store'), [
            'colaborador_id' => $colaborador->id,
            'momento' => 'salida',
            'estado' => 'Bueno',
            'fecha_hora' => '2026-09-18T17:00',
            '_redirect_editar' => true,
        ]);

        $response->assertRedirect(route('seguridad.condiciones-salud.editar-fila', [
            'colaboradorId' => $colaborador->id,
            'fecha' => '2026-09-18',
        ]));

        $this->assertSame(2, CondicionSalud::query()->where('colaborador_id', $colaborador->id)->count());
        $salida = CondicionSalud::query()->where('colaborador_id', $colaborador->id)->where('momento', 'salida')->first();
        $this->assertNotNull($salida);
        $this->assertSame('2026-09-18 17:00:00', $salida->fecha_hora->format('Y-m-d H:i:s'));
    }
}
