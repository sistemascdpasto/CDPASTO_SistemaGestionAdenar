<?php

namespace App\Services\Seguridad;

use App\Models\Seguridad\Aci;
use App\Models\Seguridad\Alcoholimetro;
use App\Models\Seguridad\Alerta;
use App\Models\Seguridad\CondicionSalud;
use App\Models\Seguridad\EncuestaMorbilidad;
use App\Models\Seguridad\EvaluacionMedica;
use App\Models\Seguridad\EvaluacionOwd;
use App\Models\Seguridad\EvaluacionRecomendacion;
use App\Models\Seguridad\PlanAccionOwd;
use App\Models\Seguridad\PruebaAlcoholemia;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Agrega KPIs, series de tiempo y desgloses de todos los módulos del pilar de
 * Seguridad para el "Tablero de Indicadores". Todo lo que tiene fecha propia se
 * filtra por el rango [desde, hasta]; los indicadores "a hoy" (dispositivos por
 * vencer, planes de acción vencidos, etc.) no dependen del rango.
 */
class IndicadoresSeguridadService
{
    private const DIAS_ALERTA_CALIBRACION = 15;

    private const DIAS_ALERTA_EXAMEN = 30;

    public function resumen(Carbon $desde, Carbon $hasta): array
    {
        return [
            'rango' => ['desde' => $desde->toDateString(), 'hasta' => $hasta->toDateString()],
            'alcoholimetria' => $this->alcoholimetria($desde, $hasta),
            'acis' => $this->acis($desde, $hasta),
            'owd' => $this->owd($desde, $hasta),
            'examenes_medicos' => $this->examenesMedicos($desde, $hasta),
            'condiciones_salud' => $this->condicionesSalud($desde, $hasta),
            'morbilidad' => $this->morbilidad($desde, $hasta),
            'alertas' => $this->alertas($desde, $hasta),
        ];
    }

    private function alcoholimetria(Carbon $desde, Carbon $hasta): array
    {
        $umbral = (float) config('seguridad.umbral_positivo', 0);

        $pruebas = PruebaAlcoholemia::query()
            ->whereBetween('fecha_hora', [$desde->copy()->startOfDay(), $hasta->copy()->endOfDay()])
            ->get(['fecha_hora', 'tipo', 'resultado', 'estado']);

        $realizadas = $pruebas->where('estado', 'realizada');
        $positivas = $realizadas->filter(fn ($p) => $p->resultado !== null && (float) $p->resultado > $umbral);

        $tipoLabels = ['pre_ruta' => 'Pre Ruta', 'ruta' => 'Ruta', 'post_ruta' => 'Post Ruta', 'jl' => 'JL', 'segundo_viaje' => 'Segundo viaje'];
        $porTipo = collect($tipoLabels)
            ->map(fn ($label, $key) => ['tipo' => $label, 'total' => $realizadas->where('tipo', $key)->count()])
            ->values();

        $dispositivos = Alcoholimetro::query()->get(['estado', 'fecha_calibracion', 'fecha_vencimiento_certificado']);
        $limiteCalibracion = now()->addDays(self::DIAS_ALERTA_CALIBRACION);

        return [
            'total_pruebas' => $pruebas->count(),
            'realizadas' => $realizadas->count(),
            'programadas' => $pruebas->where('estado', 'programada')->count(),
            'positivas' => $positivas->count(),
            'pct_positivas' => $this->pct($positivas->count(), $realizadas->count()),
            'por_tipo' => $porTipo,
            'serie_mensual' => $this->serieMensual($realizadas, 'fecha_hora', $desde, $hasta, [
                'positivas' => fn (Collection $g) => $g->filter(fn ($p) => $p->resultado !== null && (float) $p->resultado > $umbral)->count(),
            ]),
            'dispositivos_por_estado' => $this->conteoPor($dispositivos, 'estado'),
            'dispositivos_total' => $dispositivos->count(),
            'calibraciones_por_vencer' => $dispositivos->filter(fn ($d) => (
                ($d->fecha_calibracion && $d->fecha_calibracion->lte($limiteCalibracion))
                || ($d->fecha_vencimiento_certificado && $d->fecha_vencimiento_certificado->lte($limiteCalibracion))
            ))->count(),
        ];
    }

