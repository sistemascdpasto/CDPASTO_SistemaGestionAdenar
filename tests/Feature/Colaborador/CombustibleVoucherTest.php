<?php

namespace Tests\Feature\Colaborador;

use App\Models\Flota\CombustibleVoucher;
use App\Models\Flota\Vehiculo;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CombustibleVoucherTest extends TestCase
{
    use RefreshDatabase;

    private function colaboradorUser(): array
    {
        Role::findOrCreate('Colaborador', 'web');
        $user = User::factory()->create();
        $user->assignRole('Colaborador');

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

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.gemini.api_key' => 'clave-de-prueba']);
    }

    public function test_un_colaborador_puede_subir_un_voucher_y_queda_procesado_por_gemini(): void
    {
        Storage::fake('public');
        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [[
                        'text' => json_encode([
                            'galones' => 10.5,
                            'total_pagado' => 150000,
                            'precio_galon' => 14285.71,
                            'fecha' => '2026-10-23',
                            'confianza' => 'alta',
                        ]),
                    ]]],
                ]],
            ]),
        ]);

        [$user] = $this->colaboradorUser();
        Vehiculo::create(['placa' => 'COPSX001', 'is_active' => true]);

        $response = $this->actingAs($user)->post(route('portal.mis-tanqueadas.store'), [
            'placa' => 'copsx001',
            'foto' => UploadedFile::fake()->image('voucher.jpg'),
        ]);

        $response->assertRedirect();

        $voucher = CombustibleVoucher::first();
        $this->assertNotNull($voucher);
        $this->assertSame('COPSX001', $voucher->placa);
        $this->assertSame('procesado', $voucher->estado);
        $this->assertEquals(10.5, $voucher->galones);
        $this->assertEquals(150000, $voucher->total_pagado);
        $this->assertSame('2026-10-23', $voucher->fecha_voucher->toDateString());
        Storage::disk('public')->assertExists($voucher->foto_path);
    }

    public function test_si_gemini_falla_el_voucher_queda_en_error_pero_se_guarda_igual(): void
    {
        Storage::fake('public');
        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response(['error' => 'boom'], 500),
        ]);

        [$user] = $this->colaboradorUser();
        Vehiculo::create(['placa' => 'COPSX001', 'is_active' => true]);

        $this->actingAs($user)->post(route('portal.mis-tanqueadas.store'), [
            'placa' => 'COPSX001',
            'foto' => UploadedFile::fake()->image('voucher.jpg'),
        ])->assertRedirect();

        $voucher = CombustibleVoucher::first();
        $this->assertNotNull($voucher);
        $this->assertSame('error', $voucher->estado);
        $this->assertNotNull($voucher->gemini_error);
    }

    public function test_la_foto_es_obligatoria(): void
    {
        [$user] = $this->colaboradorUser();

        $this->actingAs($user)->post(route('portal.mis-tanqueadas.store'), [
            'placa' => 'COPSX001',
        ])->assertSessionHasErrors('foto');
    }

    public function test_un_usuario_sin_colaborador_vinculado_no_puede_subir(): void
    {
        Role::findOrCreate('Colaborador', 'web');
        $user = User::factory()->create();
        $user->assignRole('Colaborador');

        $this->actingAs($user)->get(route('portal.mis-tanqueadas.index'))->assertForbidden();
    }
}
