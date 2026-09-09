<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Models\Reparto\CompensacionVariableDiaria;
use App\Models\Seguridad\Colaborador;
use App\Services\Reparto\CompensacionVariableDiariaImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CompensacionVariableDiariaController extends Controller
{
    private function filterMultiSelect($query, string $column, $input, bool $like = false): void
    {
        if (empty($input)) return;
        $values = is_array($input) ? $input : explode(',', (string)$input);
        $values = array_values(array_filter(array_map('trim', $values), fn($v) => $v !== ''));
        if (empty($values)) return;
        if ($like) {
            $query->where(function ($q) use ($column, $values) {
                foreach ($values as $v) $q->orWhere($column, 'like', '%' . $v . '%');
            });
        } else {
            $query->whereIn($column, $values);
        }
    }

    private function applyFilters($query, Request $request): void
    {
        if ($request->filled('fecha_desde')) {
            $query->where('fecha', '>=', $request->input('fecha_desde'));
        }
        if ($request->filled('fecha_hasta')) {
            $query->where('fecha', '<=', $request->input('fecha_hasta'));
        }
        if ($request->filled('anio')) {
            $query->where('anio', (int)$request->input('anio'));
        }
        if ($request->has('mes')) {
            $this->filterMultiSelect($query, 'mes', $request->input('mes'), true);
        }
        if ($request->has('cedula')) {
            $this->filterMultiSelect($query, 'cedula', $request->input('cedula'), true);
        }
        if ($request->has('nombre_completo')) {
            $this->filterMultiSelect($query, 'nombre_completo', $request->input('nombre_completo'), true);
        }
        if ($request->has('cargo')) {
            $this->filterMultiSelect($query, 'cargo', $request->input('cargo'));
        }
        if ($request->has('placa')) {
            $this->filterMultiSelect($query, 'placa', $request->input('placa'), true);
        }
        if ($request->has('transporte')) {
            $this->filterMultiSelect($query, 'transporte', $request->input('transporte'));
        }
        if ($request->has('rr')) {
            $this->filterMultiSelect($query, 'rr', $request->input('rr'));
        }
    }

    private function calcularTotalesPorDia($query): array
    {
        $records = (clone $query)->whereNotNull('fecha')->get(['fecha', 'rechazos', 'valor_x_dia', 'valor_var', 'valor_perdido']);
        $dias = [];
        $rechazos = [];
        $valorDia = [];
        $valorVar = [];
        $valorPerdido = [];

        $grouped = [];
        foreach ($records as $r) {
            $key = $r->fecha instanceof \DateTimeInterface ? $r->fecha->format('Y-m-d') : (string)$r->fecha;
            if (!isset($grouped[$key])) {
                $grouped[$key] = ['rechazos' => 0, 'valor_x_dia' => 0, 'valor_var' => 0, 'valor_perdido' => 0];
            }
            $grouped[$key]['rechazos'] += (float)($r->rechazos ?? 0);
            $grouped[$key]['valor_x_dia'] += (float)($r->valor_x_dia ?? 0);
            $grouped[$key]['valor_var'] += (float)($r->valor_var ?? 0);
            $grouped[$key]['valor_perdido'] += (float)($r->valor_perdido ?? 0);
        }

        ksort($grouped);
        foreach ($grouped as $fecha => $vals) {
            $dias[] = $fecha;
            $rechazos[] = round($vals['rechazos'], 2);
            $valorDia[] = round($vals['valor_x_dia'], 2);
            $valorVar[] = round($vals['valor_var'], 2);
            $valorPerdido[] = round($vals['valor_perdido'], 2);
        }

        return [
            'fechas' => $dias,
            'rechazos' => $rechazos,
            'valor_x_dia' => $valorDia,
            'valor_var' => $valorVar,
            'valor_perdido' => $valorPerdido,
        ];
    }

    private function calcularTotalesMensuales($query): array
    {
        $records = (clone $query)->whereNotNull('fecha')->get(['fecha', 'rechazos', 'valor_x_dia', 'valor_var', 'valor_perdido', 'meta_1', 'meta_2']);
        $monthMap = [
            'enero' => 0, 'febrero' => 1, 'marzo' => 2, 'abril' => 3, 'mayo' => 4, 'junio' => 5,
            'julio' => 6, 'agosto' => 7, 'septiembre' => 8, 'octubre' => 9, 'noviembre' => 10, 'diciembre' => 11,
            'ene' => 0, 'feb' => 1, 'mar' => 2, 'abr' => 3, 'may' => 4, 'jun' => 5,
            'jul' => 6, 'ago' => 7, 'sep' => 8, 'set' => 8, 'setiembre' => 8, 'oct' => 9, 'nov' => 10, 'dic' => 11,
            '1' => 0, '2' => 1, '3' => 2, '4' => 3, '5' => 4, '6' => 5,
            '7' => 6, '8' => 7, '9' => 8, '10' => 9, '11' => 10, '12' => 11,
            '01' => 0, '02' => 1, '03' => 2, '04' => 3, '05' => 4, '06' => 5,
            '07' => 6, '08' => 7, '09' => 8,
        ];

        $totales = array_fill(0, 12, ['rechazos' => 0, 'valor_var' => 0, 'valor_perdido' => 0, 'meta_1' => 0, 'meta_2' => 0]);
        $monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        foreach ($records as $r) {
            $idx = null;
            if ($r->fecha instanceof \DateTimeInterface) {
                $idx = (int)$r->fecha->format('n') - 1;
            } elseif ($r->mes) {
                $mStr = mb_strtolower(trim((string)$r->mes), 'UTF-8');
                $idx = $monthMap[$mStr] ?? null;
                if ($idx === null) {
                    foreach ($monthMap as $key => $i) {
                        if (str_contains($mStr, $key)) { $idx = $i; break; }
                    }
                }
            }
            if ($idx !== null && $idx >= 0 && $idx < 12) {
                $totales[$idx]['rechazos'] += (float)($r->rechazos ?? 0);
                $totales[$idx]['valor_var'] += (float)($r->valor_var ?? 0);
                $totales[$idx]['valor_perdido'] += (float)($r->valor_perdido ?? 0);
                $totales[$idx]['meta_1'] += (float)($r->meta_1 ?? 0);
                $totales[$idx]['meta_2'] += (float)($r->meta_2 ?? 0);
            }
        }

        return [
            'meses' => $monthNames,
            'rechazos' => array_map(fn($t) => round($t['rechazos'], 2), $totales),
            'valor_var' => array_map(fn($t) => round($t['valor_var'], 2), $totales),
            'valor_perdido' => array_map(fn($t) => round($t['valor_perdido'], 2), $totales),
            'meta_1' => array_map(fn($t) => round($t['meta_1'], 2), $totales),
            'meta_2' => array_map(fn($t) => round($t['meta_2'], 2), $totales),
        ];
    }

    public function index(Request $request): Response
    {
        // Si no hay filtros de fecha/mes/anio, aplicar mes actual como defecto
        $sinFiltroTemporal = !$request->filled('fecha_desde')
            && !$request->filled('fecha_hasta')
            && !$request->filled('anio')
            && !$request->has('mes');

        if ($sinFiltroTemporal) {
            // Nombres de meses en español como los guarda el sistema
            $mesesEs = [
                1 => 'Enero',    2 => 'Febrero',   3 => 'Marzo',
                4 => 'Abril',    5 => 'Mayo',       6 => 'Junio',
                7 => 'Julio',    8 => 'Agosto',     9 => 'Septiembre',
                10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre',
            ];
            $request->merge([
                'anio' => (int) now()->format('Y'),
                'mes'  => $mesesEs[(int) now()->format('n')],
            ]);
        }

        $query = CompensacionVariableDiaria::query();
        $this->applyFilters($query, $request);
        
        // Verificar si hay datos antes de hacer cálculos pesados
        $totalRegistros = (clone $query)->count();
        $hayDatos = $totalRegistros > 0;
        
        $data = (clone $query)->orderBy('fecha', 'desc')->orderBy('nombre_completo', 'asc')->paginate(25)->withQueryString();

        $baseQuery = clone $query;
        
        // Calcular indicadores solo si hay datos
        $indicadores = $hayDatos ? [
            'total_registros' => $totalRegistros,
            'total_rechazos' => round((float)(clone $baseQuery)->sum('rechazos'), 2),
            'total_cal_rechazos' => round((float)(clone $baseQuery)->sum('cal_rechazos'), 2),
            'total_cal_rechazos_2' => round((float)(clone $baseQuery)->sum('cal_rechazos_2'), 2),
            'total_valor_x_dia' => round((float)(clone $baseQuery)->sum('valor_x_dia'), 2),
            'total_valor_var' => round((float)(clone $baseQuery)->sum('valor_var'), 2),
            'total_valor_perdido' => round((float)(clone $baseQuery)->sum('valor_perdido'), 2),
            'total_meta_1' => round((float)(clone $baseQuery)->sum('meta_1'), 2),
            'total_meta_2' => round((float)(clone $baseQuery)->sum('meta_2'), 2),
            'prom_rechazos' => round((float)(clone $baseQuery)->avg('rechazos'), 2),
            'colaboradores_unicos' => (clone $baseQuery)->distinct('cedula')->whereNotNull('cedula')->where('cedula', '!=', '')->count('cedula'),
            'vehiculos_unicos' => (clone $baseQuery)->distinct('placa')->whereNotNull('placa')->where('placa', '!=', '')->count('placa'),
        ] : [
            'total_registros' => 0,
            'total_rechazos' => 0,
            'total_cal_rechazos' => 0,
            'total_cal_rechazos_2' => 0,
            'total_valor_x_dia' => 0,
            'total_valor_var' => 0,
            'total_valor_perdido' => 0,
            'total_meta_1' => 0,
            'total_meta_2' => 0,
            'prom_rechazos' => 0,
            'colaboradores_unicos' => 0,
            'vehiculos_unicos' => 0,
        ];

        // Calcular totales solo si hay datos
        $totalesPorDia = $hayDatos ? $this->calcularTotalesPorDia($baseQuery) : [
            'fechas' => [],
            'rechazos' => [],
            'valor_x_dia' => [],
            'valor_var' => [],
            'valor_perdido' => [],
        ];
        
        $totalesMensuales = $hayDatos ? $this->calcularTotalesMensuales($baseQuery) : [
            'meses' => ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
            'rechazos' => array_fill(0, 12, 0),
            'valor_var' => array_fill(0, 12, 0),
            'valor_perdido' => array_fill(0, 12, 0),
            'meta_1' => array_fill(0, 12, 0),
            'meta_2' => array_fill(0, 12, 0),
        ];

        // Construir catálogos solo si hay datos
        $catalogos = $hayDatos ? [
            'anios' => CompensacionVariableDiaria::distinct()
                ->whereNotNull('anio')
                ->pluck('anio')
                ->filter(fn($v) => $v !== null && $v !== '')
                ->map(fn($v) => (int)$v)
                ->unique()
                ->sortDesc()
                ->values()
                ->toArray(),
            'meses' => CompensacionVariableDiaria::distinct()
                ->whereNotNull('mes')
                ->where('mes', '!=', '')
                ->pluck('mes')
                ->filter(fn($v) => $v !== null && $v !== '')
                ->unique()
                ->sort()
                ->values()
                ->toArray(),
            'cargos' => CompensacionVariableDiaria::distinct()
                ->whereNotNull('cargo')
                ->where('cargo', '!=', '')
                ->pluck('cargo')
                ->filter(fn($v) => $v !== null && $v !== '')
                ->unique()
                ->sort()
                ->values()
                ->toArray(),
            'cedulas' => Colaborador::distinct()
                ->whereNotNull('cedula')
                ->where('cedula', '!=', '')
                ->pluck('cedula')
                ->filter(fn($v) => $v !== null && $v !== '')
                ->unique()
                ->sort()
                ->values()
                ->toArray(),
            'nombres' => CompensacionVariableDiaria::distinct()
                ->whereNotNull('nombre_completo')
                ->where('nombre_completo', '!=', '')
                ->pluck('nombre_completo')
                ->filter(fn($v) => $v !== null && $v !== '')
                ->unique()
                ->sort()
                ->values()
                ->toArray(),
            'placas' => CompensacionVariableDiaria::distinct()
                ->whereNotNull('placa')
                ->where('placa', '!=', '')
                ->pluck('placa')
                ->filter(fn($v) => $v !== null && $v !== '')
                ->unique()
                ->sort()
                ->values()
                ->toArray(),
            'transportes' => CompensacionVariableDiaria::distinct()
                ->whereNotNull('transporte')
                ->where('transporte', '!=', '')
                ->pluck('transporte')
                ->filter(fn($v) => $v !== null && $v !== '')
                ->unique()
                ->sort()
                ->values()
                ->toArray(),
            'rrs' => CompensacionVariableDiaria::distinct()
                ->whereNotNull('rr')
                ->where('rr', '!=', '')
                ->pluck('rr')
                ->filter(fn($v) => $v !== null && $v !== '')
                ->unique()
                ->sort()
                ->values()
                ->toArray(),
        ] : [
            'anios' => [],
            'meses' => [],
            'cargos' => [],
            'cedulas' => Colaborador::distinct()
                ->whereNotNull('cedula')
                ->where('cedula', '!=', '')
                ->pluck('cedula')
                ->filter(fn($v) => $v !== null && $v !== '')
                ->unique()
                ->sort()
                ->values()
                ->toArray(),
            'nombres' => [],
            'placas' => [],
            'transportes' => [],
            'rrs' => [],
        ];

        return Inertia::render('reparto/compensacion-variable-diaria/index', [
            'data' => $data,
            'indicadores' => $indicadores,
            'totales_por_dia' => $totalesPorDia,
            'totales_mensuales' => $totalesMensuales,
            'filters' => $request->only([
                'fecha_desde', 'fecha_hasta', 'anio', 'mes',
                'cedula', 'nombre_completo', 'cargo', 'placa', 'transporte', 'rr'
            ]),
            'catalogos' => $catalogos,
            'hay_datos' => $hayDatos,
        ]);
    }

    public function importar(Request $request, CompensacionVariableDiariaImportService $service): RedirectResponse
    {
        $anio = $request->filled('anio') ? (int) $request->input('anio') : null;
        $mes  = $request->filled('mes')  ? (int) $request->input('mes')  : null;

        $resultado = $service->calcularDesdeEventos($anio, $mes);

        $periodo = $resultado['periodo'] ?? now()->locale('es')->isoFormat('MMMM YYYY');
        if ($resultado['total_procesados'] > 0) {
            $mensaje = "✓ Compensación calculada para {$periodo}: {$resultado['registros_creados']} registros nuevos y {$resultado['registros_actualizados']} actualizados ({$resultado['total_procesados']} eventos procesados).";
        } else {
            $mensaje = "No se encontraron eventos de tripulación para {$periodo}. Verifica que existan datos cargados en ese período.";
        }

        $mesNombre = null;
        if (isset($resultado['mes'])) {
            $meses = [
                1 => 'Enero', 2 => 'Febrero', 3 => 'Marzo', 4 => 'Abril',
                5 => 'Mayo', 6 => 'Junio', 7 => 'Julio', 8 => 'Agosto',
                9 => 'Septiembre', 10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre',
            ];
            $mesNombre = $meses[(int) $resultado['mes']] ?? null;
        }

        return redirect()->route('reparto.compensacion-variable-diaria.index', [
            'anio' => $resultado['anio'] ?? null,
            'mes'  => $mesNombre,
        ])->with('status', [
            'message' => $mensaje,
            'type'    => $resultado['total_procesados'] > 0 ? 'success' : 'error',
        ]);
    }

    public function detalle(string $id): JsonResponse
    {
        $registro = CompensacionVariableDiaria::find($id);
        if (!$registro) {
            return response()->json(['error' => 'Registro no encontrado'], 404);
        }

        $cedula = $registro->cedula;
        $historial = [];
        if ($cedula) {
            $historial = CompensacionVariableDiaria::where('cedula', $cedula)
                ->when($registro->anio, fn ($q) => $q->where('anio', $registro->anio))
                ->orderBy('fecha', 'desc')
                ->get();
        }

        return response()->json([
            'registro' => $registro,
            'historial' => $historial,
        ]);
    }

    public function limpiar(): RedirectResponse
    {
        CompensacionVariableDiaria::truncate();
        return redirect()->route('reparto.compensacion-variable-diaria.index')
            ->with('status', ['message' => 'Se han limpiado todos los datos de Compensación Variable Diaria.', 'type' => 'success']);
    }

    public function exportar(Request $request): StreamedResponse
    {
        $query = CompensacionVariableDiaria::query();
        $this->applyFilters($query, $request);

        $filename = 'compensacion_variable_diaria_' . date('Y-m-d_H-i') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($query) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));
            fputcsv($file, [
                'FECHA', 'AÑO', 'MES', 'PLACA', 'TRANSPORTE', 'RR', 'CEDULA',
                'NOMBRE COMPLETO', 'CARGO', 'RECHAZOS', 'CAL-RECHAZOS', 'CAL-RECHAZOS2',
                'VALOR X DIA', 'VALOR VAR', 'VALOR PERDIDO', '%VARIABLE', '%VARIABLENOCUM',
                'META 1', 'META 2'
            ]);
            $query->chunk(200, function ($rows) use ($file) {
                foreach ($rows as $r) {
                    fputcsv($file, [
                        $r->fecha instanceof \DateTimeInterface ? $r->fecha->format('Y-m-d') : $r->fecha,
                        $r->anio, $r->mes, $r->placa, $r->transporte, $r->rr, $r->cedula,
                        $r->nombre_completo, $r->cargo, $r->rechazos, $r->cal_rechazos, $r->cal_rechazos_2,
                        $r->valor_x_dia, $r->valor_var, $r->valor_perdido,
                        $r->porcentaje_variable, $r->porcentaje_variable_no_cum,
                        $r->meta_1, $r->meta_2
                    ]);
                }
            });
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
