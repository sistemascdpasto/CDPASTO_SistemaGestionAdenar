<?php

namespace App\Services\Dashboard;

use App\Models\Flota\ActaTaller;
use App\Models\Flota\Varada;
use App\Models\Flota\Vehiculo;
use App\Models\Gente\Ausentismo;
use App\Models\Gente\CorreccionMarcacion;
use App\Models\Gente\Sac;
use App\Models\Reparto\CincoPorque;
use App\Models\Reparto\EventosTripulacion;
use App\Models\Reparto\Modulacion;
use App\Models\Seguridad\Colaborador;
use App\Services\Seguridad\IndicadoresSeguridadService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Arma el resumen del dashboard por pilar (Seguridad, Reparto, Gente, Flota).
 * Cada pilar devuelve KPIs con datos reales, una serie mensual para la
 * mini-gráfica de tendencia y una lista de pendientes accionables con enlace
 * directo al submódulo correspondiente. El controlador arma el conjunto según
 * los roles del usuario.
 */
class DashboardResumenService
{
    /** Meses hacia atrás (incluyendo el actual) que cubre la ventana del dashboard. */
    private const MESES_VENTANA = 6;

    public function __construct(private readonly IndicadoresSeguridadService $indicadoresSeguridad) {}

    /**
     * @param  list<string>  $slugs  Slugs de pilar: 'seguridad', 'reparto', 'gente', 'flota'.
     */
    public function paraPilares(array $slugs): array
    {
        $hasta = Carbon::today();
        $desde = $hasta->copy()->subMonths(self::MESES_VENTANA - 1)->startOfMonth();

        $builders = [
            'seguridad' => fn () => $this->seguridad($desde, $hasta),
            'reparto' => fn () => $this->reparto($desde, $hasta),
            'gente' => fn () => $this->gente($desde, $hasta),
            'flota' => fn () => $this->flota($desde, $hasta),
        ];

        $pilares = [];
        foreach ($slugs as $slug) {
            if (isset($builders[$slug])) {
                $pilares[$slug] = $builders[$slug]();
            }
        }

        return [
            'rango' => ['desde' => $desde->toDateString(), 'hasta' => $hasta->toDateString()],
            'pilares' => $pilares,
        ];
    }

    // ── Seguridad ────────────────────────────────────────────────────────────

    private function seguridad(Carbon $desde, Carbon $hasta): array
    {
        $r = $this->indicadoresSeguridad->resumen($desde, $hasta);

        $acisPendientes = (int) (collect($r['acis']['por_estatus'])->firstWhere('label', 'Pendiente')['total'] ?? 0);

        return [
            'titulo' => 'Seguridad',
            'href' => '/modules/seguridad',
            'kpis' => [
                ['label' => 'Pruebas de alcoholemia', 'value' => $r['alcoholimetria']['realizadas'], 'hint' => 'realizadas en el rango'],
                ['label' => 'Pruebas positivas', 'value' => $r['alcoholimetria']['positivas'], 'hint' => $r['alcoholimetria']['pct_positivas'].'% de las realizadas', 'tone' => $r['alcoholimetria']['positivas'] > 0 ? 'bad' : 'good'],
                ['label' => 'Alertas abiertas', 'value' => $r['alertas']['abiertas'], 'hint' => $r['alertas']['total'].' generadas en el rango', 'tone' => $r['alertas']['abiertas'] > 0 ? 'warn' : 'good'],
                ['label' => 'Cumplimiento OWD', 'value' => $r['owd']['pct_cumplimiento'], 'suffix' => '%', 'decimals' => 1, 'hint' => $r['owd']['evaluaciones'].' evaluaciones'],
                ['label' => 'Condiciones de salud con novedad', 'value' => $r['condiciones_salud']['con_novedad'], 'hint' => $r['condiciones_salud']['pct_con_novedad'].'% del total', 'tone' => $r['condiciones_salud']['con_novedad'] > 0 ? 'warn' : 'default'],
                ['label' => 'Encuestas de morbilidad', 'value' => $r['morbilidad']['completadas'], 'hint' => $r['morbilidad']['total'].' iniciadas'],
            ],
            'tendencia' => collect($r['alcoholimetria']['serie_mensual'])
                ->map(fn ($fila) => ['periodo' => $fila['periodo'], 'total' => $fila['total'], 'serie2' => $fila['positivas'] ?? 0])
                ->values(),
            'tendencia_titulo' => 'Pruebas de alcoholemia por mes',
            'tendencia_series' => [
                ['key' => 'total', 'label' => 'Realizadas', 'color' => '#3F7A22'],
                ['key' => 'serie2', 'label' => 'Positivas', 'color' => '#D4102A'],
            ],
            'pendientes' => [
                ['label' => 'Alertas sin atender', 'value' => $r['alertas']['abiertas'], 'href' => '/modules/seguridad/alertas', 'tone' => 'warn'],
                ['label' => 'ACIS pendientes de asignar', 'value' => $acisPendientes, 'href' => '/modules/seguridad/acis', 'tone' => 'warn'],
                ['label' => 'Planes de acción OWD vencidos', 'value' => $r['owd']['planes_accion_vencidos'], 'href' => '/modules/seguridad/planes-accion-owd', 'tone' => 'bad'],
                ['label' => 'Exámenes médicos por vencer (30 días)', 'value' => $r['examenes_medicos']['proximos_a_vencer'], 'href' => '/modules/seguridad/examenes-medicos', 'tone' => 'warn'],
                ['label' => 'Dispositivos por calibrar (15 días)', 'value' => $r['alcoholimetria']['calibraciones_por_vencer'], 'href' => '/modules/seguridad/dispositivos', 'tone' => 'warn'],
            ],
        ];
    }

