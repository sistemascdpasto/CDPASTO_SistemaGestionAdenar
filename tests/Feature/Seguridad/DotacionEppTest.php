<?php

namespace Tests\Feature\Seguridad;

use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorEppPerfil;
use App\Models\Seguridad\EppEntrega;
use App\Models\User;
use App\Services\Seguridad\EppEstadoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DotacionEppTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsSeguridad(): User
    {
        $role = Role::findOrCreate('Seguridad', 'web');
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function colaborador(array $overrides = []): Colaborador
    {
        return Colaborador::create([
            'cedula' => '900111111',
            'nombres' => 'Ana',
            'apellidos' => 'Ruiz',
            'estado_registro' => 'completo',
            'is_active' => true,
            ...$overrides,
        ]);
    }

    public function test_registrar_una_entrega_guarda_los_items_firma_y_foto(): void
    {
        Storage::fake('public');
        $user = $this->actingAsSeguridad();
        $colaborador = $this->colaborador();

        $firmaPng = base64_encode(file_get_contents(public_path('favicon.ico')));

        $response = $this->actingAs($user)->post(route('seguridad.dotacion-epp.entregas.store', $colaborador), [
            'fecha_entrega' => '2026-10-01',
            'guantes' => '1',
            'casco' => '1',
            'otros_cual' => '',
            'firma' => "data:image/png;base64,{$firmaPng}",
            'foto' => UploadedFile::fake()->image('recibido.jpg'),
        ]);

        $response->assertRedirect();

        $entrega = EppEntrega::where('colaborador_id', $colaborador->id)->firstOrFail();
        $this->assertTrue($entrega->guantes);
        $this->assertTrue($entrega->casco);
        $this->assertFalse($entrega->gafas);
        $this->assertNotNull($entrega->firma_path);
        $this->assertNotNull($entrega->foto_path);
        Storage::disk('public')->assertExists($entrega->firma_path);
        Storage::disk('public')->assertExists($entrega->foto_path);
    }

    public function test_el_estado_por_item_clasifica_al_dia_proximo_y_vencido(): void
    {
        $colaborador = $this->colaborador();

        // guantes: hace 1 mes -> al día. casco: hace 3 meses y medio -> próximo.
        // gafas: nunca entregadas -> vencido.
        EppEntrega::create([
            'colaborador_id' => $colaborador->id,
            'fecha_entrega' => now()->subMonth(),
            'guantes' => true,
        ]);
        EppEntrega::create([
            'colaborador_id' => $colaborador->id,
            'fecha_entrega' => now()->subMonths(3)->subDays(15),
            'casco' => true,
        ]);

        $estado = app(EppEstadoService::class)->estadoPorItem($colaborador->fresh()->load('eppEntregas'));

        $this->assertSame('al_dia', $estado['guantes']['estado']);
        $this->assertSame('proximo', $estado['casco']['estado']);
        $this->assertSame('vencido', $estado['gafas']['estado']);
        $this->assertNull($estado['gafas']['fecha']);
    }

    public function test_un_item_vencido_marca_el_resumen_del_colaborador_como_vencido(): void
    {
        $colaborador = $this->colaborador();
        EppEntrega::create(['colaborador_id' => $colaborador->id, 'fecha_entrega' => now()->subMonth(), 'guantes' => true]);
        // El resto de ítems nunca se entregaron -> vencidos.

        $resumen = app(EppEstadoService::class)->resumenColaborador($colaborador->fresh()->load('eppEntregas'));

        $this->assertSame('vencido', $resumen);
    }

    public function test_el_compromiso_se_guarda_y_al_reenviarse_se_actualiza_sin_duplicar(): void
    {
        Storage::fake('public');
        $user = $this->actingAsSeguridad();
        $colaborador = $this->colaborador();
        $firmaPng = base64_encode(file_get_contents(public_path('favicon.ico')));

        $this->actingAs($user)->post(route('seguridad.dotacion-epp.compromiso.store', $colaborador), [
            'firma' => "data:image/png;base64,{$firmaPng}",
        ])->assertRedirect();

        $this->assertSame(1, ColaboradorEppPerfil::where('colaborador_id', $colaborador->id)->count());
        $primeraFirma = $colaborador->fresh()->eppPerfil->compromiso_firma_path;
        $this->assertNotNull($primeraFirma);

        $this->actingAs($user)->post(route('seguridad.dotacion-epp.compromiso.store', $colaborador), [
            'firma' => "data:image/png;base64,{$firmaPng}",
        ])->assertRedirect();

        $this->assertSame(1, ColaboradorEppPerfil::where('colaborador_id', $colaborador->id)->count());
    }

    public function test_el_pdf_por_persona_se_genera_sin_error(): void
    {
        Storage::fake('public');
        $user = $this->actingAsSeguridad();
        $colaborador = $this->colaborador();
        EppEntrega::create(['colaborador_id' => $colaborador->id, 'fecha_entrega' => now(), 'guantes' => true]);

        $response = $this->actingAs($user)->get(route('seguridad.dotacion-epp.pdf', $colaborador));

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', $response->headers->get('content-type'));
    }
}
