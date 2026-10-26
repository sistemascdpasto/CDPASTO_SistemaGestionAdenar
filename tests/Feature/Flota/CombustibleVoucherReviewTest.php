<?php

namespace Tests\Feature\Flota;

use App\Models\Flota\CombustibleVoucher;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CombustibleVoucherReviewTest extends TestCase
{
    use RefreshDatabase;

    private function usuarioConRol(string $rol): User
    {
        Role::findOrCreate($rol, 'web');
        $user = User::factory()->create();
        $user->assignRole($rol);

        return $user;
    }

    private function crearVoucher(array $overrides = []): CombustibleVoucher
    {
        $colaborador = Colaborador::create([
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'cargo' => 'Conductor',
            'turno' => 'manana',
            'area' => 'Ruta Norte',
            'is_active' => true,
        ]);

        return CombustibleVoucher::create([
            'colaborador_id' => $colaborador->id,
            'placa' => 'COPSX001',
            'foto_path' => 'flota/combustible/vouchers/1/voucher.jpg',
            'estado' => 'procesado',
            'galones' => 10.5,
            'total_pagado' => 150000,
            ...$overrides,
        ]);
    }

    public function test_un_usuario_de_flota_puede_listar_y_revisar_un_voucher(): void
    {
        $flota = $this->usuarioConRol('Flota');
        $voucher = $this->crearVoucher();

        $this->actingAs($flota)->get(route('flota.combustible.vouchers.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('vouchers.data', 1));

        $this->actingAs($flota)->put(route('flota.combustible.vouchers.update', $voucher), [
            'placa' => 'COPSX001',
            'galones' => 10.5,
            'total_pagado' => 150000,
            'fecha_voucher' => '2026-10-23',
        ])->assertRedirect();

        $voucher->refresh();
        $this->assertSame('revisado', $voucher->estado);
        $this->assertSame($flota->id, $voucher->revisado_por_id);
        $this->assertNotNull($voucher->revisado_at);
        $this->assertEquals(round(150000 / 10.5, 2), (float) $voucher->precio_galon);
    }

    public function test_un_colaborador_no_puede_ver_la_bandeja_de_revision(): void
    {
        $colaborador = $this->usuarioConRol('Colaborador');

        $this->actingAs($colaborador)->get(route('flota.combustible.vouchers.index'))->assertForbidden();
    }

    public function test_reprocesar_un_voucher_en_error_lo_vuelve_a_pasar_por_gemini(): void
    {
        Storage::fake('public');
        config(['services.gemini.api_key' => 'clave-de-prueba']);

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [[
                        'text' => json_encode(['galones' => 8, 'total_pagado' => 120000, 'confianza' => 'media']),
                    ]]],
                ]],
            ]),
        ]);

        Storage::disk('public')->put('flota/combustible/vouchers/1/voucher.jpg', 'contenido-falso');
        $flota = $this->usuarioConRol('Flota');
        $voucher = $this->crearVoucher(['estado' => 'error', 'gemini_error' => 'fallo anterior']);

        $this->actingAs($flota)->post(route('flota.combustible.vouchers.reprocesar', $voucher))->assertRedirect();

        $voucher->refresh();
        $this->assertSame('procesado', $voucher->estado);
        $this->assertNull($voucher->gemini_error);
        $this->assertEquals(8, $voucher->galones);
    }
}