    private function acis(Carbon $desde, Carbon $hasta): array
    {
        $acis = Aci::query()
            ->whereBetween('fecha_incidente', [$desde->toDateString(), $hasta->toDateString()])
            ->get(['fecha_incidente', 'area', 'clasificacion', 'estatus_asignacion', 'reporte_de']);

        return [
            'total' => $acis->count(),
            'serie_mensual' => $this->serieMensual($acis, 'fecha_incidente', $desde, $hasta),
            'por_area' => $this->conteoPor($acis, 'area', 8),
            'por_clasificacion' => $this->conteoPor($acis, 'clasificacion', 8),
            'por_estatus' => $this->conteoPor($acis, 'estatus_asignacion'),
            'por_tipo_reporte' => $this->conteoPor($acis, 'reporte_de'),
        ];
    }

    private function owd(Carbon $desde, Carbon $hasta): array
    {
        $evals = EvaluacionOwd::query()
            ->whereBetween('fecha_evaluacion', [$desde->copy()->startOfDay(), $hasta->copy()->endOfDay()])
            ->get(['fecha_evaluacion', 'pillar', 'total_preguntas', 'preguntas_ok', 'preguntas_no_ok']);

        $ok = (int) $evals->sum('preguntas_ok');
        $noOk = (int) $evals->sum('preguntas_no_ok');

        $planes = PlanAccionOwd::query()->get(['estado', 'fecha_vencimiento']);

        return [
            'evaluaciones' => $evals->count(),
            'preguntas_ok' => $ok,
            'preguntas_no_ok' => $noOk,
            'pct_cumplimiento' => $this->pct($ok, $ok + $noOk),
            'serie_mensual' => $this->serieMensual($evals, 'fecha_evaluacion', $desde, $hasta, [
                'no_conformes' => fn (Collection $g) => (int) $g->sum('preguntas_no_ok'),
            ]),
            'por_pilar' => $this->conteoPor($evals, 'pillar', 8),
            'planes_accion_total' => $planes->count(),
            'planes_accion_abiertos' => $planes->where('estado', '!=', PlanAccionOwd::ESTADO_COMPLETADO)->count(),
            'planes_accion_vencidos' => $planes->filter(fn ($p) => $p->vencido)->count(),
        ];
    }

    private function examenesMedicos(Carbon $desde, Carbon $hasta): array
    {
        $evals = EvaluacionMedica::query()
            ->with('conceptoAptitud:id,nombre')
            ->whereBetween('fecha_evaluacion', [$desde->toDateString(), $hasta->toDateString()])
            ->get(['id', 'fecha_evaluacion', 'concepto_aptitud_id', 'proximo_examen_fecha', 'estado']);

        $limiteExamen = now()->addDays(self::DIAS_ALERTA_EXAMEN);

        $recomendaciones = EvaluacionRecomendacion::query()->where('activa', true)->count();
        $recomendacionesAtendidas = EvaluacionRecomendacion::query()
            ->where('activa', true)
            ->whereHas('seguimientos', fn ($q) => $q->where('estado_seguimiento', 'Atendida'))
            ->count();

        return [
            'total' => $evals->count(),
            'por_concepto' => $evals
                ->groupBy(fn ($e) => $e->conceptoAptitud->nombre ?? 'Sin concepto')
                ->map->count()
                ->sortDesc()
                ->map(fn ($total, $label) => ['label' => $label, 'total' => $total])
                ->values(),
            'proximos_a_vencer' => EvaluacionMedica::query()
                ->whereNotNull('proximo_examen_fecha')
                ->whereDate('proximo_examen_fecha', '<=', $limiteExamen)
                ->count(),
            'recomendaciones_activas' => $recomendaciones,
            'recomendaciones_pendientes' => max(0, $recomendaciones - $recomendacionesAtendidas),
        ];
    }

