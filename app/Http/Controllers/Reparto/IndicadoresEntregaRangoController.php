<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Models\Reparto\EventosTripulacion;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class IndicadoresEntregaRangoController extends Controller
{
    const META = 95.0;

    public function index(Request $request): Response
    {
        // ── Filtros ───────────────────────────────────────────────────────────
        // (string) y no solo el default de input(): el middleware global
        // ConvertEmptyStringsToNull convierte '' a null ANTES de llegar aquí, y
        // Arr::get devuelve ese null tal cual (la llave ya existe) ignorando el
        // default — sin el cast, un filtro vacío rompe el tipo string de abajo.
        $fechaDesdeFiltro = (string) $request->input('fecha_desde', '');
        $fechaHastaFiltro = (string) $request->input('fecha_hasta', '');
        $filterCargo      = (string) $request->input('cargo', '');
        $filterPlacas     = array_filter(
            array_map('strtoupper', (array) $request->input('placas', []))
        );

        $minFecha = EventosTripulacion::whereNotNull('entrega_en_rango')->min('fecha');
        $maxFecha = EventosTripulacion::whereNotNull('entrega_en_rango')->max('fecha');

        $fechaDesde = $fechaDesdeFiltro ?: ($minFecha ?: Carbon::now()->subMonth()->format('Y-m-d'));
        $fechaHasta = $fechaHastaFiltro ?: ($maxFecha ?: Carbon::now()->format('Y-m-d'));

        // ── Query base ────────────────────────────────────────────────────────
        $query = EventosTripulacion::query()
            ->whereNotNull('entrega_en_rango')
            ->whereDate('fecha', '>=', $fechaDesde)
            ->whereDate('fecha', '<=', $fechaHasta);

        if ($filterCargo)           $query->where('cargo', $filterCargo);
        if (!empty($filterPlacas))  $query->whereIn('placa', $filterPlacas);

        $rows = $query
            ->select(['fecha', 'placa', 'documento', 'nombre', 'rr', 'rr_pasto', 'cargo', 'entrega_en_rango'])
            ->orderBy('fecha')
            ->get();

        $total = $rows->count();

        if ($total === 0) {
            return $this->emptyResponse($fechaDesdeFiltro, $fechaHastaFiltro, $filterCargo, $filterPlacas);
        }

        // ── Helper nombre ─────────────────────────────────────────────────────
        $nombre = fn ($g, $doc) =>
            $g->first(fn ($r) => !empty($r->nombre))?->nombre
            ?? $g->first(fn ($r) => !empty($r->rr_pasto))?->rr_pasto
            ?? $g->first(fn ($r) => !empty($r->rr))?->rr
            ?? $doc;

        $placaPrincipal = fn ($g) =>
            $g->groupBy('placa')->map(fn ($gp) => $gp->count())->sortDesc()->keys()->first() ?? '';

        // ── KPIs ──────────────────────────────────────────────────────────────
        $promedio     = round($rows->avg('entrega_en_rango'), 1);
        $enMeta       = $rows->filter(fn ($r) => (float)$r->entrega_en_rango >= self::META)->count();
        $bajoCritico  = $rows->filter(fn ($r) => (float)$r->entrega_en_rango < 80)->count();
        $ceros        = $rows->filter(fn ($r) => (float)$r->entrega_en_rango == 0)->count();
        $pctEnMeta    = $total > 0 ? round(($enMeta / $total) * 100, 1) : 0;
        $pctBajo      = $total > 0 ? round(($bajoCritico / $total) * 100, 1) : 0;
        $gap          = round(self::META - $promedio, 1);

        // ── Radar: promedio por día de semana (Radar Principal) ───────────────
        $mapDow     = [1=>'Lunes',2=>'Martes',3=>'Miércoles',4=>'Jueves',5=>'Viernes',6=>'Sábado',7=>'Domingo'];
        $dowLabels  = array_values($mapDow);
        $dowData    = array_fill_keys($dowLabels, []);

        foreach ($rows as $row) {
            $dow = Carbon::parse($row->fecha)->dayOfWeekIso;
            $dowData[$mapDow[$dow]][] = (float)$row->entrega_en_rango;
        }

        $radarPrincipal = collect($dowLabels)->map(function ($dia) use ($dowData) {
            $vals = $dowData[$dia];
            return [
                'dia'      => $dia,
                'promedio' => count($vals) > 0 ? round(array_sum($vals) / count($vals), 1) : null,
                'total'    => count($vals),
                'bajo'     => count(array_filter($vals, fn ($v) => $v < 80)),
            ];
        })->values();

        // ── Radar: brecha (95 - promedio por día de semana) ───────────────────
        $radarBrecha = $radarPrincipal->map(fn ($d) => [
            'dia'    => $d['dia'],
            'brecha' => $d['promedio'] !== null ? max(0, round(self::META - $d['promedio'], 1)) : null,
        ])->values();

        // ── Tendencia diaria ──────────────────────────────────────────────────
        $porDia = $rows
            ->groupBy(fn ($r) => Carbon::parse($r->fecha)->format('Y-m-d'))
            ->map(fn ($g, $dia) => [
                'fecha'    => Carbon::parse($dia)->format('d/m'),
                'promedio' => round($g->avg('entrega_en_rango'), 1),
                'en_meta'  => $g->filter(fn ($r) => (float)$r->entrega_en_rango >= self::META)->count(),
                'bajo'     => $g->filter(fn ($r) => (float)$r->entrega_en_rango < 80)->count(),
                'total'    => $g->count(),
                'placas'   => $g->pluck('placa')->filter()->unique()->sort()->values()->toArray(),
                'personas' => $g->groupBy('documento')
                    ->map(fn ($gp, $doc) => [
                        'nombre'   => $nombre($gp, $doc),
                        'placa'    => $placaPrincipal($gp),
                        'promedio' => round($gp->avg('entrega_en_rango'), 1),
                    ])
                    ->sortBy('promedio')->take(5)->values()->toArray(),
            ])
            ->sortKeys()
            ->values();

        // ── Bandas de distribución ────────────────────────────────────────────
        $bandas = [
            'Crítico (0–49%)'  => 0,
            'Bajo (50–79%)'    => 0,
            'Medio (80–89%)'   => 0,
            'Bueno (90–94%)'   => 0,
            'Óptimo (95–100%)' => 0,
        ];
        foreach ($rows as $row) {
            $v = (float)$row->entrega_en_rango;
            if      ($v < 50) $bandas['Crítico (0–49%)']++;
            elseif  ($v < 80) $bandas['Bajo (50–79%)']++;
            elseif  ($v < 90) $bandas['Medio (80–89%)']++;
            elseif  ($v < 95) $bandas['Bueno (90–94%)']++;
            else               $bandas['Óptimo (95–100%)']++;
        }

        // ── Por persona ───────────────────────────────────────────────────────
        $porPersona = $rows->whereNotNull('documento')
            ->groupBy('documento')
            ->map(fn ($g, $doc) => [
                'documento'   => $doc,
                'nombre'      => $nombre($g, $doc),
                'placa'       => $placaPrincipal($g),
                'cargo'       => $g->first()->cargo ?? '',
                'dias'        => $g->count(),
                'promedio'    => round($g->avg('entrega_en_rango'), 1),
                'en_meta'     => $g->filter(fn ($r) => (float)$r->entrega_en_rango >= self::META)->count(),
                'bajo'        => $g->filter(fn ($r) => (float)$r->entrega_en_rango < 80)->count(),
                'fecha_min'   => Carbon::parse($g->min('fecha'))->format('d/m/Y'),
                'fecha_max'   => Carbon::parse($g->max('fecha'))->format('d/m/Y'),
            ])
            ->filter(fn ($p) => $p['dias'] >= 1)
            ->values();

        $rankBottom = $porPersona->filter(fn ($p) => $p['dias'] >= 5)
            ->sortBy('promedio')->take(12)->values();
        $rankTop    = $porPersona->filter(fn ($p) => $p['dias'] >= 5)
            ->sortByDesc('promedio')->take(12)->values();

        // ── Por cargo ─────────────────────────────────────────────────────────
        $porCargo = $rows->whereNotNull('cargo')
            ->groupBy('cargo')
            ->map(fn ($g, $cargo) => [
                'cargo'     => $cargo,
                'promedio'  => round($g->avg('entrega_en_rango'), 1),
                'total'     => $g->count(),
                'bajo'      => $g->filter(fn ($r) => (float)$r->entrega_en_rango < 80)->count(),
                'pct_bajo'  => $g->count() > 0
                    ? round(($g->filter(fn ($r) => (float)$r->entrega_en_rango < 80)->count() / $g->count()) * 100, 1)
                    : 0,
                'placas'    => $g->pluck('placa')->filter()->unique()->sort()->values()->toArray(),
                'fecha_min' => Carbon::parse($g->min('fecha'))->format('d/m/Y'),
                'fecha_max' => Carbon::parse($g->max('fecha'))->format('d/m/Y'),
                'personas'  => $g->groupBy('documento')
                    ->map(fn ($gp, $doc) => [
                        'nombre'    => $nombre($gp, $doc),
                        'placa'     => $placaPrincipal($gp),
                        'promedio'  => round($gp->avg('entrega_en_rango'), 1),
                        'dias'      => $gp->count(),
                        'bajo'      => $gp->filter(fn ($r) => (float)$r->entrega_en_rango < 80)->count(),
                        'fecha_min' => Carbon::parse($gp->min('fecha'))->format('d/m/Y'),
                        'fecha_max' => Carbon::parse($gp->max('fecha'))->format('d/m/Y'),
                    ])
                    ->sortBy('promedio')->take(20)->values()->toArray(),
            ])
            ->sortByDesc('total')->values();

        // ── Por placa ─────────────────────────────────────────────────────────
        $porPlaca = $rows->whereNotNull('placa')
            ->groupBy('placa')
            ->map(fn ($g, $placa) => [
                'placa'    => $placa,
                'promedio' => round($g->avg('entrega_en_rango'), 1),
                'total'    => $g->count(),
            ])
            ->filter(fn ($p) => $p['total'] >= 5)
            ->sortBy('promedio')->values();

        // ── Placas y cargos para filtros ──────────────────────────────────────
        $todasPlacas = EventosTripulacion::whereNotNull('placa')
            ->whereNotNull('entrega_en_rango')
            ->distinct()->orderBy('placa')->pluck('placa');

        $cargos = EventosTripulacion::whereNotNull('cargo')
            ->whereNotNull('entrega_en_rango')
            ->distinct()->orderBy('cargo')->pluck('cargo');

        return Inertia::render('reparto/indicadores-entrega-rango/index', [
            'kpis' => [
                'promedio'    => $promedio,
                'total'       => $total,
                'en_meta'     => $enMeta,
                'pct_en_meta' => $pctEnMeta,
                'bajo'        => $bajoCritico,
                'pct_bajo'    => $pctBajo,
                'ceros'       => $ceros,
                'gap'         => $gap,
                'meta'        => self::META,
                'personas'    => $porPersona->count(),
                'placas'      => $rows->pluck('placa')->filter()->unique()->count(),
            ],
            'radar_principal' => $radarPrincipal,
            'radar_brecha'    => $radarBrecha,
            'sparkline'       => $porDia->pluck('promedio')->values(),
            'por_dia'         => $porDia,
            'bandas'          => $bandas,
            'rank_bottom'     => $rankBottom,
            'rank_top'        => $rankTop,
            'por_cargo'       => $porCargo,
            'por_placa'       => $porPlaca,
            'todasPlacas'     => $todasPlacas,
            'cargos'          => $cargos,
            'filters'         => [
                'fecha_desde' => $fechaDesdeFiltro,
                'fecha_hasta' => $fechaHastaFiltro,
                'cargo'       => $filterCargo,
                'placas'      => array_values($filterPlacas),
            ],
        ]);
    }

    private function emptyResponse(string $fd, string $fh, string $cargo, array $placas): Response
    {
        $todasPlacas = EventosTripulacion::whereNotNull('placa')
            ->whereNotNull('entrega_en_rango')
            ->distinct()->orderBy('placa')->pluck('placa');

        $cargos = EventosTripulacion::whereNotNull('cargo')
            ->whereNotNull('entrega_en_rango')
            ->distinct()->orderBy('cargo')->pluck('cargo');

        $dowLabels = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

        return Inertia::render('reparto/indicadores-entrega-rango/index', [
            'kpis'            => ['promedio'=>null,'total'=>0,'en_meta'=>0,'pct_en_meta'=>0,
                                  'bajo'=>0,'pct_bajo'=>0,'ceros'=>0,'gap'=>null,
                                  'meta'=>self::META,'personas'=>0,'placas'=>0],
            'radar_principal' => collect($dowLabels)->map(fn($d)=>['dia'=>$d,'promedio'=>null,'total'=>0,'bajo'=>0])->values(),
            'radar_brecha'    => collect($dowLabels)->map(fn($d)=>['dia'=>$d,'brecha'=>null])->values(),
            'sparkline'       => [],
            'por_dia'         => [],
            'bandas'          => [],
            'rank_bottom'     => [],
            'rank_top'        => [],
            'por_cargo'       => [],
            'por_placa'       => [],
            'todasPlacas'     => $todasPlacas,
            'cargos'          => $cargos,
            'filters'         => ['fecha_desde'=>$fd,'fecha_hasta'=>$fh,'cargo'=>$cargo,'placas'=>$placas],
        ]);
    }
}
