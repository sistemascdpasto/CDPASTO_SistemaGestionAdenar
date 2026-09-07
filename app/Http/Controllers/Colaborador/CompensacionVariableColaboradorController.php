<?php

namespace App\Http\Controllers\Colaborador;

use App\Http\Controllers\Controller;
use App\Models\Reparto\CompensacionVariable;
use App\Models\Seguridad\Colaborador;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class CompensacionVariableColaboradorController extends Controller
{
    private const MESES_ES = [
        1 => 'Enero', 2 => 'Febrero', 3 => 'Marzo', 4 => 'Abril',
        5 => 'Mayo', 6 => 'Junio', 7 => 'Julio', 8 => 'Agosto',
        9 => 'Septiembre', 10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre',
    ];

    public function index(Request $request): Response
    {
        $user        = Auth::user();
        $colaborador = Colaborador::where('user_id', $user->id)->first();

        if (!$colaborador) {
            return Inertia::render('colaborador/mis-compensacion-variable/index', [
                'colaborador' => null,
                'registros'   => [],
                'resumen'     => null,
                'error'       => 'No se encontró información del colaborador.',
            ]);
        }

        $anio = (int) $request->input('anio', date('Y'));

        // Todos los registros del colaborador para el año seleccionado
        $registrosRaw = CompensacionVariable::where('identificador', $colaborador->cedula)
            ->where('anio', $anio)
            ->orderByRaw("FIELD(mes, 'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre')")
            ->get([
                'id', 'anio', 'mes', 'mes2', 'regional', 'cd',
                'ausencia_justificada', 'ausencia_injustificada',
                'tri_fatalidades', 'adherencia_gp', 'market_refusals',
                'porcentaje_rechazos', 'habilitadores', 'variable',
                'dias_trabajados', 'salario_variable', 'pago_variable_dt', 'total_pago',
            ]);

        $mesActual = (int) date('n');

        $registros = $registrosRaw->map(function ($r) use ($mesActual) {
            $mesNum = array_search($r->mes, self::MESES_ES) ?: 0;
            return [
                'id'                    => $r->id,
                'anio'                  => $r->anio,
                'mes'                   => $r->mes ?? '—',
                'mes_num'               => $mesNum,
                'mes2'                  => $r->mes2,
                'regional'              => $r->regional,
                'cd'                    => $r->cd,
                'ausencia_justificada'  => (float) ($r->ausencia_justificada ?? 0),
                'ausencia_injustificada'=> (float) ($r->ausencia_injustificada ?? 0),
                'tri_fatalidades'       => (float) ($r->tri_fatalidades ?? 0),
                'adherencia_gp'         => $r->adherencia_gp,
                'market_refusals'       => $r->market_refusals,
                'porcentaje_rechazos'   => (float) ($r->porcentaje_rechazos ?? 0),
                'habilitadores'         => (float) ($r->habilitadores ?? 1),
                'variable'              => $r->variable,
                'dias_trabajados'       => (float) ($r->dias_trabajados ?? 0),
                'salario_variable'      => (float) ($r->salario_variable ?? 0),
                'pago_variable_dt'      => (float) ($r->pago_variable_dt ?? 0),
                'total_pago'            => (float) ($r->total_pago ?? 0),
                'es_futuro'             => $mesNum > $mesActual,
            ];
        })->values()->toArray();

        // Resumen acumulado del año
        $totalGanado  = collect($registros)->sum('pago_variable_dt');
        $totalSalario = collect($registros)->sum('salario_variable');
        $mesesConDatos = collect($registros)->where('es_futuro', false)->count();
        $promRechazos  = $mesesConDatos > 0
            ? round(collect($registros)->where('es_futuro', false)->avg('porcentaje_rechazos'), 2)
            : 0;
        $mejorMes = collect($registros)->where('es_futuro', false)->sortByDesc('pago_variable_dt')->first();
        $peorMes  = collect($registros)->where('es_futuro', false)->where('pago_variable_dt', '>', 0)->sortBy('pago_variable_dt')->first();

        $resumen = [
            'total_pago_variable'  => round($totalGanado, 2),
            'total_salario'        => round($totalSalario, 2),
            'meses_con_datos'      => $mesesConDatos,
            'promedio_rechazos'    => $promRechazos,
            'mejor_mes'            => $mejorMes ? ['mes' => $mejorMes['mes'], 'valor' => $mejorMes['pago_variable_dt']] : null,
            'peor_mes'             => $peorMes  ? ['mes' => $peorMes['mes'],  'valor' => $peorMes['pago_variable_dt']]  : null,
        ];

        // Años disponibles para el selector
        $aniosDisponibles = CompensacionVariable::where('identificador', $colaborador->cedula)
            ->distinct()->whereNotNull('anio')->pluck('anio')->sortDesc()->values()->all();

        return Inertia::render('colaborador/mis-compensacion-variable/index', [
            'colaborador' => [
                'cedula'          => $colaborador->cedula,
                'nombre_completo' => trim($colaborador->nombres . ' ' . $colaborador->apellidos),
                'cargo'           => $colaborador->cargo,
            ],
            'registros'         => $registros,
            'resumen'           => $resumen,
            'anio_seleccionado' => $anio,
            'anios_disponibles' => $aniosDisponibles,
            'error'             => null,
        ]);
    }
}
