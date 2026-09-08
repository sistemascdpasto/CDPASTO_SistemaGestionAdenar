<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\ChecklistPlanPremiacion;
use App\Models\Seguridad\Aci;
use App\Models\Seguridad\Colaborador;
use App\Services\FestivosColombiaService;
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
        $mes = $request->integer('mes') ?: (int) now()->month;
        $anio = $request->integer('anio') ?: (int) now()->year;
        $search = $request->string('search')->trim()->toString();
        $filtroCargo = $request->string('cargo')->trim()->toString();
        $cargosSeleccionados = array_values(array_filter(array_map('trim', explode(',', $filtroCargo)), fn ($c) => $c !== '' && $c !== 'todos'));
        $filtroEstado = $request->string('estado')->trim()->toString();

        // Meses seleccionados en el dropdown multi-mes (vacío = mes actual)
        $mesesChecklistStr = $request->string('meses_checklist')->trim()->toString();
        $mesesSeleccionados = array_values(array_filter(
            array_map('intval', explode(',', $mesesChecklistStr)),
            fn ($m) => $m >= 1 && $m <= 12
        ));

        // Si no hay meses seleccionados, usar el mes actual como defecto
        if (empty($mesesSeleccionados)) {
            $mesesSeleccionados = [$mes];
        }

        // Meses para el checklist (puede ser distinto — usa los mismos por defecto)
        $mesesChecklist = $mesesSeleccionados;

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

        // 1. Obtener colaboradores activos del área Operativa
        $queryColaboradores = Colaborador::query()
            ->where('is_active', true)
            ->whereRaw("LOWER(TRIM(area)) = 'operativa'")
            ->select(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'area', 'codigo_qr_skap']);

        // Filtro adicional por cargo seleccionado
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

        // 2. Conteo de ACI por colaborador en los meses seleccionados
        $conteosPorColaborador = Aci::whereIn(DB::raw('MONTH(fecha_incidente)'), $mesesSeleccionados)
            ->whereYear('fecha_incidente', $anio)
            ->whereNotNull('colaborador_id')
            ->select('colaborador_id', DB::raw('count(*) as total'))
            ->groupBy('colaborador_id')
            ->pluck('total', 'colaborador_id');

        // 3. Evaluaciones OWD - Preguntas con actividad exactamente "Ruta"
        $preguntasRutaRaw = DB::table('evaluacion_owd_preguntas')
            ->join('evaluaciones_owd', 'evaluacion_owd_preguntas.evaluacion_owd_id', '=', 'evaluaciones_owd.id')
            ->whereIn(DB::raw('MONTH(evaluaciones_owd.fecha_evaluacion)'), $mesesSeleccionados)
            ->whereYear('evaluaciones_owd.fecha_evaluacion', $anio)
            ->where(function ($q) {
                // Coincide con: Ruta / "Ruta" / ["Ruta"] — nunca Pre Ruta ni Post Ruta
                $q->whereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = 'ruta'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '\"ruta\"'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '[\"ruta\"]'");
            })
            ->select('evaluaciones_owd.colaborador_id', 'evaluaciones_owd.qr_safety', 'evaluacion_owd_preguntas.puntuacion')
            ->get();

        // Indexar colaboradores por qr_safety para resolver los que tienen colaborador_id = null
        $colaboradoresPorQrOwd = Colaborador::whereNotNull('codigo_qr_skap')
            ->select(['id', 'codigo_qr_skap'])
            ->get()
            ->keyBy('codigo_qr_skap');

        // Agrupar por colaborador_id (resolviendo por qr_safety si colaborador_id es null)
        $preguntasRutaPorColaborador = $preguntasRutaRaw->groupBy(function ($p) use ($colaboradoresPorQrOwd) {
            if ($p->colaborador_id) {
                return $p->colaborador_id;
            }
            // Fallback: resolver por qr_safety
            $colab = $colaboradoresPorQrOwd->get($p->qr_safety);
            return $colab ? $colab->id : null;
        })->filter(fn ($grupo, $key) => $key !== null);

        // 4. Promedio de Calificaciones de Módulos por Cédula (Identificación)
        $promediosCalificaciones = DB::table('colaborador_calificaciones')
            ->whereNotNull('nota_modulo')
            ->select('identificacion', DB::raw('AVG(nota_modulo) as promedio_nota'))
            ->groupBy('identificacion')
            ->pluck('promedio_nota', 'identificacion');

        // 5. Registros DPO Academy (Estar en listado = 0%, No estar = 100%)
        $normStr = function ($txt) {
            $str = mb_strtoupper(trim((string) $txt), 'UTF-8');
            $str = str_replace(['Á', 'É', 'Í', 'Ó', 'Ú', 'Ü', 'Ñ'], ['A', 'E', 'I', 'O', 'U', 'U', 'N'], $str);
            return preg_replace('/[^A-Z0-9]/', '', $str) ?? $str;
        };

        $registrosDpo = DB::table('dpo_academy')
            ->select(['colaborador_id', 'qr_safety', 'nombre'])
            ->get();

        $dpoColaboradorIds = $registrosDpo->pluck('colaborador_id')->filter()->unique()->flip()->toArray();
        $dpoQrSafetySet = [];
        $dpoNombresSet = [];
        foreach ($registrosDpo as $r) {
            if ($r->qr_safety) {
                $dpoQrSafetySet[$normStr($r->qr_safety)] = true;
            }
            if ($r->nombre) {
                $dpoNombresSet[$normStr($r->nombre)] = true;
            }
        }

        // 6. Registros Ausentismo de los meses seleccionados
        $ausentismosRaw = DB::table('ausentismos')
            ->whereIn(DB::raw('MONTH(fecha)'), $mesesSeleccionados)
            ->whereYear('fecha', $anio)
            ->get();

        $festivosService = new FestivosColombiaService();

        /**
         * Nueva lógica de calificación por día:
         *
         *  1. ¿Tiene entro_1 o entro_2 con valor válido? → 100% (asistió)
         *  2. Si entro está vacío → revisar la fecha:
         *     a. ¿Es domingo o festivo Colombia/Nariño/Pasto? → 100% (día no laboral)
         *     b. Si es día hábil → revisar columna "permiso":
         *        - Contiene "INCAPACIDAD" → 0% (ausentismo por incapacidad)
         *        - Cualquier otro valor o vacío → 100% (permiso/justificado)
         */
        $calcularCalificacionDiaAusentismo = function ($row) use ($festivosService, $normStr) {
            $entro1 = trim((string) ($row->entro_1 ?? ''));
            $entro2 = trim((string) ($row->entro_2 ?? ''));

            $valoresVacios = ['', '00:00', '00:00:00', '0', '--:--'];
            $tieneEntrada1 = !in_array($entro1, $valoresVacios, true);
            $tieneEntrada2 = !in_array($entro2, $valoresVacios, true);

            // 1. Si tiene entrada registrada → asistió
            if ($tieneEntrada1 || $tieneEntrada2) {
                return 100.0;
            }

            // 2. Entrada vacía → verificar si es día no laboral
            $fechaStr = trim((string) ($row->fecha ?? ''));
            if ($fechaStr !== '') {
                try {
                    $fecha = Carbon::parse($fechaStr);
                    if ($festivosService->esDomingoOFestivo($fecha)) {
                        return 100.0; // domingo o festivo → no se penaliza
                    }
                } catch (\Throwable) {
                    // Si la fecha no se puede parsear continuamos con la lógica de permiso
                }
            }

            // 3. Es día hábil sin entrada → revisar permiso
            // Ausentismo penalizado: incapacidad, permiso remunerado o no remunerado
            $permiso = $normStr((string) ($row->permiso ?? ''));
            $permisosPenalizados = ['INCAPACIDAD', 'REMUNERADA', 'NOREMUNERADA'];
            foreach ($permisosPenalizados as $tipo) {
                if (str_contains($permiso, $tipo)) {
                    return 0.0;
                }
            }

            // Cualquier otro permiso (vacaciones, licencia, calamidad, etc.) o vacío → no penaliza
            return 100.0;
        };

        // Agrupar ausentismos por colaborador (por id, identificador/cédula o nombre)
        $ausentismosPorColaboradorId = [];
        $ausentismosPorIdentificador = [];

        foreach ($ausentismosRaw as $row) {
            $score = $calcularCalificacionDiaAusentismo($row);
            if (!empty($row->colaborador_id)) {
                $ausentismosPorColaboradorId[$row->colaborador_id][] = $score;
            }
            if (!empty($row->identificador)) {
                $ausentismosPorIdentificador[$normStr($row->identificador)][] = $score;
            }
        }

        // 7. Registros Malas Marcaciones (Correcciones Marcaciones)
        $correccionesQuery = DB::table('correcciones_marcaciones')
            ->whereIn(DB::raw('MONTH(fecha)'), $mesesSeleccionados)
            ->whereYear('fecha', $anio)
            ->get(['identificacion', 'nombre_completo']);

        if ($correccionesQuery->isEmpty()) {
            $correccionesQuery = DB::table('correcciones_marcaciones')
                ->get(['identificacion', 'nombre_completo']);
        }

        $malasMarcacionesIdentificacionesSet = [];
        $malasMarcacionesNombresSet = [];
        foreach ($correccionesQuery as $r) {
            if (!empty($r->identificacion)) {
                $malasMarcacionesIdentificacionesSet[$normStr($r->identificacion)] = true;
            }
            if (!empty($r->nombre_completo)) {
                $malasMarcacionesNombresSet[$normStr($r->nombre_completo)] = true;
            }
        }

        // 8. Registros Eventos Tripulación (Rechazos, Adherencia Tiempo, RMD, Checklist Pre y Post)
        // El checklist puede consultarse en meses distintos al mes principal
        $eventosTripulacionRaw = DB::table('eventos_tripulacion')
            ->when(
                !empty($mesesChecklist),
                fn ($q) => $q->whereIn(DB::raw('MONTH(fecha)'), $mesesChecklist)->whereYear('fecha', $anio),
                fn ($q) => $q->whereYear('fecha', $anio)
            )
            ->get([
                'documento',
                'nombre',
                'rechazos',
                'adherencia_tiempo',
                'rmd',
                'adherencia_checklist_pre',
                'adherencia_checklist_post',
            ]);

        if ($eventosTripulacionRaw->isEmpty()) {
            $eventosTripulacionRaw = DB::table('eventos_tripulacion')
                ->get([
                    'documento',
                    'nombre',
                    'rechazos',
                    'adherencia_tiempo',
                    'rmd',
                    'adherencia_checklist_pre',
                    'adherencia_checklist_post',
                ]);
        }

        $rechazosPorDocumento = [];
        $rechazosPorNombre = [];
        $adherenciaTiempoPorDocumento = [];
        $adherenciaTiempoPorNombre = [];
        $rmdPorDocumento = [];
        $rmdPorNombre = [];
        $checklistPrePorDocumento = [];
        $checklistPrePorNombre = [];
        $checklistPostPorDocumento = [];
        $checklistPostPorNombre = [];

        foreach ($eventosTripulacionRaw as $row) {
            $docKey = !empty($row->documento) ? $normStr($row->documento) : null;
            $nomKey = !empty($row->nombre) ? $normStr($row->nombre) : null;

            if ($row->rechazos !== null) {
                $val = (float) $row->rechazos;
                if ($docKey) $rechazosPorDocumento[$docKey][] = $val;
                if ($nomKey) $rechazosPorNombre[$nomKey][] = $val;
            }

            if ($row->adherencia_tiempo !== null) {
                $val = (float) $row->adherencia_tiempo;
                if ($docKey) $adherenciaTiempoPorDocumento[$docKey][] = $val;
                if ($nomKey) $adherenciaTiempoPorNombre[$nomKey][] = $val;
            }

            if ($row->rmd !== null && is_numeric($row->rmd)) {
                $val = (float) $row->rmd;
                if ($docKey) $rmdPorDocumento[$docKey][] = $val;
                if ($nomKey) $rmdPorNombre[$nomKey][] = $val;
            }

            if ($row->adherencia_checklist_pre !== null) {
                $val = (float) $row->adherencia_checklist_pre;
                if ($docKey) $checklistPrePorDocumento[$docKey][] = $val;
                if ($nomKey) $checklistPrePorNombre[$nomKey][] = $val;
            }

            if ($row->adherencia_checklist_post !== null) {
                $val = (float) $row->adherencia_checklist_post;
                if ($docKey) $checklistPostPorDocumento[$docKey][] = $val;
                if ($nomKey) $checklistPostPorNombre[$nomKey][] = $val;
            }
        }

        // 9. Registros SAC (Servicio al Cliente)
        $sacRaw = DB::table('sac')
            ->whereIn(DB::raw('MONTH(fecha)'), $mesesSeleccionados)
            ->whereYear('fecha', $anio)
            ->get(['colaborador_id', 'responsable', 'cumplimiento_cierre', 'aplica']);

        if ($sacRaw->isEmpty()) {
            $sacRaw = DB::table('sac')->get(['colaborador_id', 'responsable', 'cumplimiento_cierre', 'aplica']);
        }

        $sacPorColaboradorId = [];
        $sacPorResponsable = [];

        foreach ($sacRaw as $row) {
            $cumplio = false;
            if (!empty($row->cumplimiento_cierre)) {
                $c = mb_strtoupper(trim($row->cumplimiento_cierre), 'UTF-8');
                if (str_contains($c, 'TIEMPO') || str_contains($c, 'SI') || str_contains($c, '100')) {
                    $cumplio = true;
                }
            }
            $val = $cumplio ? 100.0 : 0.0;

            if (!empty($row->colaborador_id)) {
                $sacPorColaboradorId[$row->colaborador_id][] = $val;
            }
            if (!empty($row->responsable)) {
                $sacPorResponsable[$normStr($row->responsable)][] = $val;
            }
        }

        // Total de ACIs reportados en el mes
        $totalAcisMes = Aci::whereMonth('fecha_incidente', $mes)
            ->whereYear('fecha_incidente', $anio)
            ->count();

        // 10. Registros Estado Manual Checklist (Pre y Post)
        $checklistsManuales = ChecklistPlanPremiacion::whereIn('colaborador_id', $colaboradores->pluck('id'))
            ->where('mes', $mes)
            ->where('anio', $anio)
            ->get()
            ->keyBy('colaborador_id');

        // 11. Procesar datos por colaborador
        $todosCalculados = $colaboradores->map(function ($colaborador) use ($conteosPorColaborador, $preguntasRutaPorColaborador, $promediosCalificaciones, $dpoColaboradorIds, $dpoQrSafetySet, $dpoNombresSet, $ausentismosPorColaboradorId, $ausentismosPorIdentificador, $malasMarcacionesIdentificacionesSet, $malasMarcacionesNombresSet, $rechazosPorDocumento, $rechazosPorNombre, $adherenciaTiempoPorDocumento, $adherenciaTiempoPorNombre, $rmdPorDocumento, $rmdPorNombre, $checklistPrePorDocumento, $checklistPrePorNombre, $checklistPostPorDocumento, $checklistPostPorNombre, $sacPorColaboradorId, $sacPorResponsable, $checklistsManuales, $normStr) {
            $aciRealizadas = (int) ($conteosPorColaborador[$colaborador->id] ?? 0);
            $porcentaje = round(($aciRealizadas / self::META_BASE) * 100, 1);
            $faltantes = max(0, self::META_BASE - $aciRealizadas);
            $cumple = $aciRealizadas >= self::META_BASE;

            $estadoStr = 'sin_participacion';
            if ($cumple) {
                $estadoStr = 'meta_alcanzada';
            } elseif ($aciRealizadas > 0) {
                $estadoStr = 'en_progreso';
            }

            // Cálculo OWD Ruta: Si tiene al menos 1 NO OK -> 0%, si todos son OK -> 100%
            $preguntasRuta = $preguntasRutaPorColaborador->get($colaborador->id, collect());
            $okRuta = $preguntasRuta->filter(fn ($p) => str_contains(strtolower((string) $p->puntuacion), 'ok') && !str_contains(strtolower((string) $p->puntuacion), 'no ok') && !str_contains(strtolower((string) $p->puntuacion), 'not'))->count();
            $noOkRuta = $preguntasRuta->filter(fn ($p) => str_contains(strtolower((string) $p->puntuacion), 'no ok') || str_contains(strtolower((string) $p->puntuacion), 'nook'))->count();
            $totalAplicablesRuta = $okRuta + $noOkRuta;

            if ($totalAplicablesRuta > 0) {
                $porcentajeOwdRuta = $noOkRuta > 0 ? 0.0 : 100.0;
                $porcentajeOwdRutaLabel = "{$porcentajeOwdRuta}%";
            } else {
                $porcentajeOwdRuta = null;
                $porcentajeOwdRutaLabel = 'N/A';
            }

            // Cálculo Promedio Calificaciones Módulos
            $promedioCalificacionRaw = $promediosCalificaciones[$colaborador->cedula] ?? null;
            if ($promedioCalificacionRaw !== null) {
                $promedioCalificacion = round((float) $promedioCalificacionRaw, 1);
                $promedioCalificacionLabel = "{$promedioCalificacion}%";
            } else {
                $promedioCalificacion = null;
                $promedioCalificacionLabel = 'N/A';
            }

            // Cálculo % DPO Academy: Si está en listado dpo_academy -> 0%, si no -> 100%
            $estaEnDpo = isset($dpoColaboradorIds[$colaborador->id]);
            if (!$estaEnDpo && !empty($colaborador->codigo_qr_skap)) {
                $estaEnDpo = isset($dpoQrSafetySet[$normStr($colaborador->codigo_qr_skap)]);
            }
            if (!$estaEnDpo && !empty($colaborador->cedula)) {
                $estaEnDpo = isset($dpoQrSafetySet[$normStr($colaborador->cedula)]) || isset($dpoNombresSet[$normStr($colaborador->cedula)]);
            }
            if (!$estaEnDpo && !empty($colaborador->nombre_completo)) {
                $estaEnDpo = isset($dpoNombresSet[$normStr($colaborador->nombre_completo)]);
            }

            $porcentajeDpo = $estaEnDpo ? 0.0 : 100.0;
            $porcentajeDpoLabel = $estaEnDpo ? '0%' : '100%';

            // Cálculo % Ausentismo
            $scoresAusentismo = $ausentismosPorColaboradorId[$colaborador->id] ?? null;
            if ($scoresAusentismo === null && !empty($colaborador->cedula)) {
                $scoresAusentismo = $ausentismosPorIdentificador[$normStr($colaborador->cedula)] ?? null;
            }
            if ($scoresAusentismo === null && !empty($colaborador->codigo_qr_skap)) {
                $scoresAusentismo = $ausentismosPorIdentificador[$normStr($colaborador->codigo_qr_skap)] ?? null;
            }

            if (!empty($scoresAusentismo)) {
                // Si algún día del mes tiene 0% (incapacidad en día hábil) → 0%, si no → 100%
                $porcentajeAusentismo = in_array(0.0, $scoresAusentismo, true) ? 0.0 : 100.0;
                $porcentajeAusentismoLabel = "{$porcentajeAusentismo}%";
            } else {
                $porcentajeAusentismo = null;
                $porcentajeAusentismoLabel = 'N/A';
            }

            // Cálculo % Malas Marcaciones: Si está en el listado de correcciones_marcaciones -> 0%, si no -> 100%
            $estaEnMalasMarcaciones = false;
            if (!empty($colaborador->cedula)) {
                $estaEnMalasMarcaciones = isset($malasMarcacionesIdentificacionesSet[$normStr($colaborador->cedula)]);
            }
            if (!$estaEnMalasMarcaciones && !empty($colaborador->codigo_qr_skap)) {
                $estaEnMalasMarcaciones = isset($malasMarcacionesIdentificacionesSet[$normStr($colaborador->codigo_qr_skap)]);
            }
            if (!$estaEnMalasMarcaciones && !empty($colaborador->nombre_completo)) {
                $estaEnMalasMarcaciones = isset($malasMarcacionesNombresSet[$normStr($colaborador->nombre_completo)]);
            }

            $porcentajeMalasMarcaciones = $estaEnMalasMarcaciones ? 0.0 : 100.0;
            $porcentajeMalasMarcacionesLabel = $estaEnMalasMarcaciones ? '0%' : '100%';

            // Helper de coincidencia de arreglos de valores para un colaborador
            $getMetricVals = function ($docMap, $nomMap) use ($colaborador, $normStr) {
                $vals = !empty($colaborador->cedula) ? ($docMap[$normStr($colaborador->cedula)] ?? null) : null;
                if ($vals === null && !empty($colaborador->codigo_qr_skap)) {
                    $vals = $docMap[$normStr($colaborador->codigo_qr_skap)] ?? null;
                }
                if ($vals === null && !empty($colaborador->nombre_completo)) {
                    $vals = $nomMap[$normStr($colaborador->nombre_completo)] ?? null;
                }
                return $vals;
            };

            // % Rechazos
            $valsRechazos = $getMetricVals($rechazosPorDocumento, $rechazosPorNombre);
            if (!empty($valsRechazos)) {
                $promedioRechazosRaw = array_sum($valsRechazos) / count($valsRechazos);
                // < 2.4% → rechazos bajos → 100%, >= 2.4% → 0%
                $porcentajeRechazos = $promedioRechazosRaw >= 2.4 ? 0.0 : 100.0;
                $porcentajeRechazosLabel = "{$porcentajeRechazos}%";
            } else {
                $promedioRechazosRaw = null;
                $porcentajeRechazos = null;
                $porcentajeRechazosLabel = 'N/A';
            }

            // % Adherencia Tiempo
            $valsAdherenciaTiempo = $getMetricVals($adherenciaTiempoPorDocumento, $adherenciaTiempoPorNombre);
            if (!empty($valsAdherenciaTiempo)) {
                $promedioAdherenciaTiempoRaw = array_sum($valsAdherenciaTiempo) / count($valsAdherenciaTiempo);
                // >= 83% → cumple → 100%, < 83% → 0%
                $porcentajeAdherenciaTiempo = $promedioAdherenciaTiempoRaw >= 83 ? 100.0 : 0.0;
                $porcentajeAdherenciaTiempoLabel = "{$porcentajeAdherenciaTiempo}%";
            } else {
                $promedioAdherenciaTiempoRaw = null;
                $porcentajeAdherenciaTiempo = null;
                $porcentajeAdherenciaTiempoLabel = 'N/A';
            }

            // RMD
            $valsRmd = $getMetricVals($rmdPorDocumento, $rmdPorNombre);
            if (!empty($valsRmd)) {
                $promedioRmdRaw = array_sum($valsRmd) / count($valsRmd);
                // >= 4 → cumple → 100%, < 4 → 0%
                $promedioRmd = $promedioRmdRaw >= 4 ? 100.0 : 0.0;
                $promedioRmdLabel = "{$promedioRmd}%";
            } else {
                $promedioRmdRaw = null;
                $promedioRmd = null;
                $promedioRmdLabel = 'N/A';
            }

            // % Adherencia CL Pre/Post — solo aplica para cargo Conductor (Default 100% / Aprobado, manual toggle)
            $esConductor = str_contains(strtoupper((string) ($colaborador->cargo ?? '')), 'CONDUCTOR');

            if ($esConductor) {
                $manualCheck = $checklistsManuales->get($colaborador->id);
                $clPreAprobado = $manualCheck ? (bool) $manualCheck->cl_pre : true;
                $clPostAprobado = $manualCheck ? (bool) $manualCheck->cl_post : true;

                $porcentajeChecklistPre = $clPreAprobado ? 100.0 : 0.0;
                $porcentajeChecklistPreLabel = $clPreAprobado ? 'Aprobado' : 'No Aprobado';
                $promedioClPre = null;

                $porcentajeChecklistPost = $clPostAprobado ? 100.0 : 0.0;
                $porcentajeChecklistPostLabel = $clPostAprobado ? 'Aprobado' : 'No Aprobado';
                $promedioClPost = null;
            } else {
                $promedioClPre = null;
                $porcentajeChecklistPre = null;
                $porcentajeChecklistPreLabel = 'N/A';
                $promedioClPost = null;
                $porcentajeChecklistPost = null;
                $porcentajeChecklistPostLabel = 'N/A';
            }

            // Cálculo Resultado Ponderado SEGURIDAD (ACI=10%, OWD=15%, Calificaciones=10% = 35%)
            // Si un componente es N/A no resta: se calcula sobre el peso que sí aplica.
            $calAci = $porcentaje !== null ? min((float)$porcentaje, 100) / 100 : null;
            $calOwd = $porcentajeOwdRuta !== null ? min((float)$porcentajeOwdRuta, 100) / 100 : null;
            $calCapacitaciones = $promedioCalificacion !== null ? min((float)$promedioCalificacion, 100) / 100 : null;

            // Peso de cada componente
            $pesoAci = 10; $pesoOwd = 15; $pesoCal = 10;

            // Suma ponderada solo con los componentes que tienen dato
            $puntosSeg  = ($calAci !== null ? $calAci * $pesoAci : 0)
                        + ($calOwd !== null ? $calOwd * $pesoOwd : 0)
                        + ($calCapacitaciones !== null ? $calCapacitaciones * $pesoCal : 0);

            // Peso máximo alcanzable (solo los que aplican)
            $pesoMaxSeg = ($calAci !== null ? $pesoAci : 0)
                        + ($calOwd !== null ? $pesoOwd : 0)
                        + ($calCapacitaciones !== null ? $pesoCal : 0);

            // Resultado escalado a 35 puntos siempre
            $resultadoVal = $pesoMaxSeg > 0
                ? round(($puntosSeg / $pesoMaxSeg) * 35, 1)
                : 0.0;
            $resultadoLabel = "{$resultadoVal}%";

            // Cálculo Resultado Ponderado GENTE (DPO=5%, Marcaciones=5%, Ausentismo=5% = 15%)
            $calDpo = $porcentajeDpo !== null ? min((float)$porcentajeDpo, 100) / 100 : 0;
            $calAusentismo = $porcentajeAusentismo !== null ? min((float)$porcentajeAusentismo, 100) / 100 : 0;
            $calMarcaciones = $porcentajeMalasMarcaciones !== null ? min((float)$porcentajeMalasMarcaciones, 100) / 100 : 0;

            $resultadoAsistenciaVal = round(($calDpo * 5) + ($calAusentismo * 5) + ($calMarcaciones * 5), 1);
            $resultadoAsistenciaLabel = "{$resultadoAsistenciaVal}%";

            // % SAC (Servicio al Cliente)
            $valsSac = $getMetricVals($sacPorColaboradorId, $sacPorResponsable);
            $tieneCasosSac = !empty($valsSac);
            if (!empty($valsSac)) {
                $porcentajeSac = round(array_sum($valsSac) / count($valsSac), 1);
                $porcentajeSacLabel = "{$porcentajeSac}%";
            } else {
                $porcentajeSac = 100.0;
                $porcentajeSacLabel = '100%';
            }

            // Calificación binaria REPARTO — los valores ya son 100 o 0
            $calRechazos = $porcentajeRechazos !== null ? (int)($porcentajeRechazos >= 100) : 0;

            // SAC: 0 casos = 100% (calSac=1), 1+ casos = 0% (calSac=0) (peso 8%)
            $calSac = $tieneCasosSac ? 0 : 1;

            $calAdherenciaTiempo = $porcentajeAdherenciaTiempo !== null ? (int)($porcentajeAdherenciaTiempo >= 100) : 0;

            $calRmd = $promedioRmd !== null ? (int)($promedioRmd >= 100) : 0;

            $resultadoRepartoVal = round(($calRechazos * 11) + ($calSac * 8) + ($calAdherenciaTiempo * 8) + ($calRmd * 8), 1);
            $resultadoRepartoLabel = "{$resultadoRepartoVal}%";

            // Cálculo Resultado Ponderado FLOTA (15%)
            // Solo aplica para Conductores. Ambos checklist (Pre y Post) deben estar Aprobados para obtener 15%, si alguno es No Aprobado -> 0%.
            if ($esConductor) {
                $clPreOk  = $porcentajeChecklistPre !== null && $porcentajeChecklistPre >= 100;
                $clPostOk = $porcentajeChecklistPost !== null && $porcentajeChecklistPost >= 100;
                $resultadoFlotaVal = ($clPreOk && $clPostOk) ? 15.0 : 0.0;
                $resultadoFlotaLabel = "{$resultadoFlotaVal}%";
            } else {
                $resultadoFlotaVal = null;
                $resultadoFlotaLabel = 'N/A';
            }

            // Calificación Total (suma de los 4 pilares = 100%)
            // Para conductores: Seguridad(35%) + Gente(15%) + Reparto(35%) + Flota(15%) = 100%
            // Para otros cargos: Seguridad(35%) + Gente(15%) + Reparto(35%) escalado a 100%
            if ($esConductor) {
                $calificacionTotalVal = round($resultadoVal + $resultadoAsistenciaVal + $resultadoRepartoVal + $resultadoFlotaVal, 1);
            } else {
                $sumaBase = $resultadoVal + $resultadoAsistenciaVal + $resultadoRepartoVal;
                $calificacionTotalVal = round(($sumaBase / 85) * 100, 1);
            }
            $calificacionTotalLabel = "{$calificacionTotalVal}%";

            return [
                'id' => $colaborador->id,
                'cedula' => $colaborador->cedula,
                'nombre_completo' => $colaborador->nombre_completo,
                'nombres' => $colaborador->nombres,
                'apellidos' => $colaborador->apellidos,
                'cargo' => $colaborador->cargo ?? 'Sin cargo',
                'area' => $colaborador->area ?? 'General',
                'aci_realizadas' => $aciRealizadas,
                'meta' => self::META_BASE,
                'porcentaje' => $porcentaje,
                'porcentaje_owd_ruta' => $porcentajeOwdRuta,
                'porcentaje_owd_ruta_label' => $porcentajeOwdRutaLabel,
                'promedio_calificaciones' => $promedioCalificacion,
                'promedio_calificaciones_label' => $promedioCalificacionLabel,
                'resultado' => $resultadoVal,
                'resultado_label' => $resultadoLabel,
                'porcentaje_dpo' => $porcentajeDpo,
                'porcentaje_dpo_label' => $porcentajeDpoLabel,
                'porcentaje_ausentismo' => $porcentajeAusentismo,
                'porcentaje_ausentismo_label' => $porcentajeAusentismoLabel,
                'porcentaje_malas_marcaciones' => $porcentajeMalasMarcaciones,
                'porcentaje_malas_marcaciones_label' => $porcentajeMalasMarcacionesLabel,
                'resultado_asistencia' => $resultadoAsistenciaVal,
                'resultado_asistencia_label' => $resultadoAsistenciaLabel,
                'porcentaje_rechazos' => $porcentajeRechazos,
                'porcentaje_rechazos_label' => $porcentajeRechazosLabel,
                'porcentaje_sac' => $porcentajeSac,
                'porcentaje_sac_label' => $porcentajeSacLabel,
                'porcentaje_adherencia_tiempo' => $porcentajeAdherenciaTiempo,
                'porcentaje_adherencia_tiempo_label' => $porcentajeAdherenciaTiempoLabel,
                'promedio_rmd' => $promedioRmd,
                'promedio_rmd_label' => $promedioRmdLabel,
                'porcentaje_checklist_pre' => $porcentajeChecklistPre,
                'porcentaje_checklist_pre_label' => $porcentajeChecklistPreLabel,
                'promedio_checklist_pre' => $promedioClPre,
                'porcentaje_checklist_post' => $porcentajeChecklistPost,
                'porcentaje_checklist_post_label' => $porcentajeChecklistPostLabel,
                'promedio_checklist_post' => $promedioClPost,
                'resultado_reparto' => $resultadoRepartoVal,
                'resultado_reparto_label' => $resultadoRepartoLabel,
                'resultado_flota' => $resultadoFlotaVal,
                'resultado_flota_label' => $resultadoFlotaLabel,
                'calificacion_total' => $calificacionTotalVal,
                'calificacion_total_label' => $calificacionTotalLabel,
                'faltantes' => $faltantes,
                'cumple' => $cumple,
                'estado' => $estadoStr,
            ];
        });

        // Métricas globales para las KPI cards
        $totalPoblacion = $todosCalculados->count();
        $cumplenMetaCount = $todosCalculados->where('cumple', true)->count();
        $enProgresoCount = $todosCalculados->where('estado', 'en_progreso')->count();
        $sinParticipacionCount = $todosCalculados->where('estado', 'sin_participacion')->count();
        $promedioPorcentaje = $totalPoblacion > 0
            ? round($todosCalculados->avg('porcentaje'), 1)
            : 0.0;

        // Top 3 — los 3 mejores por calificación total
        $top3 = $todosCalculados
            ->sortByDesc('calificacion_total')
            ->values()
            ->take(3)
            ->all();

        // 2 colaboradores con peor calificación total
        $peores2 = $todosCalculados
            ->sortBy('calificacion_total')
            ->values()
            ->take(2)
            ->all();

        // Filtrado secundario por estado si aplica
        $filasFiltradas = $todosCalculados;
        if (in_array($filtroEstado, ['meta_alcanzada', 'en_progreso', 'sin_participacion'], true)) {
            $filasFiltradas = $filasFiltradas->where('estado', $filtroEstado)->values();
        }

        // Ordenamiento principal por Calificación Total desc
        $filasFinales = $filasFiltradas->sortByDesc('calificacion_total')->values()->all();

        return Inertia::render('gente/plan-premiacion/index', [
            'colaboradores' => $filasFinales,
            'resumen' => [
                'meta_base' => self::META_BASE,
                'total_colaboradores' => $totalPoblacion,
                'total_acis_mes' => $totalAcisMes,
                'cumplen_meta' => $cumplenMetaCount,
                'en_progreso' => $enProgresoCount,
                'sin_participacion' => $sinParticipacionCount,
                'promedio_porcentaje' => $promedioPorcentaje,
            ],
            'top3' => $top3,
            'peores2' => $peores2,
            'cargos' => $cargosDisponibles,
            'umbral_checklist' => self::UMBRAL_CHECKLIST,
            'puede_editar' => $request->user()?->hasAnyRole(['Administrador', 'Gente']) ?? false,
            'filters' => [
                'mes' => $mes,
                'anio' => $anio,
                'search' => $search,
                'estado' => $filtroEstado,
                'cargo' => $filtroCargo,
                'meses_checklist' => $mesesChecklistStr,
            ],
        ]);
    }

    public function exportar(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        set_time_limit(300);

        $mes  = $request->integer('mes')  ?: (int) now()->month;
        $anio = $request->integer('anio') ?: (int) now()->year;
        $filtroCargo = $request->string('cargo')->trim()->toString();
        $cargosSeleccionados = array_values(array_filter(
            array_map('trim', explode(',', $filtroCargo)),
            fn ($c) => $c !== '' && $c !== 'todos'
        ));

        // ── Colaboradores ────────────────────────────────────────────────────
        $queryCol = Colaborador::query()
            ->where('is_active', true)
            ->whereRaw("LOWER(TRIM(area)) = 'operativa'")
            ->select(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'area', 'codigo_qr_skap']);

        if (!empty($cargosSeleccionados)) {
            $queryCol->whereIn('cargo', $cargosSeleccionados);
        }

        $colaboradores = $queryCol->get();

        // ── Datos del mes ─────────────────────────────────────────────────────
        $normStr = function ($txt): string {
            $str = mb_strtoupper(trim((string) $txt), 'UTF-8');
            $str = str_replace(['Á','É','Í','Ó','Ú','Ü','Ñ'], ['A','E','I','O','U','U','N'], $str);
            return preg_replace('/[^A-Z0-9]/', '', $str) ?? $str;
        };

        $conteosPorColaborador = Aci::whereMonth('fecha_incidente', $mes)
            ->whereYear('fecha_incidente', $anio)
            ->whereNotNull('colaborador_id')
            ->select('colaborador_id', DB::raw('count(*) as total'))
            ->groupBy('colaborador_id')
            ->pluck('total', 'colaborador_id');

        $colaboradoresPorQrOwd = Colaborador::whereNotNull('codigo_qr_skap')
            ->select(['id', 'codigo_qr_skap'])->get()->keyBy('codigo_qr_skap');

        $preguntasRutaRaw = DB::table('evaluacion_owd_preguntas')
            ->join('evaluaciones_owd', 'evaluacion_owd_preguntas.evaluacion_owd_id', '=', 'evaluaciones_owd.id')
            ->whereMonth('evaluaciones_owd.fecha_evaluacion', $mes)
            ->whereYear('evaluaciones_owd.fecha_evaluacion', $anio)
            ->where(function ($q) {
                $q->whereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = 'ruta'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '\"ruta\"'")
                  ->orWhereRaw("LOWER(TRIM(evaluacion_owd_preguntas.actividad)) = '[\"ruta\"]'");
            })
            ->select('evaluaciones_owd.colaborador_id', 'evaluaciones_owd.qr_safety', 'evaluacion_owd_preguntas.puntuacion')
            ->get();

        $preguntasRutaPorColaborador = $preguntasRutaRaw->groupBy(function ($p) use ($colaboradoresPorQrOwd) {
            if ($p->colaborador_id) return $p->colaborador_id;
            $c = $colaboradoresPorQrOwd->get($p->qr_safety);
            return $c ? $c->id : null;
        })->filter(fn ($g, $k) => $k !== null);

        $promediosCalificaciones = DB::table('colaborador_calificaciones')
            ->whereNotNull('nota_modulo')
            ->select('identificacion', DB::raw('AVG(nota_modulo) as promedio_nota'))
            ->groupBy('identificacion')
            ->pluck('promedio_nota', 'identificacion');

        $registrosDpo = DB::table('dpo_academy')->select(['colaborador_id','qr_safety','nombre'])->get();
        $dpoColaboradorIds = $registrosDpo->pluck('colaborador_id')->filter()->unique()->flip()->toArray();
        $dpoQrSafetySet = []; $dpoNombresSet = [];
        foreach ($registrosDpo as $r) {
            if ($r->qr_safety) $dpoQrSafetySet[$normStr($r->qr_safety)] = true;
            if ($r->nombre)    $dpoNombresSet[$normStr($r->nombre)] = true;
        }

        $ausentismosRaw = DB::table('ausentismos')
            ->whereMonth('fecha', $mes)->whereYear('fecha', $anio)->get();

        $festivosService = new FestivosColombiaService();
        $calcAusentismo = function ($row) use ($festivosService, $normStr): float {
            $vacios = ['','00:00','00:00:00','0','--:--'];
            if (!in_array(trim((string)($row->entro_1??'')), $vacios, true)) return 100.0;
            if (!in_array(trim((string)($row->entro_2??'')), $vacios, true)) return 100.0;
            $fechaStr = trim((string)($row->fecha??''));
            if ($fechaStr !== '') {
                try { if ($festivosService->esDomingoOFestivo(\Carbon\Carbon::parse($fechaStr))) return 100.0; } catch (\Throwable) {}
            }
            $p = $normStr((string)($row->permiso??''));
            foreach (['INCAPACIDAD','REMUNERADA','NOREMUNERADA'] as $t) {
                if (str_contains($p, $t)) return 0.0;
            }
            return 100.0;
        };

        $ausentismosPorColaboradorId = []; $ausentismosPorIdentificador = [];
        foreach ($ausentismosRaw as $row) {
            $score = $calcAusentismo($row);
            if (!empty($row->colaborador_id)) $ausentismosPorColaboradorId[$row->colaborador_id][] = $score;
            if (!empty($row->identificador))  $ausentismosPorIdentificador[$normStr($row->identificador)][] = $score;
        }

        $correcciones = DB::table('correcciones_marcaciones')
            ->whereMonth('fecha',$mes)->whereYear('fecha',$anio)
            ->get(['identificacion','nombre_completo']);
        if ($correcciones->isEmpty()) {
            $correcciones = DB::table('correcciones_marcaciones')->get(['identificacion','nombre_completo']);
        }
        $marcacionesIdSet = []; $marcacionesNomSet = [];
        foreach ($correcciones as $r) {
            if (!empty($r->identificacion)) $marcacionesIdSet[$normStr($r->identificacion)] = true;
            if (!empty($r->nombre_completo)) $marcacionesNomSet[$normStr($r->nombre_completo)] = true;
        }

        $eventosRaw = DB::table('eventos_tripulacion')
            ->whereMonth('fecha',$mes)->whereYear('fecha',$anio)
            ->get(['documento','nombre','rechazos','adherencia_tiempo','rmd','adherencia_checklist_pre','adherencia_checklist_post']);
        if ($eventosRaw->isEmpty()) {
            $eventosRaw = DB::table('eventos_tripulacion')
                ->get(['documento','nombre','rechazos','adherencia_tiempo','rmd','adherencia_checklist_pre','adherencia_checklist_post']);
        }

        $rechazosPorDoc=[]; $rechazosPorNom=[];
        $adTiempoPorDoc=[]; $adTiempoPorNom=[];
        $rmdPorDoc=[]; $rmdPorNom=[];
        $clPrePorDoc=[]; $clPrePorNom=[];
        $clPostPorDoc=[]; $clPostPorNom=[];

        foreach ($eventosRaw as $row) {
            $dk = !empty($row->documento) ? $normStr($row->documento) : null;
            $nk = !empty($row->nombre)    ? $normStr($row->nombre)    : null;
            if ($row->rechazos !== null)                               { $v=(float)$row->rechazos;                if($dk) $rechazosPorDoc[$dk][]=$v; if($nk) $rechazosPorNom[$nk][]=$v; }
            if ($row->adherencia_tiempo !== null)                      { $v=(float)$row->adherencia_tiempo;      if($dk) $adTiempoPorDoc[$dk][]=$v; if($nk) $adTiempoPorNom[$nk][]=$v; }
            if ($row->rmd !== null && is_numeric($row->rmd))           { $v=(float)$row->rmd;                    if($dk) $rmdPorDoc[$dk][]=$v;      if($nk) $rmdPorNom[$nk][]=$v; }
            if ($row->adherencia_checklist_pre !== null)               { $v=(float)$row->adherencia_checklist_pre;  if($dk) $clPrePorDoc[$dk][]=$v;  if($nk) $clPrePorNom[$nk][]=$v; }
            if ($row->adherencia_checklist_post !== null)              { $v=(float)$row->adherencia_checklist_post; if($dk) $clPostPorDoc[$dk][]=$v; if($nk) $clPostPorNom[$nk][]=$v; }
        }

        $checklistsManuales = ChecklistPlanPremiacion::whereIn('colaborador_id', $colaboradores->pluck('id'))
            ->where('mes', $mes)
            ->where('anio', $anio)
            ->get()
            ->keyBy('colaborador_id');

        $sacRaw = DB::table('sac')->whereMonth('fecha',$mes)->whereYear('fecha',$anio)
            ->get(['colaborador_id','responsable','cumplimiento_cierre','aplica']);
        if ($sacRaw->isEmpty()) $sacRaw = DB::table('sac')->get(['colaborador_id','responsable','cumplimiento_cierre','aplica']);
        $sacPorColId=[]; $sacPorResp=[];
        foreach ($sacRaw as $row) {
            $c = mb_strtoupper(trim((string)($row->cumplimiento_cierre??'')), 'UTF-8');
            $v = (str_contains($c,'TIEMPO')||str_contains($c,'SI')||str_contains($c,'100')) ? 100.0 : 0.0;
            if (!empty($row->colaborador_id)) $sacPorColId[$row->colaborador_id][] = $v;
            if (!empty($row->responsable))    $sacPorResp[$normStr($row->responsable)][] = $v;
        }

        $getVals = function ($docMap, $nomMap) use ($normStr) {
            return function ($colaborador) use ($docMap, $nomMap, $normStr) {
                $v = !empty($colaborador->cedula)       ? ($docMap[$normStr($colaborador->cedula)] ?? null) : null;
                if ($v === null && !empty($colaborador->codigo_qr_skap)) $v = $docMap[$normStr($colaborador->codigo_qr_skap)] ?? null;
                if ($v === null && !empty($colaborador->nombre_completo)) $v = $nomMap[$normStr($colaborador->nombre_completo)] ?? null;
                return $v;
            };
        };

        $getRechazos    = $getVals($rechazosPorDoc, $rechazosPorNom);
        $getAdTiempo    = $getVals($adTiempoPorDoc, $adTiempoPorNom);
        $getRmd         = $getVals($rmdPorDoc, $rmdPorNom);
        $getClPre       = $getVals($clPrePorDoc, $clPrePorNom);
        $getClPost      = $getVals($clPostPorDoc, $clPostPorNom);

        // ── Construir el libro Excel ──────────────────────────────────────────
        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Plan Premiación');

        // Colores de pilares
        $colores = [
            'seguridad' => 'D1FAE5', // verde claro
            'gente'     => 'FEF3C7', // ámbar claro
            'reparto'   => 'FFE4E6', // rosa claro
            'flota'     => 'DBEAFE', // azul claro
            'total'     => 'EDE9FE', // violeta claro
            'header'    => '1E293B', // slate oscuro
        ];

        $mN = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        $sheet->setCellValue('A1', "Plan Premiación — {$mN[$mes]} {$anio}");
        $sheet->mergeCells('A1:X1');
        $sheet->getStyle('A1')->applyFromArray([
            'font'      => ['bold'=>true,'size'=>13,'color'=>['rgb'=>'FFFFFF']],
            'fill'      => ['fillType'=>'solid','startColor'=>['rgb'=>$colores['header']]],
            'alignment' => ['horizontal'=>'center'],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(22);

        // Fila 2: grupos de pilares
        $grupos = [
            ['col'=>'C','span'=>4,'label'=>'SEGURIDAD  35%','color'=>'059669'],
            ['col'=>'G','span'=>4,'label'=>'GENTE  15%',    'color'=>'D97706'],
            ['col'=>'K','span'=>5,'label'=>'REPARTO  35%',  'color'=>'E11D48'],
            ['col'=>'P','span'=>3,'label'=>'FLOTA  15%',    'color'=>'2563EB'],
            ['col'=>'S','span'=>1,'label'=>'TOTAL  100%',   'color'=>'7C3AED'],
        ];

        // Letras de columna A..S
        $colLetras = range('A','S');
        // Fila 2 etiquetas de pilar
        $pilarCols = ['C'=>['C','D','E','F'],'G'=>['G','H','I','J'],'K'=>['K','L','M','N','O'],'P'=>['P','Q','R'],'S'=>['S']];
        foreach ($grupos as $g) {
            $lastCol = $pilarCols[$g['col']][count($pilarCols[$g['col']])-1];
            $rango = $g['col'].'2:'.$lastCol.'2';
            $sheet->mergeCells($rango);
            $sheet->setCellValue($g['col'].'2', $g['label']);
            $sheet->getStyle($rango)->applyFromArray([
                'font'      => ['bold'=>true,'color'=>['rgb'=>'FFFFFF'],'size'=>9],
                'fill'      => ['fillType'=>'solid','startColor'=>['rgb'=>$g['color']]],
                'alignment' => ['horizontal'=>'center','vertical'=>'center'],
            ]);
        }
        // A2:B2 vacíos pero con fondo header
        $sheet->getStyle('A2:B2')->applyFromArray(['fill'=>['fillType'=>'solid','startColor'=>['rgb'=>$colores['header']]]]);
        $sheet->getRowDimension(2)->setRowHeight(18);

        // Fila 3: sub-encabezados
        $subHeaders = [
            'A'=>'Cédula','B'=>'Colaborador / Cargo',
            'C'=>'% ACI (10%)','D'=>'% OWD Ruta (15%)','E'=>'% Calificaciones (10%)','F'=>'Resultado Seg.',
            'G'=>'% DPO Academy (5%)','H'=>'% Ausentismo (5%)','I'=>'% Malas Marc. (5%)','J'=>'Resultado Gente',
            'K'=>'% Rechazos (11%)','L'=>'% SAC (8%)','M'=>'% Ad. Tiempo (8%)','N'=>'RMD (8%)','O'=>'Resultado Rep.',
            'P'=>'% CL Pre (7.5%)','Q'=>'% CL Post (7.5%)','R'=>'Resultado Flota',
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

        // Anchos de columnas
        $anchos = ['A'=>14,'B'=>30,'C'=>12,'D'=>13,'E'=>14,'F'=>12,'G'=>14,'H'=>13,'I'=>14,'J'=>12,'K'=>12,'L'=>10,'M'=>15,'N'=>10,'O'=>12,'P'=>13,'Q'=>13,'R'=>13,'S'=>12];
        foreach ($anchos as $col => $ancho) {
            $sheet->getColumnDimension($col)->setWidth($ancho);
        }

        // ── Filas de datos ────────────────────────────────────────────────────
        $fila = 4;
        foreach ($colaboradores as $colab) {
            // ACI
            $aciRealizadas  = (int) ($conteosPorColaborador[$colab->id] ?? 0);
            $pAci           = round(($aciRealizadas / self::META_BASE) * 100, 1);

            // OWD Ruta
            $pregRuta       = $preguntasRutaPorColaborador->get($colab->id, collect());
            $okR  = $pregRuta->filter(fn($p)=>str_contains(strtolower((string)$p->puntuacion),'ok')&&!str_contains(strtolower((string)$p->puntuacion),'no ok')&&!str_contains(strtolower((string)$p->puntuacion),'not'))->count();
            $noOkR= $pregRuta->filter(fn($p)=>str_contains(strtolower((string)$p->puntuacion),'no ok')||str_contains(strtolower((string)$p->puntuacion),'nook'))->count();
            $totR = $okR + $noOkR;
            $pOwd = $totR > 0 ? round(($okR / $totR) * 100, 1) : null;

            // Calificaciones
            $pCal = isset($promediosCalificaciones[$colab->cedula]) ? round((float)$promediosCalificaciones[$colab->cedula], 1) : null;

            // Resultado Seguridad — si un componente es N/A no resta
            $cAci  = min($pAci, 100) / 100;  // ACI siempre tiene valor (puede ser 0)
            $cOwd  = $pOwd !== null ? min($pOwd, 100) / 100 : null;
            $cCal  = $pCal !== null ? min($pCal, 100) / 100 : null;

            $puntosSeg  = $cAci * 10
                        + ($cOwd !== null ? $cOwd * 15 : 0)
                        + ($cCal !== null ? $cCal * 10 : 0);
            $pesoMaxSeg = 10
                        + ($cOwd !== null ? 15 : 0)
                        + ($cCal !== null ? 10 : 0);
            $rSeg = $pesoMaxSeg > 0 ? round(($puntosSeg / $pesoMaxSeg) * 35, 1) : 0.0;

            // DPO
            $enDpo = isset($dpoColaboradorIds[$colab->id]);
            if (!$enDpo && !empty($colab->codigo_qr_skap)) $enDpo = isset($dpoQrSafetySet[$normStr($colab->codigo_qr_skap)]);
            if (!$enDpo && !empty($colab->cedula))         $enDpo = isset($dpoQrSafetySet[$normStr($colab->cedula)]) || isset($dpoNombresSet[$normStr($colab->cedula)]);
            if (!$enDpo && !empty($colab->nombre_completo)) $enDpo = isset($dpoNombresSet[$normStr($colab->nombre_completo)]);
            $pDpo  = $enDpo ? 0.0 : 100.0;

            // Ausentismo
            $scsAus = $ausentismosPorColaboradorId[$colab->id] ?? null;
            if ($scsAus === null && !empty($colab->cedula))         $scsAus = $ausentismosPorIdentificador[$normStr($colab->cedula)] ?? null;
            if ($scsAus === null && !empty($colab->codigo_qr_skap)) $scsAus = $ausentismosPorIdentificador[$normStr($colab->codigo_qr_skap)] ?? null;
            $pAus = !empty($scsAus) ? (in_array(0.0, $scsAus, true) ? 0.0 : 100.0) : null;

            // Malas Marcaciones
            $enMarc = false;
            if (!empty($colab->cedula))          $enMarc = isset($marcacionesIdSet[$normStr($colab->cedula)]);
            if (!$enMarc && !empty($colab->codigo_qr_skap)) $enMarc = isset($marcacionesIdSet[$normStr($colab->codigo_qr_skap)]);
            if (!$enMarc && !empty($colab->nombre_completo)) $enMarc = isset($marcacionesNomSet[$normStr($colab->nombre_completo)]);
            $pMarc = $enMarc ? 0.0 : 100.0;

            // Resultado Gente
            $cDpo  = min($pDpo, 100)  / 100;
            $cAus  = $pAus  !== null ? min($pAus,  100) / 100 : 0;
            $cMarc = min($pMarc, 100) / 100;
            $rGente = round($cDpo*5 + $cAus*5 + $cMarc*5, 1);

            // Reparto
            $vRec  = $getRechazos($colab);
            $pRecRaw = !empty($vRec) ? array_sum($vRec)/count($vRec) : null;
            $pRec  = $pRecRaw !== null ? ($pRecRaw >= 2.4 ? 0.0 : 100.0) : null;

            $vSac  = $getVals($sacPorColId, $sacPorResp)($colab);
            $pSac  = !empty($vSac) ? round(array_sum($vSac)/count($vSac),1) : 100.0;

            $vAdt  = $getAdTiempo($colab);
            $pAdtRaw = !empty($vAdt) ? array_sum($vAdt)/count($vAdt) : null;
            $pAdt  = $pAdtRaw !== null ? ($pAdtRaw >= 83 ? 100.0 : 0.0) : null;

            $vRmd  = $getRmd($colab);
            $pRmdRaw = !empty($vRmd) ? array_sum($vRmd)/count($vRmd) : null;
            $pRmd  = $pRmdRaw !== null ? ($pRmdRaw >= 4 ? 100.0 : 0.0) : null;

            $cRec  = $pRec  !== null ? (int)($pRec >= 100) : 0;
            $cSac  = !empty($vSac) ? 0 : 1;
            $cAdt  = $pAdt  !== null ? (int)($pAdt >= 100) : 0;
            $cRmd  = $pRmd  !== null ? (int)($pRmd >= 100) : 0;
            $rRep  = round($cRec*11 + $cSac*8 + $cAdt*8 + $cRmd*8, 1);

            // Flota (Ambos Aprobados = 15%, Si uno No Aprobado = 0%)
            $esConductorExp = str_contains(strtoupper((string)($colab->cargo ?? '')), 'CONDUCTOR');
            if ($esConductorExp) {
                $mcExp = $checklistsManuales->get($colab->id);
                $clPreOk  = $mcExp ? (bool)$mcExp->cl_pre : true;
                $clPostOk = $mcExp ? (bool)$mcExp->cl_post : true;
                $pCpre = $clPreOk ? 100.0 : 0.0;
                $pCpost = $clPostOk ? 100.0 : 0.0;
                $rFlota = ($clPreOk && $clPostOk) ? 15.0 : 0.0;
            } else {
                $pCpre = null;
                $pCpost = null;
                $rFlota = 0.0;
            }

            // Total
            $total = round($rSeg + $rGente + $rRep + $rFlota, 1);

            $estado = $aciRealizadas >= self::META_BASE
                ? 'Meta Alcanzada'
                : ($aciRealizadas > 0 ? 'En Progreso' : 'Sin Participación');

            $fmt = fn($v) => $v !== null ? $v.'%' : 'N/A';

            $datos = [
                'A' => $colab->cedula,
                'B' => $colab->nombre_completo.' - '.($colab->cargo ?? 'Sin cargo'),
                'C' => $fmt($pAci),
                'D' => $fmt($pOwd),
                'E' => $fmt($pCal),
                'F' => $rSeg.'%',
                'G' => $pDpo.'%',
                'H' => $fmt($pAus),
                'I' => $pMarc.'%',
                'J' => $rGente.'%',
                'K' => $fmt($pRec),
                'L' => $pSac.'%',
                'M' => $fmt($pAdt),
                'N' => $pRmd !== null ? (string)$pRmd : 'N/A',
                'O' => $rRep.'%',
                'P' => $fmt($pCpre),
                'Q' => $fmt($pCpost),
                'R' => $rFlota.'%',
                'S' => $total.'%',
            ];

            foreach ($datos as $col => $val) {
                $sheet->setCellValue($col.$fila, $val);
                $bg = $pilarBg[$col] ?? null;
                $style = ['borders'=>['allBorders'=>['borderStyle'=>'thin','color'=>['rgb'=>'E2E8F0']]]];
                if ($bg) $style['fill'] = ['fillType'=>'solid','startColor'=>['rgb'=>$bg]];
                $sheet->getStyle($col.$fila)->applyFromArray($style);
            }

            // Fondo alternado para legibilidad
            if ($fila % 2 === 0) {
                $sheet->getStyle('A'.$fila.':B'.$fila)->applyFromArray(['fill'=>['fillType'=>'solid','startColor'=>['rgb'=>'F8FAFC']]]);
            }

            // Color estado en columna S
            $colorEstado = match($estado) {
                'Meta Alcanzada'   => '059669',
                'En Progreso'      => 'D97706',
                default            => 'E11D48',
            };
            $sheet->getStyle('S'.$fila)->getFont()->getColor()->setRGB($colorEstado);
            $sheet->getStyle('S'.$fila)->getFont()->setBold(true);

            $sheet->getRowDimension($fila)->setRowHeight(16);
            $fila++;
        }

        // Congelar paneles en la fila de datos
        $sheet->freezePane('C4');

        // Auto-filtro
        $sheet->setAutoFilter('A3:S3');

        // ── Generar respuesta streamed ────────────────────────────────────────
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

        $porcentajeAci = round(($aciRealizadas / self::META_BASE) * 100, 1);

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
            ->where(function ($q) use ($colaborador, $normStr) {
                $q->where('colaborador_id', $colaborador->id)
                  ->orWhereRaw('UPPER(REGEXP_REPLACE(qr_safety,"[^A-Z0-9]","")) = ?', [$normStr($colaborador->codigo_qr_skap ?? '')])
                  ->orWhereRaw('UPPER(REGEXP_REPLACE(nombre,"[^A-Z0-9]","")) = ?', [$normStr($colaborador->nombre_completo ?? '')]);
            })
            ->exists();

        // ── Eventos Tripulación ───────────────────────────────────────────
        // Se traen TODOS los registros del mes para poder calcular el promedio
        $eventosColaborador = DB::table('eventos_tripulacion')
            ->whereMonth('fecha', $mes)
            ->whereYear('fecha', $anio)
            ->where(function ($q) use ($colaborador, $normStr) {
                $q->whereRaw('UPPER(REGEXP_REPLACE(documento,"[^A-Z0-9]","")) = ?', [$normStr($colaborador->cedula)])
                  ->orWhereRaw('UPPER(REGEXP_REPLACE(nombre,"[^A-Z0-9]","")) = ?', [$normStr($colaborador->nombre_completo ?? '')]);
            })
            ->select(['rechazos','adherencia_tiempo','rmd','adherencia_checklist_pre','adherencia_checklist_post'])
            ->get();

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

        // ── Ausentismo ────────────────────────────────────────────────────
        $ausentismo = DB::table('ausentismos')
            ->whereMonth('fecha', $mes)
            ->whereYear('fecha', $anio)
            ->where(function ($q) use ($colaborador) {
                $q->where('colaborador_id', $colaborador->id)
                  ->orWhere('identificador', $colaborador->cedula);
            })
            ->get();

        $tieneIncapacidad = $ausentismo->contains(function ($row) {
            $vacios = ['','00:00','00:00:00','0','--:--'];
            return in_array(trim((string)($row->entro_1 ?? '')), $vacios, true)
                && in_array(trim((string)($row->entro_2 ?? '')), $vacios, true);
        });
        $porcentajeAusentismo = $ausentismo->isEmpty() ? null : ($tieneIncapacidad ? 0.0 : 100.0);

        // ── Malas Marcaciones ─────────────────────────────────────────────
        $tieneMalasMarcaciones = DB::table('correcciones_marcaciones')
            ->where(function ($q) use ($colaborador, $normStr) {
                $q->whereRaw('UPPER(REGEXP_REPLACE(identificacion,"[^A-Z0-9]","")) = ?', [$normStr($colaborador->cedula)])
                  ->orWhereRaw('UPPER(REGEXP_REPLACE(nombre_completo,"[^A-Z0-9]","")) = ?', [$normStr($colaborador->nombre_completo ?? '')]);
            })
            ->exists();

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
            'ausentismo'     => ['valor' => $porcentajeAusentismo, 'label' => $porcentajeAusentismo !== null ? "{$porcentajeAusentismo}%" : 'N/A', 'pilar' => 'Gente', 'peso' => 5, 'emoji' => '📅', 'titulo' => 'Ausentismo', 'meta_desc' => 'Sin incapacidad = 100%'],
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
}
