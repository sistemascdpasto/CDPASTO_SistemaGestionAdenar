<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Services\Seguridad\IndicadoresSeguridadService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tablero de Indicadores del pilar de Seguridad: consolida KPIs, series de
 * tiempo y desgloses de Alcoholimetría, ACIS, Evaluaciones OWD, Exámenes
 * Médicos, Condiciones de Salud, Encuestas de Morbilidad y Alertas.
 */
class IndicadorController extends Controller
{
    public function index(Request $request, IndicadoresSeguridadService $service): Response
    {
        $hasta = $this->fecha($request->string('hasta')->toString()) ?? Carbon::today();
        $desde = $this->fecha($request->string('desde')->toString()) ?? $hasta->copy()->subMonths(11)->startOfMonth();

        if ($desde->gt($hasta)) {
            [$desde, $hasta] = [$hasta->copy(), $desde->copy()];
        }

        return Inertia::render('seguridad/indicador/index', [
            'data' => $service->resumen($desde, $hasta),
            'filtros' => ['desde' => $desde->toDateString(), 'hasta' => $hasta->toDateString()],
        ]);
    }

    private function fecha(string $valor): ?Carbon
    {
        if ($valor === '') {
            return null;
        }

        try {
            return Carbon::parse($valor)->startOfDay();
        } catch (\Throwable) {
            return null;
        }
    }
}
