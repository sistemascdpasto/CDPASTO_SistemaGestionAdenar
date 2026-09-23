<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Models\Seguridad\Aci;
use App\Models\Seguridad\Colaborador;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AciIndicadorController extends Controller
{
    private const META_MENSUAL = 4;

    public function index(Request $request): Response
    {
        $mes = $request->integer('mes') ?: (int) now()->month;
        $anio = $request->integer('anio') ?: (int) now()->year;

        // Solo quien tiene un código QR SKAP asignado y está activo puede
        // reportar ACI — es la misma población para "QR SKAP activos" (1.11)
        // y para la base de cumplimiento de meta (1.2/1.3).
        $poblacion = Colaborador::whereNotNull('codigo_qr_skap')
            ->where('is_active', true)
            ->get(['id', 'nombres', 'apellidos', 'cedula']);

        $conteosPorColaborador = Aci::whereMonth('fecha_incidente', $mes)
            ->whereYear('fecha_incidente', $anio)
            ->whereNotNull('colaborador_id')
            ->select('colaborador_id', DB::raw('count(*) as total'))
            ->groupBy('colaborador_id')
            ->pluck('total', 'colaborador_id');

        $progreso = $poblacion->map(function ($colaborador) use ($conteosPorColaborador) {
            $cantidad = (int) ($conteosPorColaborador[$colaborador->id] ?? 0);

            return [
                'id' => $colaborador->id,
                'nombres' => $colaborador->nombres,
                'apellidos' => $colaborador->apellidos,
                'cedula' => $colaborador->cedula,
                'cantidad' => $cantidad,
                'faltantes' => max(0, self::META_MENSUAL - $cantidad),
                'cumple' => $cantidad >= self::META_MENSUAL,
            ];
        })->sortBy('cantidad')->values();

        $totalPoblacion = $progreso->count();
        $cumplen = $progreso->where('cumple', true)->count();
        $noCumplen = $totalPoblacion - $cumplen;
        $porcentajeCumplimiento = $totalPoblacion > 0 ? round(($cumplen / $totalPoblacion) * 100, 1) : 0.0;

        $colaboradoresMeta = $this->paginar($progreso, $request);

        $totalAciMes = Aci::whereMonth('fecha_incidente', $mes)->whereYear('fecha_incidente', $anio)->count();

        // "Problemáticas detectadas" (HU-024, 1.5) no tiene una regla exacta más
        // allá de "tabla acis, campos descripción y tipo de riesgo": se
        // interpreta como los reportes del mes que sí traen una descripción del
        // acto/condición insegura.
        $problematicasDetectadas = Aci::whereMonth('fecha_incidente', $mes)
            ->whereYear('fecha_incidente', $anio)
            ->whereNotNull('descripcion')
            ->where('descripcion', '!=', '')
            ->count();

        $ultimosAci = Aci::with('colaborador:id,nombres,apellidos')
            ->whereMonth('fecha_incidente', $mes)
            ->whereYear('fecha_incidente', $anio)
            ->latest('fecha_incidente')
            ->limit(10)
            ->get(['id', 'folio', 'fecha_incidente', 'colaborador_id', 'area', 'tipo_riesgo', 'estatus_asignacion']);

        $aciPorArea = Aci::whereMonth('fecha_incidente', $mes)
            ->whereYear('fecha_incidente', $anio)
            ->whereNotNull('area')
            ->select('area', DB::raw('count(*) as total'))
            ->groupBy('area')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($fila) => ['area' => $fila->area, 'cantidad' => (int) $fila->total])
            ->all();

        return Inertia::render('seguridad/acis/indicadores', [
            'filtros' => ['mes' => $mes, 'anio' => $anio],
            'resumen' => [
                'total_aci_mes' => $totalAciMes,
                'colaboradores_en_programa' => $totalPoblacion,
                'cumplen_meta' => $cumplen,
                'no_cumplen_meta' => $noCumplen,
                'porcentaje_cumplimiento' => $porcentajeCumplimiento,
                'problematicas_detectadas' => $problematicasDetectadas,
                'qr_skap_activos' => $totalPoblacion,
            ],
            'ultimosAci' => $ultimosAci,
            'colaboradoresMeta' => $colaboradoresMeta,
            'aciPorArea' => $aciPorArea,
            'aciPorMes' => $this->tendenciaUltimosMeses($mes, $anio),
        ]);
    }

    /**
     * Pagina en memoria la colección ya calculada de progreso por
     * colaborador (no es un simple `Model::paginate()` porque "cantidad" es
     * un valor calculado, no una columna de la tabla).
     *
     * @param  \Illuminate\Support\Collection<int, array<string, mixed>>  $coleccion
     */
    private function paginar($coleccion, Request $request): LengthAwarePaginator
    {
        $porPagina = 15;
        $paginaActual = max(1, $request->integer('page', 1));

        return new LengthAwarePaginator(
            $coleccion->slice(($paginaActual - 1) * $porPagina, $porPagina)->values(),
            $coleccion->count(),
            $porPagina,
            $paginaActual,
            ['path' => $request->url(), 'query' => $request->query()],
        );
    }

    /**
     * Cantidad de ACI por mes de los últimos 6 meses (incluyendo el
     * seleccionado), agrupado en PHP en vez de SQL específico del motor
     * (los tests corren sobre SQLite y producción sobre MySQL).
     *
     * @return array<int, array{periodo: string, cantidad: int}>
     */
    private function tendenciaUltimosMeses(int $mes, int $anio): array
    {
        $fin = Carbon::create($anio, $mes, 1)->endOfMonth();
        $inicio = $fin->copy()->subMonths(5)->startOfMonth();

        $conteos = Aci::whereBetween('fecha_incidente', [$inicio->toDateString(), $fin->toDateString()])
            ->pluck('fecha_incidente')
            ->countBy(fn (Carbon $fecha) => $fecha->format('Y-m'));

        $meses = [];
        $cursor = $inicio->copy();

        while ($cursor->lte($fin)) {
            $clave = $cursor->format('Y-m');
            $meses[] = ['periodo' => $clave, 'cantidad' => (int) ($conteos[$clave] ?? 0)];
            $cursor->addMonth();
        }

        return $meses;
    }
}
