<?php

namespace Tests\Feature\Gente;

use App\Http\Controllers\Gente\ContratosController;
use App\Models\Gente\ColaboradorContrato;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorCargo;
use Barryvdh\DomPDF\PDF as DomPdf;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Response;
use Tests\TestCase;

class ContratosCertificadoFechaTest extends TestCase
{
    use RefreshDatabase;

    private array $viewData = [];

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_los_certificados_muestran_la_fecha_de_descarga_sin_modificar_fechas_guardadas(): void
    {
        Carbon::setTestNow('2027-01-15 10:30:00');
        $colaborador = $this->crearColaboradorConContrato('2027-12-31');
        $cargo = ColaboradorCargo::create([
            'colaborador_id' => $colaborador->id,
            'cargo' => 'Conductor',
            'area' => 'Reparto',
            'perfil' => 'Conducir el vehículo asignado.',
            'fecha_inicio' => '2025-01-01',
            'fecha_fin' => '2027-12-31',
            'estado' => 'ACTIVO',
        ]);
        $this->prepararPdfMock();

        $controller = app(ContratosController::class);
        $controller->exportarCertificadoLaboralPdf($colaborador);
        $controller->exportarCertificadoLaboralConFuncionesPdf($colaborador);

        $fechaDescarga = '15 de enero de 2027';
        $this->assertSame($fechaDescarga, $this->viewData['gente.certificado-laboral-pdf']['fechaFin']);
        $this->assertSame($fechaDescarga, $this->viewData['gente.certificado-laboral-con-funciones-pdf']['fechaFin']);
        $this->assertSame(
            $fechaDescarga,
            $this->viewData['gente.certificado-laboral-con-funciones-pdf']['cargos']->first()['fecha_fin'],
        );
        $this->assertSame('2027-12-31', $colaborador->contratos()->first()->fresh()->fecha_fin->toDateString());
        $this->assertSame('2027-12-31', $cargo->fresh()->fecha_fin->toDateString());
    }

    public function test_los_certificados_conservan_la_fecha_final_contractual_que_ya_paso(): void
    {
        Carbon::setTestNow('2027-01-15 10:30:00');
        $colaborador = $this->crearColaboradorConContrato('2027-01-10');
        $this->prepararPdfMock();

        $controller = app(ContratosController::class);
        $controller->exportarCertificadoLaboralPdf($colaborador);
        $controller->exportarCertificadoLaboralConFuncionesPdf($colaborador);

        $fechaFinalContractual = '10 de enero de 2027';
        $this->assertSame($fechaFinalContractual, $this->viewData['gente.certificado-laboral-pdf']['fechaFin']);
        $this->assertSame(
            $fechaFinalContractual,
            $this->viewData['gente.certificado-laboral-con-funciones-pdf']['fechaFin'],
        );
    }

    private function crearColaboradorConContrato(string $fechaFin): Colaborador
    {
        $colaborador = Colaborador::create([
            'cedula' => '800100200',
            'nombres' => 'Carlos',
            'apellidos' => 'Ramírez',
            'cargo' => 'Auxiliar',
            'tipo_contrato' => 'Término fijo',
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => $fechaFin,
            'is_active' => true,
            'estado_registro' => 'completo',
            'wizard_step' => 4,
        ]);

        ColaboradorContrato::create([
            'colaborador_id' => $colaborador->id,
            'tipo_contrato' => 'Término fijo',
            'fecha_inicio' => '2025-01-01',
            'fecha_fin' => $fechaFin,
        ]);

        return $colaborador;
    }

    private function prepararPdfMock(): void
    {
        $pdf = \Mockery::mock(DomPdf::class);
        $pdf->shouldReceive('setPaper')
            ->twice()
            ->with('a4', 'portrait')
            ->andReturnSelf();
        $pdf->shouldReceive('download')
            ->twice()
            ->andReturnUsing(fn (string $filename): Response => new Response($filename));

        Pdf::shouldReceive('loadView')
            ->twice()
            ->withArgs(function (string $view, array $data): bool {
                $this->viewData[$view] = $data;

                return true;
            })
            ->andReturn($pdf);
    }
}
