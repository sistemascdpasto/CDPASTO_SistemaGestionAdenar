<?php

namespace Tests\Feature\Api;

use App\Models\GeovictoriaAsistencia;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GeovictoriaAsistenciaApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.geovictoria.token' => 'token-de-prueba']);
    }

    private function registro(array $overrides = []): array
    {
        return [
            'identificador' => '12345678',
            'fecha' => '2026-08-24',
            'apellidos' => 'Perez',
            'nombres' => 'Juan',
            'cargo' => 'Movilizador',
            'grupo' => 'Bogota',
            'permiso' => 'Ninguno',
            'turno' => 'Diurno',
            'entrada' => '06:00',
            'salida_descanso' => '10:00',
            'ingreso_descanso' => '10:30',
            'salida' => '18:00',
            'horas_trabajadas' => '11:30',
            'hea' => '01:00',
            'hec' => '00:30',
            'hnt' => '00:00',
            'exceso_jornada' => true,
            'horas_descanso_previo' => '10h 30m',
            'descanso_no_efectivo' => false,
            ...$overrides,
        ];
    }

    public function test_it_rejects_requests_without_a_valid_token(): void
    {
        $payload = ['registros' => [$this->registro()]];

        $this->postJson('/api/geovictoria/asistencias', $payload)
            ->assertStatus(401);

        $this->withHeader('Authorization', 'Bearer token-incorrecto')
            ->postJson('/api/geovictoria/asistencias', $payload)
            ->assertStatus(401);
    }

    public function test_it_stores_a_batch_of_registros(): void
    {
        $payload = [
            'registros' => [
                $this->registro(),
                $this->registro(['identificador' => '87654321', 'nombres' => 'Ana', 'exceso_jornada' => false, 'descanso_no_efectivo' => true]),
            ],
        ];

        $this->withHeader('Authorization', 'Bearer token-de-prueba')
            ->postJson('/api/geovictoria/asistencias', $payload)
            ->assertStatus(201)
            ->assertJson(['procesados' => 2]);

        $this->assertDatabaseHas('geovictoria_asistencias', [
            'identificador' => '12345678',
            'fecha' => '2026-08-24',
            'exceso_jornada' => true,
            'turno' => 'Diurno',
            'permiso' => 'Ninguno',
            'hea' => '01:00',
            'hec' => '00:30',
            'hnt' => '00:00',
        ]);
        $this->assertDatabaseHas('geovictoria_asistencias', [
            'identificador' => '87654321',
            'descanso_no_efectivo' => true,
        ]);
    }

    public function test_it_upserts_by_identificador_and_fecha(): void
    {
        $this->withHeader('Authorization', 'Bearer token-de-prueba')
            ->postJson('/api/geovictoria/asistencias', ['registros' => [$this->registro(['horas_trabajadas' => '10:00'])]])
            ->assertStatus(201);

        $this->withHeader('Authorization', 'Bearer token-de-prueba')
            ->postJson('/api/geovictoria/asistencias', ['registros' => [$this->registro(['horas_trabajadas' => '12:00'])]])
            ->assertStatus(201);

        $this->assertSame(1, GeovictoriaAsistencia::count());
        $this->assertDatabaseHas('geovictoria_asistencias', [
            'identificador' => '12345678',
            'fecha' => '2026-08-24',
            'horas_trabajadas' => '12:00',
        ]);
    }

    public function test_it_stores_hora_minima_entrada_and_accepts_payloads_without_it(): void
    {
        $payload = [
            'registros' => [
                $this->registro(['salida' => '20:00', 'hora_minima_entrada' => '2026-08-25 07:00']),
                $this->registro(['identificador' => '87654321']),
            ],
        ];

        $this->withHeader('Authorization', 'Bearer token-de-prueba')
            ->postJson('/api/geovictoria/asistencias', $payload)
            ->assertStatus(201);

        $this->assertSame('2026-08-25 07:00', GeovictoriaAsistencia::where('identificador', '12345678')->first()->hora_minima_entrada->format('Y-m-d H:i'));
        $this->assertNull(GeovictoriaAsistencia::where('identificador', '87654321')->first()->hora_minima_entrada);
    }

    public function test_it_rejects_an_invalid_hora_minima_entrada(): void
    {
        $this->withHeader('Authorization', 'Bearer token-de-prueba')
            ->postJson('/api/geovictoria/asistencias', ['registros' => [$this->registro(['hora_minima_entrada' => '07:00'])]])
            ->assertStatus(422);
    }

    public function test_it_rejects_an_invalid_payload(): void
    {
        $this->withHeader('Authorization', 'Bearer token-de-prueba')
            ->postJson('/api/geovictoria/asistencias', ['registros' => [$this->registro(['identificador' => ''])]])
            ->assertStatus(422);
    }
}