    // ── Reparto ──────────────────────────────────────────────────────────────

    private function reparto(Carbon $desde, Carbon $hasta): array
    {
        [$ini, $fin] = $this->limites($desde, $hasta);

        $modulaciones = Modulacion::query()
            ->whereBetween('fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->get(['fecha']);

        $eventos = EventosTripulacion::query()
            ->whereNotNull('fecha')
            ->whereBetween('fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->get(['fecha', 'total_eventos', 'excesos_tiempo_ruta', 'alertas_velocidad_curvas', 'adherencia_tiempo']);

        $porques = CincoPorque::query()
            ->whereBetween('fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->get(['fecha']);

        $porquesSinPlan = CincoPorque::query()
            ->where(fn ($q) => $q->whereNull('plan_accion')->orWhere('plan_accion', ''))
            ->count();

        // excesos_tiempo_ruta dejó de ser un conteo: ahora guarda la hora del
        // día tal cual viene del Excel (ej. "07:47:00 a. m."). Un registro
        // "tiene exceso" si el campo trae algo distinto de vacío/cero.
        $tieneExceso = static fn ($valor): bool => filled($valor)
            && ! in_array(trim((string) $valor), ['0', '00:00', '0:00', '00:00:00', '0:00:00'], true);

        $eventosConExceso = EventosTripulacion::query()
            ->whereNotNull('fecha')
            ->whereBetween('fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->whereNotNull('excesos_tiempo_ruta')
            ->whereNotIn('excesos_tiempo_ruta', ['', '0', '00:00', '00:00:00', '0:00:00'])
            ->count();

        $excesosRuta = $eventos->filter(fn ($e) => $tieneExceso($e->excesos_tiempo_ruta))->count();
        $adherenciaProm = $eventos->whereNotNull('adherencia_tiempo')->avg('adherencia_tiempo');

        return [
            'titulo' => 'Reparto',
            'href' => '/modules/reparto',
            'kpis' => [
                ['label' => 'Planeaciones de ruta', 'value' => $modulaciones->count(), 'hint' => 'en el rango'],
                ['label' => '5 Por Qué registrados', 'value' => $porques->count(), 'hint' => 'en el rango'],
                ['label' => 'Eventos de tripulación', 'value' => (int) $eventos->sum('total_eventos'), 'hint' => 'total acumulado'],
                ['label' => 'Registros con exceso de tiempo', 'value' => $excesosRuta, 'tone' => $excesosRuta > 0 ? 'warn' : 'good'],
                ['label' => 'Alertas de velocidad en curva', 'value' => (int) $eventos->sum('alertas_velocidad_curvas'), 'tone' => $eventos->sum('alertas_velocidad_curvas') > 0 ? 'warn' : 'good'],
                ['label' => 'Adherencia al tiempo prom.', 'value' => $adherenciaProm !== null ? round((float) $adherenciaProm, 1) : 0, 'suffix' => '%', 'decimals' => 1],
            ],
            'tendencia' => $this->serieMensual($desde, $hasta, [
                'total' => $modulaciones->groupBy(fn ($m) => Carbon::parse($m->fecha)->format('Y-m')),
                'serie2' => $porques->groupBy(fn ($p) => Carbon::parse($p->fecha)->format('Y-m')),
            ]),
            'tendencia_titulo' => 'Planeaciones y 5 Por Qué por mes',
            'tendencia_series' => [
                ['key' => 'total', 'label' => 'Planeaciones', 'color' => '#D4102A'],
                ['key' => 'serie2', 'label' => '5 Por Qué', 'color' => '#B45309'],
            ],
            'pendientes' => [
                ['label' => '5 Por Qué sin plan de acción', 'value' => $porquesSinPlan, 'href' => '/cinco-porques', 'tone' => 'warn'],
                ['label' => 'Registros con exceso de tiempo en ruta', 'value' => $eventosConExceso, 'href' => '/modules/reparto/eventos-tripulacion', 'tone' => 'warn'],
            ],
        ];
    }

    // ── Gente ────────────────────────────────────────────────────────────────

    private function gente(Carbon $desde, Carbon $hasta): array
    {
        $ausentismos = Ausentismo::query()
            ->whereBetween('fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->get(['fecha']);

        $sacRango = Sac::query()
            ->whereBetween('fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->get(['fecha']);

        $sacAbiertos = Sac::query()->whereNull('fecha_resuelto')->count();
        $sacResueltos = Sac::query()
            ->whereNotNull('fecha_resuelto')
            ->whereBetween('fecha_resuelto', [$desde->toDateString(), $hasta->toDateString()])
            ->count();

        $correcciones = CorreccionMarcacion::query()
            ->whereBetween('fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->count();
        $correccionesSinColaborador = CorreccionMarcacion::query()->where('colaborador_encontrado', false)->count();

        return [
            'titulo' => 'Gente',
            'href' => '/modules/gente',
            'kpis' => [
                ['label' => 'Colaboradores registrados', 'value' => Colaborador::query()->count()],
                ['label' => 'Ausentismos', 'value' => $ausentismos->count(), 'hint' => 'en el rango'],
                ['label' => 'SAC abiertos', 'value' => $sacAbiertos, 'tone' => $sacAbiertos > 0 ? 'warn' : 'good'],
                ['label' => 'SAC resueltos', 'value' => $sacResueltos, 'hint' => 'en el rango', 'tone' => 'good'],
                ['label' => 'Correcciones de marcación', 'value' => $correcciones, 'hint' => 'en el rango'],
                ['label' => 'Correcciones sin colaborador', 'value' => $correccionesSinColaborador, 'tone' => $correccionesSinColaborador > 0 ? 'warn' : 'good'],
            ],
            'tendencia' => $this->serieMensual($desde, $hasta, [
                'total' => $ausentismos->groupBy(fn ($a) => Carbon::parse($a->fecha)->format('Y-m')),
                'serie2' => $sacRango->groupBy(fn ($s) => Carbon::parse($s->fecha)->format('Y-m')),
            ]),
            'tendencia_titulo' => 'Ausentismos y SAC por mes',
            'tendencia_series' => [
                ['key' => 'total', 'label' => 'Ausentismos', 'color' => '#E3A11E'],
                ['key' => 'serie2', 'label' => 'SAC', 'color' => '#0369A1'],
            ],
            'pendientes' => [
                ['label' => 'SAC sin resolver', 'value' => $sacAbiertos, 'href' => '/modules/gente/sac', 'tone' => 'warn'],
                ['label' => 'Correcciones sin colaborador identificado', 'value' => $correccionesSinColaborador, 'href' => '/modules/gente/correccion-marcaciones', 'tone' => 'warn'],
            ],
        ];
    }

    // ── Flota ────────────────────────────────────────────────────────────────

    private function flota(Carbon $desde, Carbon $hasta): array
    {
        $hoy = Carbon::today();
        $limiteSoat = $hoy->copy()->addDays((int) config('flota.dias_alerta_soat', 15));
        $limiteTecno = $hoy->copy()->addDays((int) config('flota.dias_alerta_tecnomecanica', 30));

        $vehiculos = Vehiculo::query()->get(['is_active', 'fecha_vencimiento_soat', 'fecha_vencimiento_tecnomecanica']);
        $activos = $vehiculos->where('is_active', true);

        $soatVencido = $activos->filter(fn ($v) => $v->fecha_vencimiento_soat && $v->fecha_vencimiento_soat->lt($hoy))->count();
        $soatPorVencer = $activos->filter(fn ($v) => $v->fecha_vencimiento_soat && $v->fecha_vencimiento_soat->gte($hoy) && $v->fecha_vencimiento_soat->lte($limiteSoat))->count();
        $tecnoVencido = $activos->filter(fn ($v) => $v->fecha_vencimiento_tecnomecanica && $v->fecha_vencimiento_tecnomecanica->lt($hoy))->count();
        $tecnoPorVencer = $activos->filter(fn ($v) => $v->fecha_vencimiento_tecnomecanica && $v->fecha_vencimiento_tecnomecanica->gte($hoy) && $v->fecha_vencimiento_tecnomecanica->lte($limiteTecno))->count();

        $varadas = Varada::query()
            ->whereBetween('fecha_reportada', [$desde->copy()->startOfDay(), $hasta->copy()->endOfDay()])
            ->get(['fecha_reportada', 'fecha_solucion']);
        $varadasAbiertas = Varada::query()->whereNull('fecha_solucion')->count();

        $actasEnTaller = ActaTaller::query()->where('estado_acta', ActaTaller::ESTADO_EN_TALLER)->count();

        return [
            'titulo' => 'Flota',
            'href' => '/modules/flota',
            'kpis' => [
                ['label' => 'Vehículos activos', 'value' => $activos->count(), 'hint' => $vehiculos->count().' en total'],
                ['label' => 'SOAT vencido o por vencer', 'value' => $soatVencido + $soatPorVencer, 'hint' => "$soatVencido vencidos · $soatPorVencer por vencer", 'tone' => $soatVencido > 0 ? 'bad' : ($soatPorVencer > 0 ? 'warn' : 'good')],
                ['label' => 'Tecnomecánica vencida o por vencer', 'value' => $tecnoVencido + $tecnoPorVencer, 'hint' => "$tecnoVencido vencidas · $tecnoPorVencer por vencer", 'tone' => $tecnoVencido > 0 ? 'bad' : ($tecnoPorVencer > 0 ? 'warn' : 'good')],
                ['label' => 'Varadas abiertas', 'value' => $varadasAbiertas, 'tone' => $varadasAbiertas > 0 ? 'bad' : 'good'],
                ['label' => 'Actas de taller en taller', 'value' => $actasEnTaller, 'tone' => $actasEnTaller > 0 ? 'warn' : 'good'],
                ['label' => 'Varadas reportadas', 'value' => $varadas->count(), 'hint' => 'en el rango'],
            ],
            'tendencia' => $this->serieMensual($desde, $hasta, [
                'total' => $varadas->groupBy(fn ($v) => Carbon::parse($v->fecha_reportada)->format('Y-m')),
                'serie2' => $varadas->filter(fn ($v) => $v->fecha_solucion)->groupBy(fn ($v) => Carbon::parse($v->fecha_solucion)->format('Y-m')),
            ]),
            'tendencia_titulo' => 'Varadas reportadas y solucionadas por mes',
            'tendencia_series' => [
                ['key' => 'total', 'label' => 'Reportadas', 'color' => '#2B6CB0'],
                ['key' => 'serie2', 'label' => 'Solucionadas', 'color' => '#3F7A22'],
            ],
            'pendientes' => [
                ['label' => 'SOAT vencido o por vencer', 'value' => $soatVencido + $soatPorVencer, 'href' => '/modules/flota/vehiculos', 'tone' => $soatVencido > 0 ? 'bad' : 'warn'],
                ['label' => 'Tecnomecánica vencida o por vencer', 'value' => $tecnoVencido + $tecnoPorVencer, 'href' => '/modules/flota/vehiculos', 'tone' => $tecnoVencido > 0 ? 'bad' : 'warn'],
                ['label' => 'Varadas abiertas', 'value' => $varadasAbiertas, 'href' => '/modules/flota/varadas', 'tone' => 'bad'],
                ['label' => 'Actas de taller abiertas', 'value' => $actasEnTaller, 'href' => '/modules/flota/actas-taller', 'tone' => 'warn'],
            ],
        ];
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** @return array{0: Carbon, 1: Carbon} */
    private function limites(Carbon $desde, Carbon $hasta): array
    {
        return [$desde->copy()->startOfDay(), $hasta->copy()->endOfDay()];
    }

    /**
     * Construye la serie mensual (YYYY-MM) del rango con una o varias métricas.
     * Cada métrica es una colección ya agrupada por período (`groupBy('Y-m')`);
     * el valor de cada mes es el conteo del grupo.
     *
     * @param  array<string, Collection<string, Collection<int, mixed>>>  $metricas
     */
    private function serieMensual(Carbon $desde, Carbon $hasta, array $metricas): Collection
    {
        $periodos = [];
        $cursor = $desde->copy()->startOfMonth();
        $fin = $hasta->copy()->startOfMonth();
        while ($cursor->lte($fin) && count($periodos) < 24) {
            $periodos[] = $cursor->format('Y-m');
            $cursor->addMonth();
        }

        return collect($periodos)->map(function (string $periodo) use ($metricas) {
            $fila = ['periodo' => $periodo];
            foreach ($metricas as $clave => $grupos) {
                $fila[$clave] = $grupos->get($periodo)?->count() ?? 0;
            }

            return $fila;
        });
    }
}
