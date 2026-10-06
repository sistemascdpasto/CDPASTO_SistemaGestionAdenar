<?php

namespace Tests\Feature\Gente;

use App\Models\Gente\Sac;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SacTest extends TestCase
{
    use RefreshDatabase;

    private function genteUser(): User
    {
        $role = Role::create(['name' => 'Gente', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_sac_index_requires_authentication(): void
    {
        $response = $this->get(route('gente.sac.index'));
        $response->assertRedirect('/login');
    }

    public function test_sac_index_returns_inertia_response_for_gente_role(): void
    {
        $user = $this->genteUser();

        $response = $this->actingAs($user)->get(route('gente.sac.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('gente/sac/index')
            ->has('registros')
            ->has('kpis')
            ->has('options')
            ->has('filters')
        );
    }

    public function test_sac_importar_excel_and_matches_colaborador(): void
    {
        $user = $this->genteUser();

        $colaborador = Colaborador::create([
            'cedula'    => '1098765432',
            'nombres'   => 'Carlos Alberto',
            'apellidos' => 'Rodríguez',
            'cargo'     => 'Conductor',
            'area'      => 'Reparto',
            'is_active' => true,
        ]);

        // Crear Excel en memoria
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        $headers = [
            'AÑO', 'NUMERO DE CASO ESTANDAR', 'NOMBRE DE LA CUENTA', 'NOMBRE DEL CONTACTO',
            'FECHA', 'DESCRIPCIÓN', 'FECHA RESUELTO', 'COMENTARIO', 'APLICA', 'MES',
            'SUBCATEGORIA', 'MOTIVO QUEJA', 'PLACA', 'RESPONSABLE', 'DOCUMENTO DE TRANSPORTE',
            'PLAN DE ACCION', 'TIEMPO DE CIERRE CASO', '% SI/NO', 'CUMPLIMIENTO CIERRE', 'YTD', 'hora'
        ];

        foreach ($headers as $colIdx => $h) {
            $sheet->setCellValueByColumnAndRow($colIdx + 1, 1, $h);
        }

        $row1 = [
            '2026', 'CASO-001', 'Empresa Test', 'Contacto Test',
            '2026-09-01', 'Descripción caso 1', '2026-09-02', 'OK', 'SI', 'Septiembre',
            'Despacho', 'Retraso', 'XYZ123', 'Carlos Alberto Rodríguez', 'DOC-001',
            'Plan 1', '24', '100%', 'A TIEMPO', 'SI', '10:00'
        ];

        foreach ($row1 as $colIdx => $val) {
            $sheet->setCellValueByColumnAndRow($colIdx + 1, 2, $val);
        }

        $tempPath = tempnam(sys_get_temp_dir(), 'sac_test_') . '.xlsx';
        $writer = new Xlsx($spreadsheet);
        $writer->save($tempPath);

        $uploadedFile = new UploadedFile(
            $tempPath,
            'sac_test.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );

        $response = $this->actingAs($user)->post(route('gente.sac.importar'), [
            'archivo' => $uploadedFile,
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('sac', [
            'numero_caso_estandar' => 'CASO-001',
            'nombre_cuenta'        => 'Empresa Test',
            'responsable'          => 'Carlos Alberto Rodríguez',
            'colaborador_id'       => $colaborador->id,
        ]);

        if (file_exists($tempPath)) {
            @unlink($tempPath);
        }
    }

    public function test_sac_import_does_not_fail_with_ambiguous_headers_or_long_values(): void
    {
        $user = $this->genteUser();

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->fromArray([
            // «CASO» (texto largo de respuesta) aparece DESPUÉS del número de caso: no debe pisarlo.
            ['AÑO', 'NUMERO DE CASO ESTANDAR', 'CASO', 'PLACA'],
            ['2026', 'CASO-777', str_repeat('Para nosotros lo más importante es tu tranquilidad. ', 10), 'ABC123'],
            ['2026', null, null, str_repeat('X', 300)],
        ]);

        $tempPath = tempnam(sys_get_temp_dir(), 'sac_test_').'.xlsx';
        (new Xlsx($spreadsheet))->save($tempPath);

        $this->actingAs($user)->post(route('gente.sac.importar'), [
            'archivo' => new UploadedFile($tempPath, 'sac.xlsx', null, null, true),
        ])->assertSessionHas('success');

        $this->assertDatabaseHas('sac', ['numero_caso_estandar' => 'CASO-777', 'placa' => 'ABC123']);
        $this->assertSame(255, mb_strlen(Sac::whereNull('numero_caso_estandar')->value('placa')));

        @unlink($tempPath);
    }

    public function test_sac_plantilla_download(): void
    {
        $user = $this->genteUser();

        $response = $this->actingAs($user)->get(route('gente.sac.plantilla'));

        $response->assertOk();
        $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }

    public function test_sac_exportar_csv(): void
    {
        $user = $this->genteUser();

        Sac::create([
            'anio'                 => '2026',
            'numero_caso_estandar' => 'CASO-TEST-CSV',
            'nombre_cuenta'        => 'Cliente CSV',
            'responsable'          => 'Prueba',
        ]);

        $response = $this->actingAs($user)->get(route('gente.sac.exportar'));

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    public function test_sac_limpiar_deletes_all_records(): void
    {
        $user = $this->genteUser();

        Sac::create([
            'numero_caso_estandar' => 'CASO-BORRAR',
        ]);

        $this->assertEquals(1, Sac::count());

        $response = $this->actingAs($user)->post(route('gente.sac.limpiar'));

        $response->assertRedirect();
        $this->assertEquals(0, Sac::count());
    }
}
