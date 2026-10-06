<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\ChecklistPlanPremiacion;
use App\Models\Seguridad\Aci;
use App\Models\Seguridad\Colaborador;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PlanPremiacionController extends Controller
{
    public const META_BASE = 32;

    /** Umbral de adherencia (%) para aprobar cada checklist (Pre y Post). */
    public const UMBRAL_CHECKLIST = 90;

    public function index(Request $request): Response
    {
        $mes  = $request->integer('mes')  ?: (int) now()->month;
        $anio = $request->integer('anio') ?: (int) now()->year;
        $search      = $request->string('search')->trim()->toString();
        $filtroCargo = $request->string('cargo')->trim()->toString();
        $filtroEstado = $request->string('estado')->trim()->toString();
        $mesesChecklistStr = $request->string('meses_checklist')->trim()->toString();

        $cargosDisponibles = Colaborador::query()
            ->where('is_active', true)
            ->whereRaw("LOWER(TRIM(area)) = 'operativa'")
            ->whereNotNull('cargo')
            ->where('cargo', '!=', '')
            ->distinct()
            ->pluck('cargo')
            ->sort()
            ->values()
            ->toArray();

        ['todosCalculados' => $todosCalculados, 'totalAcisMes' => $totalAcisMes] =
            $this->buildFilasFinales($mes, $anio, $search, $filtroCargo, $mesesChecklistStr);

        $totalPoblacion        = $todosCalculados->count();
        $cumplenMetaCount      = $todosCalculados->where('cumple', true)->count();
        $enProgresoCount       = $todosCalculados->where('estado', 'en_progreso')->count();
        $sinParticipacionCount = $todosCalculados->where('estado', 'sin_participacion')->count();
        $promedioPorcentaje    = $totalPoblacion > 0 ? round($todosCalculados->avg('porcentaje'), 1) : 0.0;

        $top3    = $todosCalculados->sortByDesc('calificacion_total')->values()->take(3)->all();
        $peores2 = $todosCalculados->sortBy('calificacion_total')->values()->take(2)->all();

        $filasFiltradas = $todosCalculados;
        if (in_array($filtroEstado, ['meta_alcanzada', 'en_progreso', 'sin_participacion'], true)) {
            $filasFiltradas = $filasFiltradas->where('estado', $filtroEstado)->values();
        }

        $filasFinales = $filasFiltradas->sortByDesc('calificacion_total')->values()->all();

        return Inertia::render('gente/plan-premiacion/index', [
            'colaboradores' => $filasFinales,
            'resumen' => [
                'meta_base'            => self::META_BASE,
                'total_colaboradores'  => $totalPoblacion,
                'total_acis_mes'       => $totalAcisMes,
                'cumplen_meta'         => $cumplenMetaCount,
                'en_progreso'          => $enProgresoCount,
                'sin_participacion'    => $sinParticipacionCount,
                'promedio_porcentaje'  => $promedioPorcentaje,
            ],
            'top3'    => $top3,
            'peores2' => $peores2,
            'cargos'  => $cargosDisponibles,
            'umbral_checklist' => self::UMBRAL_CHECKLIST,
            'puede_editar' => $request->user()?->hasAnyRole(['Administrador', 'Gente']) ?? false,
            'filters' => [
                'mes'             => $mes,
                'anio'            => $anio,
                'search'          => $search,
                'estado'          => $filtroEstado,
                'cargo'           => $filtroCargo,
                'meses_checklist' => $mesesChecklistStr,
            ],
        ]);
    }

    /**
     * Calcula todas las filas del Plan Premiación para un período dado.
     * Usado tanto por index() (vista web) como por exportar() (Excel),
     * garantizando que ambos muestren exactamente los mismos datos.
     *
     * @return array{todosCalculados: \Illuminate\Support\Collection, totalAcisMes: int}
     */
    private function buildFilasFinales(
        int $mes,
        int $anio,
        string $search = '',
        string $filtroCargo = '',
        string $mesesChecklistStr = ''
    ): array {
        $cargosSeleccionados = array_values(array_filter(
            array_map('trim', explode(',', $filtroCargo)),
            fn ($c) => $c !== '' && $c !== 'todos'
        ));

        $mesesSeleccionados = array_values(array_filter(
            array_map('intval', explode(',', $mesesChecklistStr)),
            fn ($m) => $m >= 1 && $m <= 12
        ));
        if (empty($mesesSeleccionados)) {
            $mesesSeleccionados = [$mes];
        }
        $mesesChecklist = $mesesSeleccionados;

        // 1. Colaboradores activos del área Operativa
        $queryColaboradores = Colaborador::query()
            ->where('is_active', true)
            ->whereRaw("LOWER(TRIM(area)) = 'operativa'")
            ->select(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'area', 'codigo_qr_skap']);

        if (!empty($cargosSeleccionados)) {
            $queryColaboradores->whereIn('cargo', $cargosSeleccionados);
        }

        if ($search !== '') {
            $queryColaboradores->where(function ($q) use ($search) {
                $q->where('nombres', 'like', "%{$search}%")
                  ->orWhere('apellidos', 'like', "%{$search}%")
                  ->orWhere('cedula', 'like', "%{$search}%")
                  ->orWhere('cargo', 'like', "%{$search}%")
                  ->orWhere('area', 'like', "%{$search}%")
                  ->orWhereRaw("CONCAT(nombres, ' ', apellidos) LIKE ?", ["%{$search}%"])
                  ->orWhereRaw("CONCAT(apellidos, ' ', nombres) LIKE ?", ["%{$search}%"]);
            });
        }

        $colaboradores = $queryColaboradores->get();

        $isSqlite   = DB::connection()->getDriverName() === 'sqlite';
        $monthExpr  = fn (string $col) => $isSqlite
            ? DB::raw("cast(strftime('%m', {$col}) as integer)")
            : DB::raw("MONTH({$col})");

        // 2. Conteo de ACIs
        $conteosPorColaborador = Aci::whereIn($monthExpr('fecha_incidente'), $mesesSeleccionados)
            ->whereYear('fecha_incidente', $anio)
            ->whereNotNull('colaborador_id')
            ->select('colaborador_id', DB::raw('count(*) as total'))
            ->groupBy('colaborador_id')
            ->pluck('total', 'colaborador_id');

        // 3. OWD Ruta
        $preguntasRutaRaw = DB::table('evaluacion_owd_preguntas')
            ->join('evaluaciones_owd', 'evaluacion_owd_preguntas.evaluacion_owd_id', '=', 'evaluaciones_owd.id')
            ->whereIn($monthExpr('evaluaciones_owd.fecha_evaluacion'), $mesesSeleccionados)
            ->whereYear('evaluaciones_owd.fecha_evaluacion', $anio)
            ->where(function ($q) {
                $q->whereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = 'ruta'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '\"ruta\"'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '[\"ruta\"]'");
            })
            ->select('evaluaciones_owd.colaborador_id', 'evaluaciones_owd.qr_safety', 'evaluacion_owd_preguntas.puntuacion')
            ->get();

        $colaboradoresPorQrOwd = Colaborador::whereNotNull('codigo_qr_skap')
            ->select(['id', 'codigo_qr_skap'])->get()->keyBy('codigo_qr_skap');

        $preguntasRutaPorColaborador = $preguntasRutaRaw->groupBy(function ($p) use ($colaboradoresPorQrOwd) {
            if ($p->colaborador_id) return $p->colaborador_id;
            $colab = $colaboradoresPorQrOwd->get($p->qr_safety);
            return $colab ? $colab->id : null;
        })->filter(fn ($grupo, $key) => $key !== null);

        // 4. Calificaciones
        $promediosCalificaciones = DB::table('colaborador_calificaciones')
            ->whereNotNull('nota_modulo')
            ->select('identificacion', DB::raw('AVG(nota_modulo) as promedio_nota'))
            ->groupBy('identificacion')
            ->pluck('promedio_nota', 'identificacion');

        // 5. DPO Academy — solo datos del período
        $normStr = function ($txt) {
            $str = mb_strtoupper(trim((string) $txt), 'UTF-8');
            $str = str_replace(['Á','É','Í','Ó','Ú','Ü','Ñ'], ['A','E','I','O','U','U','N'], $str);
            return preg_replace('/[^A-Z0-9]/', '', $str) ?? $str;
        };

        $registrosDpo = DB::table('dpo_academy')
            ->whereIn('mes', $mesesSeleccionados)
            ->where('anio', $anio)
            ->select(['colaborador_id', 'qr_safety', 'nombre'])
            ->get();

        $dpoColaboradorIds = $registrosDpo->pluck('colaborador_id')->filter()->unique()->flip()->toArray();
        $dpoQrSafetySet = [];
        $dpoNombresSet  = [];
        foreach ($registrosDpo as $r) {
            if ($r->qr_safety) $dpoQrSafetySet[$normStr($r->qr_safety)] = true;
            if ($r->nombre)    $dpoNombresSet[$normStr($r->nombre)]      = true;
        }

        // 6. Malas Marcaciones — solo datos del período
        $correccionesQuery = DB::table('correcciones_marcaciones')
            ->whereIn($monthExpr('fecha'), $mesesSeleccionados)
            ->whereYear('fecha', $anio)
            ->get(['identificacion', 'nombre_completo']);

        $malasMarcacionesIdentificacionesSet = [];
        $malasMarcacionesNombresSet          = [];
        foreach ($correccionesQuery as $r) {
            if (!empty($r->identificacion))  $malasMarcacionesIdentificacionesSet[$normStr($r->identificacion)]  = true;
            if (!empty($r->nombre_completo)) $malasMarcacionesNombresSet[$normStr($r->nombre_completo)]          = true;
        }

        // 8. Eventos Tripulación — solo datos del período
        $eventosTripulacionRaw = DB::table('eventos_tripulacion')
            ->when(
                !empty($mesesChecklist),
                fn ($q) => $q->whereIn($monthExpr('fecha'), $mesesChecklist)->whereYear('fecha', $anio),
                fn ($q) => $q->whereYear('fecha', $anio)
            )
            ->get(['documento','nombre','rechazos','adherencia_tiempo','rmd','adherencia_checklist_pre','adherencia_checklist_post']);

        $rechazosPorDocumento = []; $rechazosPorNombre = [];
        $adherenciaTiempoPorDocumento = []; $adherenciaTiempoPorNombre = [];
        $rmdPorDocumento = []; $rmdPorNombre = [];
        $checklistPrePorDocumento = []; $checklistPrePorNombre = [];
        $checklistPostPorDocumento = []; $checklistPostPorNombre = [];

        foreach ($eventosTripulacionRaw as $row) {
            $docKey = !empty($row->documento) ? $normStr($row->documento) : null;
            $nomKey = !empty($row->nombre)    ? $normStr($row->nombre)    : null;

            if ($row->rechazos !== null) {
                $val = (float) $row->rechazos;
                if ($docKey) $rechazosPorDocumento[$docKey][] = $val;
                if ($nomKey) $rechazosPorNombre[$nomKey][]    = $val;
            }
            if ($row->adherencia_tiempo !== null) {
                $val = (float) $row->adherencia_tiempo;
                if ($docKey) $adherenciaTiempoPorDocumento[$docKey][] = $val;
                if ($nomKey) $adherenciaTiempoPorNombre[$nomKey][]    = $val;
            }
            if ($row->rmd !== null && is_numeric($row->rmd)) {
                $val = (float) $row->rmd;
                if ($docKey) $rmdPorDocumento[$docKey][] = $val;
                if ($nomKey) $rmdPorNombre[$nomKey][]    = $val;
            }
            if ($row->adherencia_checklist_pre !== null) {
                $val = (float) $row->adherencia_checklist_pre;
                if ($docKey) $checklistPrePorDocumento[$docKey][] = $val;
                if ($nomKey) $checklistPrePorNombre[$nomKey][]    = $val;
            }
            if ($row->adherencia_checklist_post !== null) {
                $val = (float) $row->adherencia_checklist_post;
                if ($docKey) $checklistPostPorDocumento[$docKey][] = $val;
                if ($nomKey) $checklistPostPorNombre[$nomKey][]    = $val;
            }
        }

        // 9. SAC — solo datos del período
        $sacRaw = DB::table('sac')
            ->whereIn($monthExpr('fecha'), $mesesSeleccionados)
            ->whereYear('fecha', $anio)
            ->get(['colaborador_id', 'responsable', 'cumplimiento_cierre', 'aplica']);

        $sacPorColaboradorId = [];
        $sacPorResponsable   = [];
        foreach ($sacRaw as $row) {
            $cumplio = false;
            if (!empty($row->cumplimiento_cierre)) {
                $c = mb_strtoupper(trim($row->cumplimiento_cierre), 'UTF-8');
                if (str_contains($c, 'TIEMPO') || str_contains($c, 'SI') || str_contains($c, '100')) {
                    $cumplio = true;
                }
            }
            $val = $cumplio ? 100.0 : 0.0;
            if (!empty($row->colaborador_id)) $sacPorColaboradorId[$row->colaborador_id][] = $val;
            if (!empty($row->responsable))    $sacPorResponsable[$normStr($row->responsable)][] = $val;
        }

        $totalAcisMes = Aci::whereMonth('fecha_incidente', $mes)
            ->whereYear('fecha_incidente', $anio)
            ->count();

        // 10. Checklists manuales
        $checklistsManuales = ChecklistPlanPremiacion::whereIn('colaborador_id', $colaboradores->pluck('id'))
            ->where('mes', $mes)
            ->where('anio', $anio)
            ->get()
            ->keyBy('colaborador_id');

        // 11. Procesar datos por colaborador
        $todosCalculados = $colaboradores->map(function ($colaborador) use (
            $conteosPorColaborador, $preguntasRutaPorColaborador, $promediosCalificaciones,
            $dpoColaboradorIds, $dpoQrSafetySet, $dpoNombresSet,
            $malasMarcacionesIdentificacionesSet, $malasMarcacionesNombresSet,
            $rechazosPorDocumento, $rechazosPorNombre,
            $adherenciaTiempoPorDocumento, $adherenciaTiempoPorNombre,
            $rmdPorDocumento, $rmdPorNombre,
            $checklistPrePorDocumento, $checklistPrePorNombre,
            $checklistPostPorDocumento, $checklistPostPorNombre,
            $sacPorColaboradorId, $sacPorResponsable,
            $checklistsManuales, $normStr
        ) {
            $aciRealizadas = (int) ($conteosPorColaborador[$colaborador->id] ?? 0);
            $porcentaje    = min(100.0, round(($aciRealizadas / self::META_BASE) * 100, 1));
            $faltantes     = max(0, self::META_BASE - $aciRealizadas);
            $cumple        = $aciRealizadas >= self::META_BASE;
            $estadoStr     = $cumple ? 'meta_alcanzada' : ($aciRealizadas > 0 ? 'en_progreso' : 'sin_participacion');

            // OWD Ruta — binario
            $preguntasRuta   = $preguntasRutaPorColaborador->get($colaborador->id, collect());
            $okRuta          = $preguntasRuta->filter(fn ($p) => str_contains(strtolower((string) $p->puntuacion), 'ok') && !str_contains(strtolower((string) $p->puntuacion), 'no ok') && !str_contains(strtolower((string) $p->puntuacion), 'not'))->count();
            $noOkRuta        = $preguntasRuta->filter(fn ($p) => str_contains(strtolower((string) $p->puntuacion), 'no ok') || str_contains(strtolower((string) $p->puntuacion), 'nook'))->count();
            $totalAplicables = $okRuta + $noOkRuta;

            if ($totalAplicables > 0) {
                $porcentajeOwdRuta      = $noOkRuta > 0 ? 0.0 : 100.0;
                $porcentajeOwdRutaLabel = "{$porcentajeOwdRuta}%";
            } else {
                $porcentajeOwdRuta      = null;
                $porcentajeOwdRutaLabel = 'N/A';
            }

            // Calificaciones
            $promedioCalificacionRaw = $promediosCalificaciones[$colaborador->cedula] ?? null;
            if ($promedioCalificacionRaw !== null) {
                $promedioCalificacion      = round((float) $promedioCalificacionRaw, 1);
                $promedioCalificacionLabel = "{$promedioCalificacion}%";
            } else {
                $promedioCalificacion      = null;
                $promedioCalificacionLabel = 'N/A';
            }

            // DPO
            $estaEnDpo = isset($dpoColaboradorIds[$colaborador->id]);
            if (!$estaEnDpo && !empty($colaborador->codigo_qr_skap)) $estaEnDpo = isset($dpoQrSafetySet[$normStr($colaborador->codigo_qr_skap)]);
            if (!$estaEnDpo && !empty($colaborador->cedula))          $estaEnDpo = isset($dpoQrSafetySet[$normStr($colaborador->cedula)]) || isset($dpoNombresSet[$normStr($colaborador->cedula)]);
            if (!$estaEnDpo && !empty($colaborador->nombre_completo)) $estaEnDpo = isset($dpoNombresSet[$normStr($colaborador->nombre_completo)]);
            $porcentajeDpo      = $estaEnDpo ? 0.0 : 100.0;
            $porcentajeDpoLabel = $estaEnDpo ? '0%' : '100%';

            // Ausentismo
            $manualAusentismo       = $checklistsManuales->get($colaborador->id);
            $ausentismoAprobado     = $manualAusentismo ? (bool) $manualAusentismo->ausentismo_ok : true;
            $porcentajeAusentismo   = $ausentismoAprobado ? 100.0 : 0.0;
            $porcentajeAusentismoLabel = $ausentismoAprobado ? '100%' : '0%';

            // Malas Marcaciones
            $estaEnMalasMarcaciones = false;
            if (!empty($colaborador->cedula))           $estaEnMalasMarcaciones = isset($malasMarcacionesIdentificacionesSet[$normStr($colaborador->cedula)]);
            if (!$estaEnMalasMarcaciones && !empty($colaborador->codigo_qr_skap)) $estaEnMalasMarcaciones = isset($malasMarcacionesIdentificacionesSet[$normStr($colaborador->codigo_qr_skap)]);
            if (!$estaEnMalasMarcaciones && !empty($colaborador->nombre_completo)) $estaEnMalasMarcaciones = isset($malasMarcacionesNombresSet[$normStr($colaborador->nombre_completo)]);
            $porcentajeMalasMarcaciones      = $estaEnMalasMarcaciones ? 0.0 : 100.0;
            $porcentajeMalasMarcacionesLabel = $estaEnMalasMarcaciones ? '0%' : '100%';

            // Helper de coincidencia
            $getMetricVals = function ($docMap, $nomMap) use ($colaborador, $normStr) {
                $vals = !empty($colaborador->cedula) ? ($docMap[$normStr($colaborador->cedula)] ?? null) : null;
                if ($vals === null && !empty($colaborador->codigo_qr_skap)) $vals = $docMap[$normStr($colaborador->codigo_qr_skap)] ?? null;
                if ($vals === null && !empty($colaborador->nombre_completo)) $vals = $nomMap[$normStr($colaborador->nombre_completo)] ?? null;
                return $vals;
            };

            // Rechazos
            $valsRechazos = $getMetricVals($rechazosPorDocumento, $rechazosPorNombre);
            if (!empty($valsRechazos)) {
                $porcentajeRechazos      = round(array_sum($valsRechazos) / count($valsRechazos), 1);
                $porcentajeRechazosLabel = "{$porcentajeRechazos}%";
            } else {
                $porcentajeRechazos      = null;
                $porcentajeRechazosLabel = 'N/A';
            }

            // Adherencia Tiempo
            $valsAdherenciaTiempo = $getMetricVals($adherenciaTiempoPorDocumento, $adherenciaTiempoPorNombre);
            if (!empty($valsAdherenciaTiempo)) {
                $porcentajeAdherenciaTiempo      = round(array_sum($valsAdherenciaTiempo) / count($valsAdherenciaTiempo), 1);
                $porcentajeAdherenciaTiempoLabel = "{$porcentajeAdherenciaTiempo}%";
            } else {
                $porcentajeAdherenciaTiempo      = null;
                $porcentajeAdherenciaTiempoLabel = 'N/A';
            }

            // RMD
            $valsRmd = $getMetricVals($rmdPorDocumento, $rmdPorNombre);
            if (!empty($valsRmd)) {
                $promedioRmd      = round(array_sum($valsRmd) / count($valsRmd), 1);
                $promedioRmdLabel = "{$promedioRmd}";
            } else {
                $promedioRmd      = null;
                $promedioRmdLabel = 'N/A';
            }

            // Checklist Pre/Post — solo Conductores
            $esConductor = str_contains(strtoupper((string) ($colaborador->cargo ?? '')), 'CONDUCTOR');
            if ($esConductor) {
                $manualCheck      = $checklistsManuales->get($colaborador->id);
                $clPreAprobado    = $manualCheck ? (bool) $manualCheck->cl_pre  : true;
                $clPostAprobado   = $manualCheck ? (bool) $manualCheck->cl_post : true;
                $porcentajeChecklistPre      = $clPreAprobado  ? 100.0 : 0.0;
                $porcentajeChecklistPreLabel = $clPreAprobado  ? 'Aprobado' : 'No Aprobado';
                $porcentajeChecklistPost      = $clPostAprobado ? 100.0 : 0.0;
                $porcentajeChecklistPostLabel = $clPostAprobado ? 'Aprobado' : 'No Aprobado';
                $promedioClPre  = null;
                $promedioClPost = null;
            } else {
                $promedioClPre  = null; $porcentajeChecklistPre  = null; $porcentajeChecklistPreLabel  = 'N/A';
                $promedioClPost = null; $porcentajeChecklistPost = null; $porcentajeChecklistPostLabel = 'N/A';
            }

            // Resultado Seguridad (35 pts)
            $calAci            = min((float) $porcentaje, 100) / 100;
            $calOwd            = $porcentajeOwdRuta      !== null ? min((float) $porcentajeOwdRuta, 100)      / 100 : null;
            $calCapacitaciones = $promedioCalificacion   !== null ? min((float) $promedioCalificacion, 100)   / 100 : null;
            $pesoAci = 10; $pesoOwd = 15; $pesoCal = 10;
            $puntosSeg  = ($calAci * $pesoAci) + ($calOwd !== null ? $calOwd * $pesoOwd : 0) + ($calCapacitaciones !== null ? $calCapacitaciones * $pesoCal : 0);
            $pesoMaxSeg = $pesoAci + ($calOwd !== null ? $pesoOwd : 0) + ($calCapacitaciones !== null ? $pesoCal : 0);
            $resultadoVal   = $pesoMaxSeg > 0 ? round(($puntosSeg / $pesoMaxSeg) * 35, 1) : 0.0;
            $resultadoLabel = "{$resultadoVal}%";

            // Resultado Gente (15 pts)
            $calDpo       = min((float) $porcentajeDpo, 100) / 100;
            $calAusentism = min((float) $porcentajeAusentismo, 100) / 100;
            $calMarc      = min((float) $porcentajeMalasMarcaciones, 100) / 100;
            $resultadoAsistenciaVal   = round(($calDpo * 5) + ($calAusentism * 5) + ($calMarc * 5), 1);
            $resultadoAsistenciaLabel = "{$resultadoAsistenciaVal}%";

            // SAC
            $valsSac       = $getMetricVals($sacPorColaboradorId, $sacPorResponsable);
            $tieneCasosSac = !empty($valsSac);
            if ($tieneCasosSac) {
                $porcentajeSac      = round(array_sum($valsSac) / count($valsSac), 1);
                $porcentajeSacLabel = "{$porcentajeSac}%";
            } else {
                $porcentajeSac      = 100.0;
                $porcentajeSacLabel = '100%';
            }

            // Resultado Reparto (35 pts)
            $calRechazos       = $porcentajeRechazos        !== null ? (int) ($porcentajeRechazos <= 2.4)       : 0;
            $calSac            = $tieneCasosSac ? 0 : 1;
            $calAdherenciaTiempo = $porcentajeAdherenciaTiempo !== null ? (int) ($porcentajeAdherenciaTiempo >= 83) : 0;
            $calRmd            = $promedioRmd                !== null ? (int) ($promedioRmd >= 4)                : 0;
            $resultadoRepartoVal   = round(($calRechazos * 11) + ($calSac * 8) + ($calAdherenciaTiempo * 8) + ($calRmd * 8), 1);
            $resultadoRepartoLabel = "{$resultadoRepartoVal}%";

            // Resultado Flota (15 pts — solo Conductores)
            if ($esConductor) {
                $clPreOk  = $porcentajeChecklistPre  !== null && $porcentajeChecklistPre  >= 100;
                $clPostOk = $porcentajeChecklistPost !== null && $porcentajeChecklistPost >= 100;
                $resultadoFlotaVal   = ($clPreOk && $clPostOk) ? 15.0 : 0.0;
                $resultadoFlotaLabel = "{$resultadoFlotaVal}%";
            } else {
                $resultadoFlotaVal   = null;
                $resultadoFlotaLabel = 'N/A';
            }

            // Total
            if ($esConductor) {
                $calificacionTotalVal = round($resultadoVal + $resultadoAsistenciaVal + $resultadoRepartoVal + $resultadoFlotaVal, 1);
            } else {
                $calificacionTotalVal = round((($resultadoVal + $resultadoAsistenciaVal + $resultadoRepartoVal) / 85) * 100, 1);
            }
            $calificacionTotalLabel = "{$calificacionTotalVal}%";

            return [
                'id'                           => $colaborador->id,
                'cedula'                       => $colaborador->cedula,
                'nombre_completo'              => $colaborador->nombre_completo,
                'nombres'                      => $colaborador->nombres,
                'apellidos'                    => $colaborador->apellidos,
                'cargo'                        => $colaborador->cargo ?? 'Sin cargo',
                'area'                         => $colaborador->area  ?? 'General',
                'aci_realizadas'               => $aciRealizadas,
                'meta'                         => self::META_BASE,
                'porcentaje'                   => $porcentaje,
                'porcentaje_owd_ruta'          => $porcentajeOwdRuta,
                'porcentaje_owd_ruta_label'    => $porcentajeOwdRutaLabel,
                'promedio_calificaciones'      => $promedioCalificacion,
                'promedio_calificaciones_label'=> $promedioCalificacionLabel,
                'resultado'                    => $resultadoVal,
                'resultado_label'              => $resultadoLabel,
                'porcentaje_dpo'               => $porcentajeDpo,
                'porcentaje_dpo_label'         => $porcentajeDpoLabel,
                'porcentaje_ausentismo'        => $porcentajeAusentismo,
                'porcentaje_ausentismo_label'  => $porcentajeAusentismoLabel,
                'porcentaje_malas_marcaciones' => $porcentajeMalasMarcaciones,
                'porcentaje_malas_marcaciones_label' => $porcentajeMalasMarcacionesLabel,
                'resultado_asistencia'         => $resultadoAsistenciaVal,
                'resultado_asistencia_label'   => $resultadoAsistenciaLabel,
                'porcentaje_rechazos'          => $porcentajeRechazos,
                'porcentaje_rechazos_label'    => $porcentajeRechazosLabel,
                'porcentaje_sac'               => $porcentajeSac,
                'porcentaje_sac_label'         => $porcentajeSacLabel,
                'porcentaje_adherencia_tiempo' => $porcentajeAdherenciaTiempo,
                'porcentaje_adherencia_tiempo_label' => $porcentajeAdherenciaTiempoLabel,
                'promedio_rmd'                 => $promedioRmd,
                'promedio_rmd_label'           => $promedioRmdLabel,
                'porcentaje_checklist_pre'     => $porcentajeChecklistPre,
                'porcentaje_checklist_pre_label' => $porcentajeChecklistPreLabel,
                'promedio_checklist_pre'       => $promedioClPre,
                'porcentaje_checklist_post'    => $porcentajeChecklistPost,
                'porcentaje_checklist_post_label' => $porcentajeChecklistPostLabel,
                'promedio_checklist_post'      => $promedioClPost,
                'resultado_reparto'            => $resultadoRepartoVal,
                'resultado_reparto_label'      => $resultadoRepartoLabel,
                'resultado_flota'              => $resultadoFlotaVal,
                'resultado_flota_label'        => $resultadoFlotaLabel,
                'calificacion_total'           => $calificacionTotalVal,
                'calificacion_total_label'     => $calificacionTotalLabel,
                'faltantes'                    => $faltantes,
                'cumple'                       => $cumple,
                'estado'                       => $estadoStr,
            ];
        });

        return ['todosCalculados' => $todosCalculados, 'totalAcisMes' => $totalAcisMes];
    }

    public function exportar(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        set_time_limit(300);

        $mes             = $request->integer('mes')  ?: (int) now()->month;
        $anio            = $request->integer('anio') ?: (int) now()->year;
        $filtroCargo     = $request->string('cargo')->trim()->toString();
        $mesesChecklistStr = $request->string('meses_checklist')->trim()->toString();

        // Reutiliza exactamente el mismo pipeline del index() — sin recalcular nada.
        ['todosCalculados' => $todosCalculados] =
            $this->buildFilasFinales($mes, $anio, '', $filtroCargo, $mesesChecklistStr);

        // Mismo orden que la vista: mayor calificación total primero
        $filas = $todosCalculados->sortByDesc('calificacion_total')->values()->all();

        // ── Construir el libro Excel ──────────────────────────────────────────
        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Plan Premiación');

        $colores = [
            'seguridad' => 'D1FAE5',
            'gente'     => 'FEF3C7',
            'reparto'   => 'FFE4E6',
            'flota'     => 'DBEAFE',
            'total'     => 'EDE9FE',
            'header'    => '1E293B',
        ];

        $mN = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        $sheet->setCellValue('A1', "Plan Premiación — {$mN[$mes]} {$anio}");
        $sheet->mergeCells('A1:S1');
        $sheet->getStyle('A1')->applyFromArray([
            'font'      => ['bold'=>true,'size'=>13,'color'=>['rgb'=>'FFFFFF']],
            'fill'      => ['fillType'=>'solid','startColor'=>['rgb'=>$colores['header']]],
            'alignment' => ['horizontal'=>'center'],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(22);

        // Fila 2: grupos de pilares
        $pilarCols = [
            'C'=>['C','D','E','F'], 'G'=>['G','H','I','J'],
            'K'=>['K','L','M','N','O'], 'P'=>['P','Q','R'], 'S'=>['S'],
        ];
        $grupos = [
            ['col'=>'C','label'=>'SEGURIDAD  35%','color'=>'059669'],
            ['col'=>'G','label'=>'GENTE  15%',    'color'=>'D97706'],
            ['col'=>'K','label'=>'REPARTO  35%',  'color'=>'E11D48'],
            ['col'=>'P','label'=>'FLOTA  15%',    'color'=>'2563EB'],
            ['col'=>'S','label'=>'TOTAL  100%',   'color'=>'7C3AED'],
        ];
        foreach ($grupos as $g) {
            $cols   = $pilarCols[$g['col']];
            $rango  = $g['col'].'2:'.end($cols).'2';
            $sheet->mergeCells($rango);
            $sheet->setCellValue($g['col'].'2', $g['label']);
            $sheet->getStyle($rango)->applyFromArray([
                'font'      => ['bold'=>true,'color'=>['rgb'=>'FFFFFF'],'size'=>9],
                'fill'      => ['fillType'=>'solid','startColor'=>['rgb'=>$g['color']]],
                'alignment' => ['horizontal'=>'center','vertical'=>'center'],
            ]);
        }
        $sheet->getStyle('A2:B2')->applyFromArray(['fill'=>['fillType'=>'solid','startColor'=>['rgb'=>$colores['header']]]]);
        $sheet->getRowDimension(2)->setRowHeight(18);

        // Fila 3: sub-encabezados
        $subHeaders = [
            'A'=>'Cédula', 'B'=>'Colaborador / Cargo',
            'C'=>'% ACI (10%)', 'D'=>'% OWD Ruta (15%)', 'E'=>'% Calificaciones (10%)', 'F'=>'Resultado Seg.',
            'G'=>'% DPO Academy (5%)', 'H'=>'% Ausentismo (5%)', 'I'=>'% Malas Marc. (5%)', 'J'=>'Resultado Gente',
            'K'=>'% Rechazos (11%)', 'L'=>'% SAC (8%)', 'M'=>'% Ad. Tiempo (8%)', 'N'=>'RMD (8%)', 'O'=>'Resultado Rep.',
            'P'=>'% CL Pre (7.5%)', 'Q'=>'% CL Post (7.5%)', 'R'=>'Resultado Flota',
            'S'=>'TOTAL 100%',
        ];
        $pilarBg = [
            'C'=>$colores['seguridad'],'D'=>$colores['seguridad'],'E'=>$colores['seguridad'],'F'=>$colores['seguridad'],
            'G'=>$colores['gente'],    'H'=>$colores['gente'],    'I'=>$colores['gente'],    'J'=>$colores['gente'],
            'K'=>$colores['reparto'],  'L'=>$colores['reparto'],  'M'=>$colores['reparto'],  'N'=>$colores['reparto'],  'O'=>$colores['reparto'],
            'P'=>$colores['flota'],    'Q'=>$colores['flota'],    'R'=>$colores['flota'],
            'S'=>$colores['total'],
        ];
        foreach ($subHeaders as $col => $label) {
            $sheet->setCellValue($col.'3', $label);
            $bg = $pilarBg[$col] ?? 'E2E8F0';
            $sheet->getStyle($col.'3')->applyFromArray([
                'font'      => ['bold'=>true,'size'=>8],
                'fill'      => ['fillType'=>'solid','startColor'=>['rgb'=>$bg]],
                'alignment' => ['horizontal'=>'center','vertical'=>'center','wrapText'=>true],
                'borders'   => ['allBorders'=>['borderStyle'=>'thin','color'=>['rgb'=>'CBD5E1']]],
            ]);
        }
        $sheet->getRowDimension(3)->setRowHeight(30);

        $anchos = ['A'=>14,'B'=>30,'C'=>12,'D'=>13,'E'=>14,'F'=>12,'G'=>14,'H'=>13,'I'=>14,'J'=>12,'K'=>12,'L'=>10,'M'=>15,'N'=>10,'O'=>12,'P'=>13,'Q'=>13,'R'=>13,'S'=>12];
        foreach ($anchos as $col => $ancho) {
            $sheet->getColumnDimension($col)->setWidth($ancho);
        }

        // ── Filas de datos — escritura directa de los valores ya calculados ──
        $na  = fn ($v) => $v !== null ? $v.'%' : 'N/A';
        $fila = 4;

        foreach ($filas as $c) {
            $estadoStr = match ($c['estado']) {
                'meta_alcanzada'    => 'Meta Alcanzada',
                'en_progreso'       => 'En Progreso',
                default             => 'Sin Participación',
            };

            $datos = [
                'A' => $c['cedula'],
                'B' => $c['nombre_completo'].' - '.($c['cargo'] ?? 'Sin cargo'),
                'C' => $c['porcentaje'].'%',
                'D' => $na($c['porcentaje_owd_ruta']),
                'E' => $na($c['promedio_calificaciones']),
                'F' => $c['resultado'].'%',
                'G' => $c['porcentaje_dpo'].'%',
                'H' => $na($c['porcentaje_ausentismo']),
                'I' => $c['porcentaje_malas_marcaciones'].'%',
                'J' => $c['resultado_asistencia'].'%',
                'K' => $na($c['porcentaje_rechazos']),
                'L' => $c['porcentaje_sac'].'%',
                'M' => $na($c['porcentaje_adherencia_tiempo']),
                'N' => $c['promedio_rmd'] !== null ? (string) $c['promedio_rmd'] : 'N/A',
                'O' => $c['resultado_reparto'].'%',
                'P' => $na($c['porcentaje_checklist_pre']),
                'Q' => $na($c['porcentaje_checklist_post']),
                'R' => $c['resultado_flota'] !== null ? $c['resultado_flota'].'%' : 'N/A',
                'S' => $c['calificacion_total'].'%',
            ];

            foreach ($datos as $col => $val) {
                $sheet->setCellValue($col.$fila, $val);
                $bg    = $pilarBg[$col] ?? null;
                $style = ['borders'=>['allBorders'=>['borderStyle'=>'thin','color'=>['rgb'=>'E2E8F0']]]];
                if ($bg) $style['fill'] = ['fillType'=>'solid','startColor'=>['rgb'=>$bg]];
                $sheet->getStyle($col.$fila)->applyFromArray($style);
            }

            if ($fila % 2 === 0) {
                $sheet->getStyle('A'.$fila.':B'.$fila)->applyFromArray(['fill'=>['fillType'=>'solid','startColor'=>['rgb'=>'F8FAFC']]]);
            }

            $colorEstado = match($estadoStr) {
                'Meta Alcanzada' => '059669',
                'En Progreso'    => 'D97706',
                default          => 'E11D48',
            };
            $sheet->getStyle('S'.$fila)->getFont()->getColor()->setRGB($colorEstado);
            $sheet->getStyle('S'.$fila)->getFont()->setBold(true);
            $sheet->getRowDimension($fila)->setRowHeight(16);
            $fila++;
        }

        $sheet->freezePane('C4');
        $sheet->setAutoFilter('A3:S3');

        $filename = "plan_premiacion_{$anio}_{$mes}.xlsx";

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
            $writer->save('php://output');
        }, $filename, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control'       => 'max-age=0',
        ]);
    }

    /**
     * Vista de detalle del plan premiación para un colaborador específico.
     * GET /modules/gente/plan-premiacion/{colaborador}?mes=X&anio=Y
     */
    public function show(Request $request, Colaborador $colaborador): Response
    {
        $mes  = $request->integer('mes')  ?: (int) now()->month;
        $anio = $request->integer('anio') ?: (int) now()->year;

        // ── ACIs del mes ─────────────────────────────────────────────────────
        $aciRealizadas = Aci::whereMonth('fecha_incidente', $mes)
            ->whereYear('fecha_incidente', $anio)
            ->where('colaborador_id', $colaborador->id)
            ->count();

        $porcentajeAci = min(100.0, round(($aciRealizadas / self::META_BASE) * 100, 1));

        // ── Historial ACI últimos 6 meses ──────────────────────────────────
        $historialAci = [];
        for ($i = 5; $i >= 0; $i--) {
            $fecha  = Carbon::create($anio, $mes, 1)->subMonths($i);
            $count  = Aci::whereMonth('fecha_incidente', $fecha->month)
                ->whereYear('fecha_incidente', $fecha->year)
                ->where('colaborador_id', $colaborador->id)
                ->count();
            $historialAci[] = [
                'mes'    => $fecha->translatedFormat('M Y'),
                'total'  => $count,
                'pct'    => round(($count / self::META_BASE) * 100, 1),
                'cumple' => $count >= self::META_BASE,
            ];
        }

        // ── OWD Ruta del mes ──────────────────────────────────────────────
        $normStr = function ($txt): string {
            $str = mb_strtoupper(trim((string) $txt), 'UTF-8');
            $str = str_replace(['Á','É','Í','Ó','Ú','Ü','Ñ'], ['A','E','I','O','U','U','N'], $str);
            return preg_replace('/[^A-Z0-9]/', '', $str) ?? $str;
        };

        $preguntasRuta = DB::table('evaluacion_owd_preguntas')
            ->join('evaluaciones_owd', 'evaluacion_owd_preguntas.evaluacion_owd_id', '=', 'evaluaciones_owd.id')
            ->whereMonth('evaluaciones_owd.fecha_evaluacion', $mes)
            ->whereYear('evaluaciones_owd.fecha_evaluacion', $anio)
            ->where(function ($q) {
                $q->whereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = 'ruta'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '\"ruta\"'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '[\"ruta\"]'");
            })
            ->where(function ($q) use ($colaborador) {
                $q->where('evaluaciones_owd.colaborador_id', $colaborador->id)
                  ->orWhere('evaluaciones_owd.qr_safety', $colaborador->codigo_qr_skap);
            })
            ->select('evaluacion_owd_preguntas.puntuacion', 'evaluaciones_owd.fecha_evaluacion')
            ->get();

        $okCount   = $preguntasRuta->filter(fn ($p) => str_contains(strtolower((string) $p->puntuacion), 'ok') && !str_contains(strtolower((string) $p->puntuacion), 'no ok'))->count();
        $noOkCount = $preguntasRuta->filter(fn ($p) => str_contains(strtolower((string) $p->puntuacion), 'no ok'))->count();
        $totalOwd  = $okCount + $noOkCount;
        $owdRuta   = $totalOwd > 0 ? ($noOkCount > 0 ? 0.0 : 100.0) : null;

        // ── Calificaciones ────────────────────────────────────────────────
        $promedioCalif = DB::table('colaborador_calificaciones')
            ->where('identificacion', $colaborador->cedula)
            ->whereNotNull('nota_modulo')
            ->avg('nota_modulo');
        $promedioCalif = $promedioCalif !== null ? round((float) $promedioCalif, 1) : null;

        // ── DPO Academy ───────────────────────────────────────────────────
        $estaEnDpo = DB::table('dpo_academy')
            ->where(function ($q) use ($mes, $anio, $monthExpr) {
                $q->where(function ($q2) use ($mes, $anio) {
                    $q2->where('mes', $mes)
                       ->where('anio', $anio);
                })->orWhere(function ($q2) use ($mes, $anio, $monthExpr) {
                    $q2->whereNull('mes')
                       ->whereIn($monthExpr('created_at'), [$mes])
                       ->whereYear('created_at', $anio);
                });
            })
            ->get(['colaborador_id', 'qr_safety', 'nombre'])
            ->contains(function ($r) use ($colaborador, $normStr) {
                if ($r->colaborador_id && $r->colaborador_id == $colaborador->id) return true;
                if (!empty($r->qr_safety) && !empty($colaborador->codigo_qr_skap) && $normStr($r->qr_safety) === $normStr($colaborador->codigo_qr_skap)) return true;
                if (!empty($r->nombre) && !empty($colaborador->nombre_completo) && $normStr($r->nombre) === $normStr($colaborador->nombre_completo)) return true;
                return false;
            });

        // ── Eventos Tripulación ───────────────────────────────────────────
        // Se traen TODOS los registros del mes para poder calcular el promedio
        $eventosColaborador = DB::table('eventos_tripulacion')
            ->whereMonth('fecha', $mes)
            ->whereYear('fecha', $anio)
            ->get(['documento', 'nombre', 'rechazos', 'adherencia_tiempo', 'rmd', 'adherencia_checklist_pre', 'adherencia_checklist_post'])
            ->filter(function ($r) use ($colaborador, $normStr) {
                if (!empty($r->documento) && !empty($colaborador->cedula) && $normStr($r->documento) === $normStr($colaborador->cedula)) return true;
                if (!empty($r->nombre) && !empty($colaborador->nombre_completo) && $normStr($r->nombre) === $normStr($colaborador->nombre_completo)) return true;
                return false;
            });

        // Primer registro para métricas de fila única (rechazos, adherencia, rmd)
        $evento = $eventosColaborador->first();

        // Solo aplica para conductores
        $esConductor = str_contains(strtoupper((string)($colaborador->cargo ?? '')), 'CONDUCTOR');

        $manualCheck = ChecklistPlanPremiacion::where('colaborador_id', $colaborador->id)
            ->where('mes', $mes)
            ->where('anio', $anio)
            ->first();

        $clPreAprobado  = $manualCheck ? (bool)$manualCheck->cl_pre : true;
        $clPostAprobado = $manualCheck ? (bool)$manualCheck->cl_post : true;

        // ── Ausentismo — manual: default Aprobado (true), se puede marcar No Aprobado ──
        $ausentismoAprobado   = $manualCheck ? (bool)$manualCheck->ausentismo_ok : true;
        $porcentajeAusentismo = $ausentismoAprobado ? 100.0 : 0.0;

        // ── Malas Marcaciones ─────────────────────────────────────────────
        $tieneMalasMarcaciones = DB::table('correcciones_marcaciones')
            ->get(['identificacion', 'nombre_completo'])
            ->contains(function ($r) use ($colaborador, $normStr) {
                if (!empty($r->identificacion) && !empty($colaborador->cedula) && $normStr($r->identificacion) === $normStr($colaborador->cedula)) return true;
                if (!empty($r->nombre_completo) && !empty($colaborador->nombre_completo) && $normStr($r->nombre_completo) === $normStr($colaborador->nombre_completo)) return true;
                return false;
            });

        // ── SAC ───────────────────────────────────────────────────────────
        $casosSac = DB::table('sac')
            ->whereMonth('fecha', $mes)
            ->whereYear('fecha', $anio)
            ->where('colaborador_id', $colaborador->id)
            ->count();

        // ── Armar métricas por pilar ──────────────────────────────────────
        $metricas = [
            // SEGURIDAD
            'aci'            => ['valor' => $porcentajeAci, 'label' => "{$porcentajeAci}%", 'pilar' => 'Seguridad', 'peso' => 10, 'emoji' => '🛡️', 'titulo' => 'ACI', 'meta_desc' => '(Realizadas ÷ 32) × 100'],
            'owd'            => ['valor' => $owdRuta, 'label' => $owdRuta !== null ? "{$owdRuta}%" : 'N/A', 'pilar' => 'Seguridad', 'peso' => 15, 'emoji' => '✅', 'titulo' => 'OWD Ruta', 'meta_desc' => 'Sin NO OK = 100% | Con NO OK = 0%'],
            'calificaciones' => ['valor' => $promedioCalif, 'label' => $promedioCalif !== null ? "{$promedioCalif}%" : 'N/A', 'pilar' => 'Seguridad', 'peso' => 10, 'emoji' => '🎓', 'titulo' => 'Calificaciones', 'meta_desc' => 'Promedio de notas por módulo'],
            // GENTE
            'dpo'            => ['valor' => $estaEnDpo ? 0.0 : 100.0, 'label' => $estaEnDpo ? '0%' : '100%', 'pilar' => 'Gente', 'peso' => 5, 'emoji' => '📚', 'titulo' => 'DPO Academy', 'meta_desc' => 'Sin registro = 100% | En listado = 0%'],
            'ausentismo'     => ['valor' => $porcentajeAusentismo, 'label' => $ausentismoAprobado ? '100%' : '0%', 'pilar' => 'Gente', 'peso' => 5, 'emoji' => '📅', 'titulo' => 'Ausentismo', 'meta_desc' => 'Default 100% · Manual'],
            'marcaciones'    => ['valor' => $tieneMalasMarcaciones ? 0.0 : 100.0, 'label' => $tieneMalasMarcaciones ? '0%' : '100%', 'pilar' => 'Gente', 'peso' => 5, 'emoji' => '🕐', 'titulo' => 'Malas Marcaciones', 'meta_desc' => 'Sin corrección = 100%'],
            // REPARTO
            'rechazos'       => ['valor' => $evento?->rechazos !== null ? (float)$evento->rechazos >= 2.4 ? 0.0 : 100.0 : null, 'label' => $evento?->rechazos !== null ? ((float)$evento->rechazos >= 2.4 ? '0%' : '100%') : 'N/A', 'pilar' => 'Reparto', 'peso' => 11, 'emoji' => '🔄', 'titulo' => 'Rechazos', 'meta_desc' => '< 2.4% rechazos = 100%'],
            'sac'            => ['valor' => $casosSac === 0 ? 100.0 : 0.0, 'label' => $casosSac === 0 ? '100%' : '0%', 'pilar' => 'Reparto', 'peso' => 8, 'emoji' => '🎧', 'titulo' => 'SAC', 'meta_desc' => 'Sin casos = 100%'],
            'adherencia'     => ['valor' => $evento?->adherencia_tiempo !== null ? ((float)$evento->adherencia_tiempo >= 83 ? 100.0 : 0.0) : null, 'label' => $evento?->adherencia_tiempo !== null ? ((float)$evento->adherencia_tiempo >= 83 ? '100%' : '0%') : 'N/A', 'pilar' => 'Reparto', 'peso' => 8, 'emoji' => '⏰', 'titulo' => 'Adherencia Tiempo', 'meta_desc' => '≥ 83% = 100%'],
            'rmd'            => ['valor' => $evento?->rmd !== null ? ((float)$evento->rmd >= 4 ? 100.0 : 0.0) : null, 'label' => $evento?->rmd !== null ? ((float)$evento->rmd >= 4 ? '100%' : '0%') : 'N/A', 'pilar' => 'Reparto', 'peso' => 8, 'emoji' => '🏆', 'titulo' => 'RMD', 'meta_desc' => 'Promedio ≥ 4 = 100%'],
            // FLOTA — solo aplica para Conductores de Reparto
            'cl_pre'         => [
                'valor'    => $esConductor ? ($clPreAprobado ? 100.0 : 0.0) : null,
                'label'    => $esConductor ? ($clPreAprobado ? 'Aprobado' : 'No Aprobado') : 'N/A',
                'pilar'    => 'Flota', 'peso' => 7.5, 'emoji' => '🔍', 'titulo' => 'Checklist Pre',
                'meta_desc' => 'Solo conductores · Default Aprobado (100%)',
            ],
            'cl_post'        => [
                'valor'    => $esConductor ? ($clPostAprobado ? 100.0 : 0.0) : null,
                'label'    => $esConductor ? ($clPostAprobado ? 'Aprobado' : 'No Aprobado') : 'N/A',
                'pilar'    => 'Flota', 'peso' => 7.5, 'emoji' => '🏁', 'titulo' => 'Checklist Post',
                'meta_desc' => 'Solo conductores · Default Aprobado (100%)',
            ],
        ];

        // Meses disponibles para el selector
        $mesesDisponibles = [];
        for ($i = 11; $i >= 0; $i--) {
            $f = Carbon::create($anio, $mes, 1)->subMonths($i);
            $mesesDisponibles[] = [
                'value' => (int)$f->month,
                'label' => $f->translatedFormat('F Y'),
            ];
        }

        return Inertia::render('gente/plan-premiacion/show', [
            'colaborador' => [
                'id'             => $colaborador->id,
                'nombre_completo'=> $colaborador->nombre_completo,
                'cedula'         => $colaborador->cedula,
                'cargo'          => $colaborador->cargo ?? 'Sin cargo',
                'area'           => $colaborador->area ?? 'General',
                'imagen'         => $colaborador->imagen ?? null,
                'aci_realizadas' => $aciRealizadas,
            ],
            'metricas'           => $metricas,
            'historial_aci'      => $historialAci,
            'mes'                => $mes,
            'anio'               => $anio,
            'meses_disponibles'  => $mesesDisponibles,
            'umbral_checklist'   => self::UMBRAL_CHECKLIST,
            'puede_editar'       => $request->user()?->hasAnyRole(['Administrador', 'Gente']) ?? false,
        ]);
    }

    /**
     * Alterna manualmente el estado del checklist (Pre o Post) para un conductor en un mes/año.
     * POST /modules/gente/plan-premiacion/toggle-checklist
     */
    public function toggleChecklist(Request $request): \Illuminate\Http\RedirectResponse
    {
        $validated = $request->validate([
            'colaborador_id' => ['required', 'integer', 'exists:colaboradores,id'],
            'mes'            => ['required', 'integer', 'min:1', 'max:12'],
            'anio'           => ['required', 'integer', 'min:2000', 'max:2100'],
            'tipo'           => ['required', 'string', 'in:pre,post'],
        ]);

        $record = ChecklistPlanPremiacion::firstOrCreate(
            [
                'colaborador_id' => $validated['colaborador_id'],
                'mes'            => $validated['mes'],
                'anio'           => $validated['anio'],
            ],
            [
                'cl_pre'         => true,
                'cl_post'        => true,
                'updated_by'     => $request->user()?->id,
            ]
        );

        if ($validated['tipo'] === 'pre') {
            $record->cl_pre = !$record->cl_pre;
        } else {
            $record->cl_post = !$record->cl_post;
        }

        $record->updated_by = $request->user()?->id;
        $record->save();

        return back();
    }

    /**
     * Alterna manualmente el estado del ausentismo para un colaborador en un mes/año.
     * POST /modules/gente/plan-premiacion/toggle-ausentismo
     */
    public function toggleAusentismo(Request $request): \Illuminate\Http\RedirectResponse
    {
        $validated = $request->validate([
            'colaborador_id' => ['required', 'integer', 'exists:colaboradores,id'],
            'mes'            => ['required', 'integer', 'min:1', 'max:12'],
            'anio'           => ['required', 'integer', 'min:2000', 'max:2100'],
        ]);

        $record = ChecklistPlanPremiacion::firstOrCreate(
            [
                'colaborador_id' => $validated['colaborador_id'],
                'mes'            => $validated['mes'],
                'anio'           => $validated['anio'],
            ],
            [
                'cl_pre'         => true,
                'cl_post'        => true,
                'ausentismo_ok'  => true,
                'updated_by'     => $request->user()?->id,
            ]
        );

        $record->ausentismo_ok = !$record->ausentismo_ok;
        $record->updated_by    = $request->user()?->id;
        $record->save();

        return back();
    }
}
