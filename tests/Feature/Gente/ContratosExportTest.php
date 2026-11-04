<?php

namespace Tests\Feature\Gente;

use App\Exports\Gente\ContratosExport;
use App\Models\Gente\ContratoProrroga;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorDocumento;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ContratosExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_exporta_los_datos_de_contrato_y_las_fechas_de_cada_prorroga(): void
    {
        Storage::fake('public');
        Role::create(['name' => 'Gente', 'guard_name' => 'web']);
        Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('Gente');

        $colaborador = Colaborador::create([
            'cedula' => '800100200',
            'nombres' => 'Carlos',
            'apellidos' => 'Ramírez',
            'cargo' => 'Auxiliar',
            'tipo_contrato' => 'Término fijo',
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2028-03-31',
            'is_active' => true,
            'estado_registro' => 'completo',
            'wizard_step' => 4,
        ]);

        ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2026-12-31',
            'fecha_inicio' => '2027-01-01',
            'fecha_nueva' => '2027-01-31',
            'tipo' => 'prorroga',
        ]);
        ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2027-01-31',
            'fecha_inicio' => '2027-02-01',
            'fecha_nueva' => '2027-02-28',
            'tipo' => 'prorroga',
        ]);
        ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2027-02-28',
            'fecha_inicio' => '2027-03-01',
            'fecha_nueva' => '2027-03-31',
            'tipo' => 'prorroga',
        ]);
        ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2027-03-31',
            'fecha_inicio' => '2027-04-01',
            'fecha_nueva' => '2028-03-31',
            'tipo' => 'prorroga',
        ]);
        ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2028-03-31',
            'fecha_nueva' => '2028-03-31',
            'tipo' => 'finalizacion',
        ]);

        foreach ([
            ['fecha' => '2026-12-31', 'path' => 'preavisos/inicial.pdf'],
            ['fecha' => '2027-01-31', 'path' => 'preavisos/prorroga-1.pdf'],
        ] as $preaviso) {
            Storage::disk('public')->put($preaviso['path'], 'documento');
            ColaboradorDocumento::create([
                'colaborador_id' => $colaborador->id,
                'campo' => 'documento_preaviso_terminacion',
                'path' => $preaviso['path'],
                'fecha_documento' => $preaviso['fecha'],
            ]);
        }

        $response = $this->actingAs($user)
            ->get(route('gente.contratos.exportar'))
            ->assertOk()
            ->assertDownload('contratos.xlsx')
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $export = new ContratosExport(
            Colaborador::query()
                ->withExists(['prorrogas as tiene_finalizacion' => fn ($query) => $query->where('tipo', 'finalizacion')])
                ->with(['prorrogas' => fn ($query) => $query
                    ->where('tipo', 'prorroga')
                    ->reorder()
                    ->orderBy('fecha_nueva')
                    ->orderBy('id')])
                ->with(['documentos' => fn ($query) => $query
                    ->where('campo', 'documento_preaviso_terminacion')])
                ->whereKey($colaborador->id)
                ->get(),
        );

        $contenido = Excel::raw($export, \Maatwebsite\Excel\Excel::XLSX);
        $archivoTemporal = tempnam(sys_get_temp_dir(), 'contratos-export-');
        file_put_contents($archivoTemporal, $contenido);
        $hoja = IOFactory::load($archivoTemporal)->getActiveSheet();

        $this->assertSame('INICIAL', $hoja->getCell('F1')->getValue());
        $this->assertSame('PRÓRROGA 1', $hoja->getCell('I1')->getValue());
        $this->assertSame('DATOS DEL COLABORADOR', $hoja->getCell('A1')->getValue());
        $this->assertSame('CÉDULA', $hoja->getCell('A2')->getValue());
        $this->assertContains('F1:H1', $hoja->getMergeCells());
        $this->assertContains('A1:E1', $hoja->getMergeCells());
        $this->assertSame('FF0B5394', $hoja->getStyle('A1')->getFill()->getStartColor()->getARGB());
        $this->assertSame('FFEDF5FB', $hoja->getStyle('F3')->getFill()->getStartColor()->getARGB());
        $this->assertSame('FFFFF2CC', $hoja->getStyle('I1')->getFill()->getStartColor()->getARGB());
        $this->assertSame(16.0, $hoja->getColumnDimension('A')->getWidth());
        unlink($archivoTemporal);

        $this->assertSame([
            ['DATOS DEL COLABORADOR', '', '', '', '', 'INICIAL', '', '', 'PRÓRROGA 1', '', '', 'PRÓRROGA 2', '', '', 'PRÓRROGA 3', '', '', 'PRÓRROGA ANUAL 1', '', ''],
            ['CÉDULA', 'NOMBRE', 'CARGO', 'TIPO DE CONTRATO', 'ESTADO', 'CONTRATO', 'TERMINACIÓN', 'PREAVISO',
                'CONTRATO', 'TERMINACIÓN', 'PREAVISO', 'CONTRATO', 'TERMINACIÓN', 'PREAVISO',
                'CONTRATO', 'TERMINACIÓN', 'PREAVISO', 'CONTRATO', 'TERMINACIÓN', 'PREAVISO'],
        ], $export->headings());

        $this->assertSame([
            '800100200',
            'Carlos Ramírez',
            'Auxiliar',
            'Término fijo',
            'FINALIZADO',
            '01/01/2025',
            '31/12/2026',
            'SÍ',
            '01/01/2027',
            '31/01/2027',
            'SÍ',
            '01/02/2027',
            '28/02/2027',
            'NO',
            '01/03/2027',
            '31/03/2027',
            'NO',
            '01/04/2027',
            '31/03/2028',
            'NO',
        ], $export->map($export->collection()->first()));
    }

    public function test_exportacion_respeta_los_filtros_de_busqueda_y_estado(): void
    {
        Role::create(['name' => 'Gente', 'guard_name' => 'web']);
        Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('Gente');

        Colaborador::create([
            'cedula' => '800100200',
            'nombres' => 'Carlos',
            'apellidos' => 'Ramírez',
            'is_active' => true,
            'estado_registro' => 'completo',
            'wizard_step' => 4,
        ]);
        Colaborador::create([
            'cedula' => '800300400',
            'nombres' => 'Diana',
            'apellidos' => 'Ruiz',
            'is_active' => true,
            'estado_registro' => 'completo',
            'wizard_step' => 4,
        ]);

        Excel::fake();

        $this->actingAs($user)
            ->get(route('gente.contratos.exportar', ['search' => 'Carlos', 'estado' => 'activo']))
            ->assertOk();

        Excel::assertDownloaded('contratos.xlsx', fn (ContratosExport $export) => $export
            ->collection()
            ->pluck('cedula')
            ->all() === ['800100200']);
    }

    public function test_listado_incluye_cantidad_de_prorrogas_y_fecha_final_mas_reciente(): void
    {
        Role::create(['name' => 'Gente', 'guard_name' => 'web']);
        Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('Gente');

        $colaborador = Colaborador::create([
            'cedula' => '800100200',
            'nombres' => 'Carlos',
            'apellidos' => 'Ramírez',
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2025-12-31',
            'is_active' => true,
            'estado_registro' => 'completo',
            'wizard_step' => 4,
        ]);

        foreach ([
            ['fecha_anterior' => '2025-12-31', 'fecha_inicio' => '2026-01-01', 'fecha_nueva' => '2026-12-31'],
            ['fecha_anterior' => '2026-12-31', 'fecha_inicio' => '2027-01-01', 'fecha_nueva' => '2027-12-31'],
        ] as $prorroga) {
            ContratoProrroga::create([
                'colaborador_id' => $colaborador->id,
                'registrado_por' => $user->id,
                ...$prorroga,
                'tipo' => 'prorroga',
            ]);
        }

        $this->actingAs($user)
            ->get(route('gente.contratos.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('colaboradores.data.0.fecha_ingreso_empresa', '2025-01-01')
                ->where('colaboradores.data.0.ultima_fecha_prorroga', '2027-12-31')
                ->where('colaboradores.data.0.cantidad_prorrogas', 2)
            );
    }
}
