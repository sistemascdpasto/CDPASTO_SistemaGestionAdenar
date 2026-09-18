<?php

namespace Tests\Feature\Colaborador;

use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\CondicionSalud;
use App\Models\Seguridad\PruebaAlcoholemia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CondicionSaludPortalTest extends TestCase
{
    use RefreshDatabase;

    private function colaboradorUser(): array
    {
        $role = Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        $colaborador = Colaborador::create([
            'user_id' => $user->id,
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'cargo' => 'Conductor',
            'turno' => 'manana',
            'area' => 'Ruta Norte',
            'is_active' => true,
        ]);

        return [$user, $colaborador];
    }

    private function crearPruebaConFirma(Colaborador $colaborador, User $user): PruebaAlcoholemia
    {
        return PruebaAlcoholemia::create([
            'colaborador_id' => $colaborador->id,
            'tipo' => 'entrada',
            'resultado' => 0,
            'consentimiento_aceptado' => true,
            'consentimiento_en' => now(),
            'firma_path' => 'firmas/test.png',
            'responsable_id' => $user->id,
            'fecha_hora' => now(),
            'estado' => 'realizada',
        ]);
    }

    public function test_form_is_blocked_without_a_signed_test(): void
    {
        [$user] = $this->colaboradorUser();

        $this->actingAs($user)
            ->get(route('portal.condicion-salud'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('colaborador/condicion-salud')->where('puedeFirmar', false));
    }

    public function test_it_rejects_submission_without_consent(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();
        $this->crearPruebaConFirma($colaborador, $user);

        $this->actingAs($user)->post(route('portal.condicion-salud.store'), [
            'momento' => 'ingreso',
            'estado' => 'Bueno',
        ])->assertSessionHasErrors('consentimiento_aceptado');
    }

    public function test_it_stores_condicion_salud_with_signed_test_and_consent_audit_trail(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();
        $prueba = $this->crearPruebaConFirma($colaborador, $user);

        $this->actingAs($user)->post(route('portal.condicion-salud.store'), [
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'consentimiento_aceptado' => true,
        ])->assertRedirect(route('portal.condicion-salud.historial'));

        $condicion = $colaborador->condicionesSalud()->first();

        $this->assertNotNull($condicion);
        $this->assertSame('ingreso', $condicion->momento);
        $this->assertSame('Bueno', $condicion->estado);
        $this->assertTrue($condicion->consentimiento_aceptado);
        $this->assertNotNull($condicion->consentimiento_en);
        $this->assertNotNull($condicion->consentimiento_ip);
        $this->assertSame('v2', $condicion->consentimiento_texto_version);
        $this->assertSame($prueba->id, $condicion->prueba_alcoholemia_id);
        $this->assertSame($user->id, $condicion->responsable_id);

        // Enviar de nuevo ingreso el mismo día se rechaza: hay entrada abierta.
        $this->actingAs($user)->post(route('portal.condicion-salud.store'), [
            'momento' => 'ingreso',
            'estado' => 'Regular',
            'observacion' => 'Dolor de cabeza leve',
            'consentimiento_aceptado' => true,
        ])->assertSessionHasErrors('momento');

        $this->assertSame(1, $colaborador->condicionesSalud()->count());
        $this->assertSame('Bueno', $colaborador->condicionesSalud()->first()->estado);
    }

    public function test_it_blocks_a_new_ingreso_when_there_is_an_open_jornada(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();
        $this->crearPruebaConFirma($colaborador, $user);

        // Ingreso de ayer, sin salida.
        CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => now()->subDay(),
            'consentimiento_aceptado' => true,
            'consentimiento_en' => now()->subDay(),
        ]);

        $this->actingAs($user)->get(route('portal.condicion-salud'))
            ->assertInertia(fn ($page) => $page->where('jornadaAbierta', true));

        // No se puede registrar un ingreso con una entrada abierta.
        $this->actingAs($user)->post(route('portal.condicion-salud.store'), [
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'consentimiento_aceptado' => true,
        ])->assertSessionHasErrors('momento');

        $this->assertSame(1, $colaborador->condicionesSalud()->count());

        // Registrar la salida cierra la jornada (ya pasó más de 1 hora).
        $this->actingAs($user)->post(route('portal.condicion-salud.store'), [
            'momento' => 'salida',
            'estado' => 'Bueno',
            'consentimiento_aceptado' => true,
        ])->assertRedirect();

        $this->actingAs($user)->get(route('portal.condicion-salud'))
            ->assertInertia(fn ($page) => $page->where('jornadaAbierta', false));

        // Ahora sí puede registrar un nuevo ingreso (hoy).
        $this->actingAs($user)->post(route('portal.condicion-salud.store'), [
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'consentimiento_aceptado' => true,
        ])->assertRedirect()->assertSessionDoesntHaveErrors();

        $this->assertSame(3, $colaborador->condicionesSalud()->count());
    }

    public function test_salida_is_rejected_without_open_entry(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();
        $this->crearPruebaConFirma($colaborador, $user);

        // Intentar registrar salida sin tener ninguna entrada
        $this->actingAs($user)->post(route('portal.condicion-salud.store'), [
            'momento' => 'salida',
            'estado' => 'Bueno',
            'consentimiento_aceptado' => true,
        ])->assertSessionHasErrors('momento');

        $this->assertSame(0, $colaborador->condicionesSalud()->count());
    }

    public function test_salida_is_rejected_when_entry_was_less_than_one_hour_ago(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();
        $this->crearPruebaConFirma($colaborador, $user);

        // Registrar ingreso hace 30 minutos
        Carbon::setTestNow(now()->subMinutes(30));
        $this->actingAs($user)->post(route('portal.condicion-salud.store'), [
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'consentimiento_aceptado' => true,
        ])->assertRedirect();

        // Volver al "ahora" real — solo 30 minutos después
        Carbon::setTestNow();

        $this->actingAs($user)->post(route('portal.condicion-salud.store'), [
            'momento' => 'salida',
            'estado' => 'Bueno',
            'consentimiento_aceptado' => true,
        ])->assertSessionHasErrors('momento');

        $this->assertSame(1, $colaborador->condicionesSalud()->count());
    }

    public function test_salida_is_allowed_after_one_hour(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();
        $this->crearPruebaConFirma($colaborador, $user);

        // Registrar ingreso hace 2 horas
        Carbon::setTestNow(now()->subHours(2));
        $this->actingAs($user)->post(route('portal.condicion-salud.store'), [
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'consentimiento_aceptado' => true,
        ])->assertRedirect();

        Carbon::setTestNow();

        $this->actingAs($user)->post(route('portal.condicion-salud.store'), [
            'momento' => 'salida',
            'estado' => 'Bueno',
            'consentimiento_aceptado' => true,
        ])->assertRedirect()->assertSessionDoesntHaveErrors();

        $this->assertSame(2, $colaborador->condicionesSalud()->count());
    }

    public function test_double_salida_for_same_entry_is_rejected(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();
        $this->crearPruebaConFirma($colaborador, $user);

        // Ingreso ayer y salida ayer (jornada cerrada)
        CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => now()->subDay()->setTime(7, 0),
            'consentimiento_aceptado' => true,
        ]);
        CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'salida',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => now()->subDay()->setTime(16, 0),
            'consentimiento_aceptado' => true,
        ]);

        // Sin entrada abierta, no se puede registrar salida
        $this->actingAs($user)->post(route('portal.condicion-salud.store'), [
            'momento' => 'salida',
            'estado' => 'Bueno',
            'consentimiento_aceptado' => true,
        ])->assertSessionHasErrors('momento');

        $this->assertSame(2, $colaborador->condicionesSalud()->count());
    }

    public function test_historial_lists_records_and_exposes_jornada_abierta(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();

        CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => now(),
            'consentimiento_aceptado' => true,
            'consentimiento_en' => now(),
        ]);

        $this->actingAs($user)->get(route('portal.condicion-salud.historial'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('colaborador/condicion-salud/historial')
                ->has('registros.data', 1)
                ->where('jornadaAbierta', true)
            );
    }
}