    private function condicionesSalud(Carbon $desde, Carbon $hasta): array
    {
        $registros = CondicionSalud::query()
            ->whereBetween('fecha_hora', [$desde->copy()->startOfDay(), $hasta->copy()->endOfDay()])
            ->get(['fecha_hora', 'estado', 'momento']);

        $conNovedad = $registros->whereIn('estado', ['Regular', 'Malo'])->count();

        return [
            'total' => $registros->count(),
            'con_novedad' => $conNovedad,
            'pct_con_novedad' => $this->pct($conNovedad, $registros->count()),
            'por_estado' => collect(['Bueno', 'Regular', 'Malo'])
                ->map(fn ($estado) => ['label' => $estado, 'total' => $registros->where('estado', $estado)->count()])
                ->values(),
            'serie_mensual' => $this->serieMensual($registros, 'fecha_hora', $desde, $hasta, [
                'con_novedad' => fn (Collection $g) => $g->whereIn('estado', ['Regular', 'Malo'])->count(),
            ]),
        ];
    }

    private function morbilidad(Carbon $desde, Carbon $hasta): array
    {
        $encuestas = EncuestaMorbilidad::query()
            ->whereBetween('fecha_hora', [$desde->copy()->startOfDay(), $hasta->copy()->endOfDay()])
            ->get(['fecha_hora', 'estado']);

        return [
            'total' => $encuestas->count(),
            'completadas' => $encuestas->where('estado', EncuestaMorbilidad::ESTADO_COMPLETADA)->count(),
            'borradores' => $encuestas->where('estado', EncuestaMorbilidad::ESTADO_BORRADOR)->count(),
            'serie_mensual' => $this->serieMensual($encuestas, 'fecha_hora', $desde, $hasta),
        ];
    }

    private function alertas(Carbon $desde, Carbon $hasta): array
    {
        $alertas = Alerta::query()
            ->whereBetween('created_at', [$desde->copy()->startOfDay(), $hasta->copy()->endOfDay()])
            ->get(['tipo', 'atendida', 'created_at']);

        return [
            'total' => $alertas->count(),
            'abiertas' => $alertas->where('atendida', false)->count(),
            'atendidas' => $alertas->where('atendida', true)->count(),
            'por_tipo' => $alertas
                ->groupBy('tipo')
                ->map->count()
                ->sortDesc()
                ->map(fn ($total, $tipo) => ['label' => $tipo, 'total' => $total])
                ->values(),
        ];
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function pct(int $parte, int $total): float
    {
        return $total > 0 ? round(($parte / $total) * 100, 1) : 0.0;
    }

    /**
     * @param  Collection<int, Model>  $items
     */
    private function conteoPor(Collection $items, string $campo, ?int $limite = null): Collection
    {
        $conteo = $items
            ->groupBy(fn ($item) => filled($item->{$campo}) ? (string) $item->{$campo} : 'Sin dato')
            ->map->count()
            ->sortDesc()
            ->map(fn ($total, $label) => ['label' => $label, 'total' => $total])
            ->values();

        return $limite ? $conteo->take($limite) : $conteo;
    }

    /**
     * Serie mensual (YYYY-MM) con un conteo base y métricas extra opcionales.
     *
     * @param  Collection<int, Model>  $items
     * @param  array<string, callable(Collection): int>  $extra
     */
    private function serieMensual(Collection $items, string $campoFecha, Carbon $desde, Carbon $hasta, array $extra = []): Collection
    {
        $porMes = $items->groupBy(fn ($item) => Carbon::parse($item->{$campoFecha})->format('Y-m'));

        $periodos = [];
        $cursor = $desde->copy()->startOfMonth();
        $fin = $hasta->copy()->startOfMonth();
        // Tope de seguridad: máximo 24 meses en la serie.
        while ($cursor->lte($fin) && count($periodos) < 24) {
            $periodos[] = $cursor->format('Y-m');
            $cursor->addMonth();
        }

        return collect($periodos)->map(function (string $periodo) use ($porMes, $extra) {
            $grupo = $porMes->get($periodo, collect());
            $fila = ['periodo' => $periodo, 'total' => $grupo->count()];

            foreach ($extra as $clave => $callback) {
                $fila[$clave] = $callback($grupo);
            }

            return $fila;
        });
    }
}
