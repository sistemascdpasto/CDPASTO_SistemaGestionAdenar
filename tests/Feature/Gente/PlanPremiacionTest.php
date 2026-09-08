<?php

namespace Tests\Feature\Gente;

use App\Models\Gente\ColaboradorCalificacion;
use App\Models\Seguridad\Aci;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\EvaluacionOwd;
use App\Models\Seguridad\EvaluacionOwdPregunta;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PlanPremiacionTest extends TestCase
{
    use RefreshDatabase;

    private function genteUser(): User
    {
        $role = Role::create(['name' => 'Gente', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_plan_premiacion_calcula_porcentaje_proporcional_base_32_acis(): void
    {
        $user = $this->genteUser();

        $colab100 = Colaborador::create([
            'cedula' => '11111111',
            'nombres' => 'Juan',
            'apellidos' => 'Perez',
            'cargo' => 'Conductor',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        $colab50 = Colaborador::create([
            'cedula' => '22222222',
            'nombres' => 'Maria',
            'apellidos' => 'Gomez',
            'cargo' => 'Auxiliar',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        $colab0 = Colaborador::create([
            'cedula' => '33333333',
            'nombres' => 'Carlos',
            'apellidos' => 'Lopez',
            'cargo' => 'Mecanico',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        // 32 ACIs para colab100 (100%)
        for ($i = 1; $i <= 32; $i++) {
            Aci::create([
                'folio' => "P100-{$i}",
                'colaborador_id' => $colab100->id,
                'fecha_incidente' => '2026-09-01',
            ]);
        }

        // 16 ACIs para colab50 (50%)
        for ($i = 1; $i <= 16; $i++) {
            Aci::create([
                'folio' => "P50-{$i}",
                'colaborador_id' => $colab50->id,
                'fecha_incidente' => '2026-09-02',
            ]);
        }

        $response = $this->actingAs($user)->get(route('gente.plan-premiacion.index', [
            'mes' => 9,
            'anio' => 2026,
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('gente/plan-premiacion/index')
            ->where('resumen.meta_base', 32)
            ->where('resumen.total_colaboradores', 3)
            ->where('resumen.total_acis_mes', 48)
            ->where('resumen.cumplen_meta', 1)
            ->where('resumen.en_progreso', 1)
            ->where('resumen.sin_participacion', 1)
            ->where('resumen.promedio_porcentaje', fn ($val) => (float) $val === 50.0)
            ->where('colaboradores', function ($colabs) use ($colab100, $colab50, $colab0) {
                $c = collect($colabs)->keyBy('id');

                return $c[$colab100->id]['aci_realizadas'] === 32
                    && (float) $c[$colab100->id]['porcentaje'] === 100.0
                    && $c[$colab100->id]['cumple'] === true
                    && $c[$colab100->id]['estado'] === 'meta_alcanzada'
                    && $c[$colab50->id]['aci_realizadas'] === 16
                    && (float) $c[$colab50->id]['porcentaje'] === 50.0
                    && $c[$colab50->id]['cumple'] === false
                    && $c[$colab50->id]['estado'] === 'en_progreso'
                    && $c[$colab0->id]['aci_realizadas'] === 0
                    && (float) $c[$colab0->id]['porcentaje'] === 0.0
                    && $c[$colab0->id]['cumple'] === false
                    && $c[$colab0->id]['estado'] === 'sin_participacion';
            }));
    }

    public function test_plan_premiacion_calcula_porcentaje_owd_ruta(): void
    {
        $user = $this->genteUser();

        $colab = Colaborador::create([
            'cedula' => '44444444',
            'nombres' => 'Pedro',
            'apellidos' => 'Ramirez',
            'cargo' => 'Conductor',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        $evaluacion = EvaluacionOwd::create([
            'colaborador_id' => $colab->id,
            'fecha_evaluacion' => '2026-09-10 10:00:00',
        ]);

        // Pregunta OK (suma 100%)
        EvaluacionOwdPregunta::create([
            'evaluacion_owd_id' => $evaluacion->id,
            'actividad' => 'Ruta',
            'puntuacion' => 'OK',
        ]);

        // Pregunta No OK (suma 0%)
        EvaluacionOwdPregunta::create([
            'evaluacion_owd_id' => $evaluacion->id,
            'actividad' => 'Ruta',
            'puntuacion' => 'No OK',
        ]);

        // Pregunta Not Applicable (no suma ni disminuye)
        EvaluacionOwdPregunta::create([
            'evaluacion_owd_id' => $evaluacion->id,
            'actividad' => 'Ruta',
            'puntuacion' => 'Not Applicable',
        ]);

        $response = $this->actingAs($user)->get(route('gente.plan-premiacion.index', [
            'mes' => 9,
            'anio' => 2026,
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('gente/plan-premiacion/index')
            ->where('colaboradores', function ($colabs) use ($colab) {
                $c = collect($colabs)->keyBy('id');

                return (float) $c[$colab->id]['porcentaje_owd_ruta'] === 0.0
                    && $c[$colab->id]['porcentaje_owd_ruta_label'] === '0%';
            }));
    }

    public function test_plan_premiacion_calcula_promedio_calificaciones_modulos(): void
    {
        $user = $this->genteUser();

        $colab = Colaborador::create([
            'cedula' => '123456',
            'nombres' => 'Juan',
            'apellidos' => 'Perez',
            'cargo' => 'Conductor',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        // Notas: 90, 100, 80, 100 -> Promedio = 92.5%
        foreach ([90, 100, 80, 100] as $idx => $nota) {
            ColaboradorCalificacion::create([
                'identificacion' => '123456',
                'colaborador' => 'Juan Perez',
                'modulo' => "Modulo {$idx}",
                'nota_modulo' => $nota,
            ]);
        }

        $response = $this->actingAs($user)->get(route('gente.plan-premiacion.index', [
            'mes' => 9,
            'anio' => 2026,
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('gente/plan-premiacion/index')
            ->where('colaboradores', function ($colabs) use ($colab) {
                $c = collect($colabs)->keyBy('id');

                return (float) $c[$colab->id]['promedio_calificaciones'] === 92.5
                    && $c[$colab->id]['promedio_calificaciones_label'] === '92.5%';
            }));
    }

    public function test_plan_premiacion_calcula_porcentaje_dpo_academy(): void
    {
        $user = $this->genteUser();

        $colabEnDpo = Colaborador::create([
            'cedula' => '555555',
            'nombres' => 'Sponge',
            'apellidos' => 'Bob',
            'cargo' => 'Cocinero',
            'area' => 'Operativa',
            'codigo_qr_skap' => 'S0KGTNLE',
            'is_active' => true,
        ]);

        $colabFueraDpo = Colaborador::create([
            'cedula' => '666666',
            'nombres' => 'Patrick',
            'apellidos' => 'Star',
            'cargo' => 'Auxiliar',
            'area' => 'Operativa',
            'codigo_qr_skap' => 'PATRICK123',
            'is_active' => true,
        ]);

        // Registrar $colabEnDpo en dpo_academy usando su QR Safety
        \App\Models\Gente\DpoAcademy::create([
            'colaborador_id' => $colabEnDpo->id,
            'qr_safety' => 'S0KGTNLE',
            'nombre' => 'Sponge Bob',
        ]);

        $response = $this->actingAs($user)->get(route('gente.plan-premiacion.index', [
            'mes' => 9,
            'anio' => 2026,
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('gente/plan-premiacion/index')
            ->where('colaboradores', function ($colabs) use ($colabEnDpo, $colabFueraDpo) {
                $c = collect($colabs)->keyBy('id');

                return (float) $c[$colabEnDpo->id]['porcentaje_dpo'] === 0.0
                    && $c[$colabEnDpo->id]['porcentaje_dpo_label'] === '0%'
                    && (float) $c[$colabFueraDpo->id]['porcentaje_dpo'] === 100.0
                    && $c[$colabFueraDpo->id]['porcentaje_dpo_label'] === '100%';
            }));
    }

    public function test_plan_premiacion_calcula_porcentaje_ausentismo(): void
    {
        $user = $this->genteUser();

        $colab = Colaborador::create([
            'cedula' => '777777',
            'nombres' => 'Sandy',
            'apellidos' => 'Cheeks',
            'cargo' => 'Ingeniera',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        // Día 1: Entro '07:00' -> 100%
        \App\Models\Gente\Ausentismo::create([
            'colaborador_id' => $colab->id,
            'identificador' => '777777',
            'fecha' => '2026-09-01',
            'entro_1' => '07:00',
            'turno' => 'Mañana',
        ]);

        // Día 2: Entro nulo, Turno 'Descanso' -> 100%
        \App\Models\Gente\Ausentismo::create([
            'colaborador_id' => $colab->id,
            'identificador' => '777777',
            'fecha' => '2026-09-02',
            'entro_1' => null,
            'turno' => 'Descanso',
        ]);

        // Día 3: Entro nulo, Turno 'Horario Libre' -> 100%
        \App\Models\Gente\Ausentismo::create([
            'colaborador_id' => $colab->id,
            'identificador' => '777777',
            'fecha' => '2026-09-03',
            'entro_1' => null,
            'turno' => 'Horario Libre',
        ]);

        // Día 4: Entro nulo, Turno 'No Planificado' -> 100%
        \App\Models\Gente\Ausentismo::create([
            'colaborador_id' => $colab->id,
            'identificador' => '777777',
            'fecha' => '2026-09-04',
            'entro_1' => null,
            'turno' => 'No Planificado',
        ]);

        // Día 5: Entro nulo, Turno 'Mañana' -> 0% (Falta sin justificar)
        \App\Models\Gente\Ausentismo::create([
            'colaborador_id' => $colab->id,
            'identificador' => '777777',
            'fecha' => '2026-09-05',
            'entro_1' => null,
            'turno' => 'Mañana',
        ]);

        // Promedio de 5 días: (100 + 100 + 100 + 100 + 0) / 5 = 80%

        $response = $this->actingAs($user)->get(route('gente.plan-premiacion.index', [
            'mes' => 9,
            'anio' => 2026,
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('gente/plan-premiacion/index')
            ->where('colaboradores', function ($colabs) use ($colab) {
                $c = collect($colabs)->keyBy('id');

                return (float) $c[$colab->id]['porcentaje_ausentismo'] === 80.0
                    && $c[$colab->id]['porcentaje_ausentismo_label'] === '80%';
            }));
    }

    public function test_plan_premiacion_calcula_porcentaje_malas_marcaciones(): void
    {
        $user = $this->genteUser();

        $colabEnMalas = Colaborador::create([
            'cedula' => '99887766',
            'nombres' => 'Juan',
            'apellidos' => 'Valdez',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        $colabLimpio = Colaborador::create([
            'cedula' => '11223344',
            'nombres' => 'Luisa',
            'apellidos' => 'Lane',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        // Registrar $colabEnMalas en correcciones_marcaciones
        \App\Models\Gente\CorreccionMarcacion::create([
            'identificacion' => '99887766',
            'fecha' => '2026-09-02',
            'nombre_completo' => 'Juan Valdez',
        ]);

        $response = $this->actingAs($user)->get(route('gente.plan-premiacion.index', [
            'mes' => 9,
            'anio' => 2026,
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('gente/plan-premiacion/index')
            ->where('colaboradores', function ($colabs) use ($colabEnMalas, $colabLimpio) {
                $c = collect($colabs)->keyBy('id');

                return (float) $c[$colabEnMalas->id]['porcentaje_malas_marcaciones'] === 0.0
                    && $c[$colabEnMalas->id]['porcentaje_malas_marcaciones_label'] === '0%'
                    && (float) $c[$colabLimpio->id]['porcentaje_malas_marcaciones'] === 100.0
                    && $c[$colabLimpio->id]['porcentaje_malas_marcaciones_label'] === '100%';
            }));
    }

    public function test_plan_premiacion_calcula_porcentaje_rechazos(): void
    {
        $user = $this->genteUser();

        $colabConRechazos = Colaborador::create([
            'cedula' => '55443322',
            'nombres' => 'Mario',
            'apellidos' => 'Bros',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        $colabSinRechazos = Colaborador::create([
            'cedula' => '99001122',
            'nombres' => 'Luigi',
            'apellidos' => 'Bros',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        // Registrar registros en eventos_tripulacion con rechazos 3.5 y 4.5 -> Promedio 4.0%
        \App\Models\Reparto\EventosTripulacion::create([
            'fecha' => '2026-09-05',
            'placa' => 'ABC123',
            'documento' => '55443322',
            'nombre' => 'Mario Bros',
            'rechazos' => 3.5,
        ]);

        \App\Models\Reparto\EventosTripulacion::create([
            'fecha' => '2026-09-10',
            'placa' => 'ABC123',
            'documento' => '55443322',
            'nombre' => 'Mario Bros',
            'rechazos' => 4.5,
        ]);

        $response = $this->actingAs($user)->get(route('gente.plan-premiacion.index', [
            'mes' => 9,
            'anio' => 2026,
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('gente/plan-premiacion/index')
            ->where('colaboradores', function ($colabs) use ($colabConRechazos, $colabSinRechazos) {
                $c = collect($colabs)->keyBy('id');

                return (float) $c[$colabConRechazos->id]['porcentaje_rechazos'] === 4.0
                    && $c[$colabConRechazos->id]['porcentaje_rechazos_label'] === '4%'
                    && $c[$colabSinRechazos->id]['porcentaje_rechazos'] === null
                    && $c[$colabSinRechazos->id]['porcentaje_rechazos_label'] === 'N/A';
            }));
    }

    public function test_plan_premiacion_calcula_metricas_eventos_tripulacion(): void
    {
        $user = $this->genteUser();

        $colab = Colaborador::create([
            'cedula' => '66778899',
            'nombres' => 'Yoshi',
            'apellidos' => 'Dino',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        \App\Models\Reparto\EventosTripulacion::create([
            'fecha' => '2026-09-12',
            'placa' => 'XYZ987',
            'documento' => '66778899',
            'nombre' => 'Yoshi Dino',
            'adherencia_tiempo' => 92.5,
            'rmd' => '4.2',
            'adherencia_checklist_pre' => 88.0,
            'adherencia_checklist_post' => 96.0,
        ]);

        $response = $this->actingAs($user)->get(route('gente.plan-premiacion.index', [
            'mes' => 9,
            'anio' => 2026,
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('gente/plan-premiacion/index')
            ->where('colaboradores', function ($colabs) use ($colab) {
                $c = collect($colabs)->keyBy('id');

                return (float) $c[$colab->id]['porcentaje_adherencia_tiempo'] === 92.5
                    && $c[$colab->id]['porcentaje_adherencia_tiempo_label'] === '92.5%'
                    && (float) $c[$colab->id]['promedio_rmd'] === 4.2
                    && $c[$colab->id]['promedio_rmd_label'] === '4.2'
                    && (float) $c[$colab->id]['porcentaje_checklist_pre'] === 88.0
                    && $c[$colab->id]['porcentaje_checklist_pre_label'] === '88%'
                    && (float) $c[$colab->id]['porcentaje_checklist_post'] === 96.0
                    && $c[$colab->id]['porcentaje_checklist_post_label'] === '96%';
            }));
    }

    public function test_plan_premiacion_calcula_resultado_promedio_aci_ows_calificaciones(): void
    {
        $user = $this->genteUser();

        $colab = Colaborador::create([
            'cedula' => '99887766',
            'nombres' => 'Mario',
            'apellidos' => 'Bros',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        // 1. Calificaciones de Módulos (100%)
        ColaboradorCalificacion::create([
            'identificacion' => '99887766',
            'modulo' => 'Modulo 1',
            'nota_modulo' => 100.0,
        ]);

        // 2. Evaluaciones OWD Ruta (80% -> 4 OK de 5)
        $eval = \App\Models\Seguridad\EvaluacionOwd::create([
            'colaborador_id' => $colab->id,
            'fecha_evaluacion' => '2026-09-01',
        ]);
        for ($i = 0; $i < 4; $i++) {
            EvaluacionOwdPregunta::create([
                'evaluacion_owd_id' => $eval->id,
                'actividad' => 'Ruta',
                'puntuacion' => 'OK',
            ]);
        }
        EvaluacionOwdPregunta::create([
            'evaluacion_owd_id' => $eval->id,
            'actividad' => 'Ruta',
            'puntuacion' => 'NO OK',
        ]);

        // 3. ACI Realizadas: 28.8 ACIs para dar exactamente 90% (28.8 / 32 * 100 = 90%) -> 28.8 es (28.8) o p.ej. 28.8 ACIs
        // Con 28.8 ACIs en 32: 28.8 / 32 * 100 = 90%
        // O 28 ACIs: 28/32 = 87.5%
        // Si 28.8 -> pongamos 28.8 ACI records or 28 ACIs
        // ACI: 90% (28.8 -> 28.8) -> let's create 28 ACIs + count logic
        // If 28 ACIs -> 28/32 = 87.5%
        // Average: (87.5 + 80 + 100) / 3 = 89.2%
        // Let's create 28 ACIs:
        for ($i = 0; $i < 28; $i++) {
            Aci::create([
                'folio' => 'FOL-' . $i,
                'colaborador_id' => $colab->id,
                'fecha_incidente' => '2026-09-02',
            ]);
        }

        $response = $this->actingAs($user)->get(route('gente.plan-premiacion.index', [
            'mes' => 9,
            'anio' => 2026,
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('gente/plan-premiacion/index')
            ->where('colaboradores', function ($colabs) use ($colab) {
                $c = collect($colabs)->keyBy('id');
                $item = $c[$colab->id];

                // ACI: 28/32 * 100 = 87.5% -> 87.5% * 10% = 8.75%
                // OWD: Tiene 1 NO OK -> 0.0% -> 0.0% * 15% = 0.0%
                // Calificaciones: 100.0% -> 100.0% * 10% = 10.0%
                // Resultado Seguridad: 8.75 + 0.0 + 10.0 = 18.75 -> 18.8%
                return (float) $item['resultado'] === 18.8
                    && $item['resultado_label'] === '18.8%'
                    && (float) $item['resultado_asistencia'] === 10.0
                    && $item['resultado_asistencia_label'] === '10%';
            })
        );
    }

    public function test_plan_premiacion_exportar_csv(): void
    {
        $user = $this->genteUser();

        Colaborador::create([
            'cedula' => '11111111',
            'nombres' => 'Juan',
            'apellidos' => 'Perez',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        $response = $this->actingAs($user)->get(route('gente.plan-premiacion.exportar', [
            'mes' => 9,
            'anio' => 2026,
        ]));

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('plan_premiacion_2026_9.csv', $response->headers->get('content-disposition'));
    }

    public function test_plan_premiacion_filtra_por_cargo(): void
    {
        $user = $this->genteUser();

        Colaborador::create([
            'cedula' => '10000001',
            'nombres' => 'Carlos',
            'apellidos' => 'Chofer',
            'cargo' => 'Conductor',
            'area' => 'Operativa',
            'is_active' => true,
        ]);

        Colaborador::create([
            'cedula' => '10000002',
            'nombres' => 'Ana',
            'apellidos' => 'Auxiliar',
            'cargo' => 'Auxiliar de Reparto',
            'is_active' => true,
        ]);

        $response = $this->actingAs($user)->get(route('gente.plan-premiacion.index', [
            'cargo' => 'Conductor',
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('gente/plan-premiacion/index')
            ->has('colaboradores', 1)
            ->where('colaboradores.0.cargo', 'Conductor')
        );
    }
}
