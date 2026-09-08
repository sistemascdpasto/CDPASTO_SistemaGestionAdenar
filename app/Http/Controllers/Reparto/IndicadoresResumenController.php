<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Models\Reparto\EventosTripulacion;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class IndicadoresResumenController extends Controller
{
    // Metas por indicador
    const METAS = [
        'adh_tiempo'  => 95.0,   // % Adherencia al Tiempo
        'entrega'     => 95.0,   // % Entrega en Rango
        'rechazos'    => 2.0,    // % Rechazo (menor = mejor, meta ≤ 2%)
        'modulacion'  => 95.0,   // % Modulación (viene 0-1, se convierte ×100)
        'cl_pre'      => 100.0,  // % Check List Pre
        'cl_post'     => 100.0,  // % Check List Post
        'alertas'     => 0.0,    // Alertas velocidad (menor = mejor, meta = 0)
        'excesos'     => 0.0,    // Excesos tiempo ruta (menor = mejor, meta = 0)
        'rmd'         => 5.0,    // RMD (escala 1-5, mayor = mejor)
    ];

    // Indicadores donde menor valor = mejor cumplimiento
    const INVERTIDOS = ['rechazos', 'alertas', 'excesos'];

    public function index(Request $request): Response
    {
        // ── Filtros ───────────────────────────────────────────────────────────
        $fechaDesdeFiltro = $request->input('fecha_desde', '');
        $fechaHastaFiltro = $request->input('fecha_hasta', '');
        $filterCargo      = $request->input('cargo', '');
        $filterPlacas     = array_filter(
            array_map('strtoupper', (array) $request->input('placas', []))
        );

        $minFecha = EventosTripulacion::min('fecha');
        $maxFecha = EventosTripulacion::max('fecha');

        $fechaDesde = $fechaDesdeFiltro ?: ($minFecha ?: Carbon::now()->subMonth()->format('Y-m-d'));
        $fechaHasta = $fechaHastaFiltro ?: ($maxFecha ?: Carbon::now()->format('Y-m-d'));

        // ── Query base ────────────────────────────────────────────────────────
        $query = EventosTripulacion::query()
            ->whereDate('fecha', '>=', $fechaDesde)
            ->whereDate('fecha', '<=', $fechaHasta);

        if ($filterCargo)          $query->where('cargo', $filterCargo);
        if (!empty($filterPlacas)) $query->whereIn('placa', $filterPlacas);

        $rows = $query->select([
            'fecha', 'placa', 'documento', 'nombre', 'rr_pasto', 'rr', 'cargo',
            'adherencia_tiempo', 'entrega_en_rango', 'rechazos',
            'modulacion', 'adherencia_checklist_pre', 'adherencia_checklist_post',
            'alertas_velocidad_curvas', 'excesos_tiempo_ruta', 'rmd',
        ])->get();

        $total = $rows->count();

        // ── Helper: nombre preferido ──────────────────────────────────────────
        $nombre = fn ($g, $doc) =>
            $g->first(fn ($r) => !empty($r->nombre))?->nombre
            ?? $g->first(fn ($r) => !empty($r->rr_pasto))?->rr_pasto
            ?? $g->first(fn ($r) => !empty($r->rr))?->rr
            ?? $doc;

        // ── Helper: modulacion numérica (viene 0-1, convertimos ×100) ─────────
        $modNum = fn ($v) => is_numeric($v) ? round((float)$v * 100, 1) : null;

        // ── Helper: rmd numérico (ignora textos como "SIN CALIFICACION") ──────
        $rmdNum = fn ($v) => is_numeric($v) ? round((float)$v, 2) : null;

        // ── 1. PROMEDIOS GLOBALES ─────────────────────────────────────────────
        $avg = fn ($col, $transform = null) => $rows
            ->filter(fn ($r) => $r->$col !== null && is_numeric($r->$col))
            ->pipe(fn ($c) => $c->count() > 0
                ? round($c->avg(fn ($r) => $transform ? $transform($r->$col) : (float)$r->$col), 2)
                : null);

        $promedios = [
            'adh_tiempo' => $avg('adherencia_tiempo'),
            'entrega'    => $avg('entrega_en_rango'),
            'rechazos'   => $total > 0
                ? round($rows->sum('rechazos') / $total, 2)
                : null,
            'modulacion' => $rows
                ->filter(fn ($r) => is_numeric($r->modulacion))
                ->pipe(fn ($c) => $c->count() > 0
                    ? round($c->avg(fn ($r) => (float)$r->modulacion * 100), 1)
                    : null),
            'cl_pre'     => $avg('adherencia_checklist_pre'),
            'cl_post'    => $avg('adherencia_checklist_post'),
            'alertas'    => $avg('alertas_velocidad_curvas'),
            'excesos'    => $avg('excesos_tiempo_ruta'),
            'rmd'        => $rows
                ->filter(fn ($r) => is_numeric($r->rmd))
                ->pipe(fn ($c) => $c->count() > 0
                    ? round($c->avg(fn ($r) => (float)$r->rmd), 2)
                    : null),
        ];

        // ── 2. CUMPLIMIENTO POR INDICADOR (normalizado 0-100%) ────────────────
        // Para indicadores normales: cumplimiento = (real / meta) × 100, capped 100
        // Para invertidos (rechazos, alertas, excesos): cumplimiento = max(0, 100 - real)
        //   con rechazos: si real <= meta → 100%, si real > meta → degradado
        $cumplimiento = [];
        foreach ($promedios as $key => $valor) {
            if ($valor === null) { $cumplimiento[$key] = null; continue; }
            $meta = self::METAS[$key];

            if (in_array($key, self::INVERTIDOS)) {
                if ($meta == 0) {
                    // Alertas / excesos: 0 es perfecto, escala libre
                    $cumplimiento[$key] = $valor == 0 ? 100 : round(max(0, 100 - ($valor * 10)), 1);
                } else {
                    // Rechazos: meta = 2%, si real=0 → 100%, si real=meta → 0%, lineal invertida
                    $cumplimiento[$key] = $valor <= $meta
                        ? 100
                        : round(max(0, 100 - (($valor - $meta) / $meta) * 100), 1);
                }
            } elseif ($key === 'rmd') {
                // RMD escala 1-5: cumplimiento = (valor-1)/(meta-1) × 100
                $cumplimiento[$key] = $meta > 1
                    ? round(min(100, max(0, (($valor - 1) / ($meta - 1)) * 100)), 1)
                    : ($valor >= $meta ? 100 : 0);
            } else {
                $cumplimiento[$key] = round(min(100, ($valor / $meta) * 100), 1);
            }
        }

        // Cumplimiento general: promedio de los cumplimientos disponibles
        $cumplValidos    = array_filter($cumplimiento, fn ($v) => $v !== null);
        $cumplGeneral    = count($cumplValidos) > 0
            ? round(array_sum($cumplValidos) / count($cumplValidos), 1)
            : null;

        // Metas cumplidas por operador (cuántos indicadores ≥ 95% de cumplimiento)
        $metasCumplidas  = count(array_filter($cumplValidos, fn ($v) => $v >= 95));
        $totalIndicadores = count($cumplValidos);

        // ── 3. BRECHAS (meta - real, en unidades del indicador) ───────────────
        $brechas = [];
        foreach ($promedios as $key => $valor) {
            if ($valor === null) { $brechas[$key] = null; continue; }
            $meta = self::METAS[$key];
            if (in_array($key, self::INVERTIDOS)) {
                // Brecha = real - meta (cuánto excede la meta "mala")
                $brechas[$key] = round(max(0, $valor - $meta), 2);
            } else {
                $brechas[$key] = round(max(0, $meta - $valor), 2);
            }
        }

        // ── 4. INCUMPLIMIENTO POR CARGO ───────────────────────────────────────
        // Conteo de "días problemáticos" por cada indicador
        $porCargo = $rows->whereNotNull('cargo')
            ->groupBy('cargo')
            ->map(fn ($g, $cargo) => [
                'cargo'         => $cargo,
                'total'         => $g->count(),
                // Días donde cada indicador está en 0 o bajo meta
                'cl_pre_cero'   => $g->filter(fn ($r) => $r->adherencia_checklist_pre !== null && (float)$r->adherencia_checklist_pre == 0)->count(),
                'cl_post_cero'  => $g->filter(fn ($r) => $r->adherencia_checklist_post !== null && (float)$r->adherencia_checklist_post == 0)->count(),
                'rechazos_sum'  => (int) $g->sum('rechazos'),
                'entrega_cero'  => $g->filter(fn ($r) => $r->entrega_en_rango !== null && (float)$r->entrega_en_rango == 0)->count(),
                'entrega_bajo'  => $g->filter(fn ($r) => $r->entrega_en_rango !== null && (float)$r->entrega_en_rango < 80)->count(),
                'alertas_sum'   => (int) $g->sum('alertas_velocidad_curvas'),
                'excesos_sum'   => (int) $g->sum('excesos_tiempo_ruta'),
                'adh_bajo'      => $g->filter(fn ($r) => $r->adherencia_tiempo !== null && (float)$r->adherencia_tiempo < 80)->count(),
                // Puntaje de incumplimiento (suma ponderada)
                'score_incump'  => 0, // se calcula abajo
                // Promedios del cargo
                'prom_adh'      => $g->filter(fn ($r) => is_numeric($r->adherencia_tiempo))->avg('adherencia_tiempo'),
                'prom_entrega'  => $g->filter(fn ($r) => is_numeric($r->entrega_en_rango))->avg('entrega_en_rango'),
                'prom_mod'      => $g->filter(fn ($r) => is_numeric($r->modulacion))
                    ->pipe(fn ($c) => $c->count() > 0
                        ? round($c->avg(fn ($r) => (float)$r->modulacion * 100), 1) : null),
            ])
            ->map(function ($c) {
                // Score de incumplimiento ponderado
                $c['score_incump'] =
                    $c['cl_pre_cero'] * 3 +
                    $c['cl_post_cero'] * 3 +
                    $c['rechazos_sum'] * 2 +
                    $c['entrega_cero'] * 4 +
                    $c['alertas_sum']  * 1 +
                    $c['excesos_sum']  * 1 +
                    $c['adh_bajo']     * 2;
                // Redondear promedios
                $c['prom_adh']     = $c['prom_adh']    !== null ? round((float)$c['prom_adh'], 1) : null;
                $c['prom_entrega'] = $c['prom_entrega'] !== null ? round((float)$c['prom_entrega'], 1) : null;
                return $c;
            })
            ->sortByDesc('score_incump')
            ->values();

        // ── 5. ETIQUETAS LEGIBLES ─────────────────────────────────────────────
        $etiquetas = [
            'adh_tiempo' => '% Adherencia al Tiempo',
            'entrega'    => '% Entrega en Rango',
            'rechazos'   => '% Rechazo',
            'modulacion' => '% Modulación',
            'cl_pre'     => 'Checklist Pre Op.',
            'cl_post'    => 'Checklist Post Op.',
            'alertas'    => 'Alertas Velocidad',
            'excesos'    => 'Excesos Tiempo Ruta',
            'rmd'        => 'RMD',
        ];

        $unidades = [
            'adh_tiempo' => '%',
            'entrega'    => '%',
            'rechazos'   => 'u/op',
            'modulacion' => '%',
            'cl_pre'     => '%',
            'cl_post'    => '%',
            'alertas'    => 'alertas/op',
            'excesos'    => 'excesos/op',
            'rmd'        => '/5',
        ];

        // ── 6. TENDENCIA diaria del cumplimiento general ──────────────────────
        $tendencia = $rows
            ->groupBy(fn ($r) => Carbon::parse($r->fecha)->format('Y-m-d'))
            ->map(fn ($g, $dia) => [
                'fecha'   => Carbon::parse($dia)->format('d/m'),
                'adh'     => $g->filter(fn ($r) => is_numeric($r->adherencia_tiempo))->avg('adherencia_tiempo'),
                'entrega' => $g->filter(fn ($r) => is_numeric($r->entrega_en_rango))->avg('entrega_en_rango'),
                'cl_pre'  => $g->filter(fn ($r) => is_numeric($r->adherencia_checklist_pre))->avg('adherencia_checklist_pre'),
            ])
            ->map(fn ($d) => [
                'fecha'   => $d['fecha'],
                'adh'     => $d['adh'] !== null ? round((float)$d['adh'], 1) : null,
                'entrega' => $d['entrega'] !== null ? round((float)$d['entrega'], 1) : null,
                'cl_pre'  => $d['cl_pre'] !== null ? round((float)$d['cl_pre'], 1) : null,
            ])
            ->sortKeys()
            ->values();

        // ── Filtros disponibles ───────────────────────────────────────────────
        $todasPlacas = EventosTripulacion::whereNotNull('placa')
            ->distinct()->orderBy('placa')->pluck('placa');

        $cargos = EventosTripulacion::whereNotNull('cargo')
            ->distinct()->orderBy('cargo')->pluck('cargo');

        return Inertia::render('reparto/indicadores-resumen/index', [
            'kpis' => [
                'cumpl_general'       => $cumplGeneral,
                'metas_cumplidas'     => $metasCumplidas,
                'total_indicadores'   => $totalIndicadores,
                'entrega_rango'       => $promedios['entrega'],
                'adh_tiempo'          => $promedios['adh_tiempo'],
                'total_registros'     => $total,
                'periodo_desde'       => Carbon::parse($fechaDesde)->format('d/m/Y'),
                'periodo_hasta'       => Carbon::parse($fechaHasta)->format('d/m/Y'),
            ],
            'promedios'    => $promedios,
            'cumplimiento' => $cumplimiento,
            'brechas'      => $brechas,
            'etiquetas'    => $etiquetas,
            'unidades'     => $unidades,
            'metas'        => self::METAS,
            'por_cargo'    => $porCargo,
            'tendencia'    => $tendencia,
            'todasPlacas'  => $todasPlacas,
            'cargos'       => $cargos,
            'filters'      => [
                'fecha_desde' => $fechaDesdeFiltro,
                'fecha_hasta' => $fechaHastaFiltro,
                'cargo'       => $filterCargo,
                'placas'      => array_values($filterPlacas),
            ],
        ]);
    }
}
