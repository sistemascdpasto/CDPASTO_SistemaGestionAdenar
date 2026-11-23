<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ConceptoAptitud;
use App\Models\Seguridad\Examen;
use App\Models\Seguridad\EvaluacionMedica;
use App\Models\Seguridad\EvaluacionRecomendacion;
use App\Models\Seguridad\ExamenEvaluacion;
use App\Models\Seguridad\Recomendacion;
use App\Services\Seguridad\EvaluacionMedicaService;
use App\Services\Seguridad\ExamenPdfExtractorService;
use App\Services\Seguridad\RecomendacionPdfMatcherService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class EvaluacionMedicaController extends Controller
{
    public function index(Request $request, EvaluacionMedicaService $service): Response
    {
        $tipoEvaluacion = $request->string('tipo_evaluacion')->toString();
        $estado = $request->string('estado')->toString();
        $verHistorial = $request->boolean('ver_historial');
        $colaboradorTexto = $request->string('colaborador')->toString();
        $identificacion = $request->string('identificacion')->toString();
        $cargo = $request->string('cargo')->toString();
        $centro = $request->string('centro')->toString();
        $colaboradorId = $request->integer('colaborador_id') ?: null;

        $evaluaciones = EvaluacionMedica::query()
            ->with(['colaborador:id,nombres,apellidos,cedula,cargo,centro,area,fecha_ingreso_empresa,fecha_retiro_empresa,is_active', 'conceptoAptitud:id,nombre'])
            ->withCount([
                'examenes as cantidad_requerida_examenes',
                'examenes as cantidad_ejecutada_examenes' => fn ($q) => $q->where('estado', 'realizado'),
            ])
            ->when(! $verHistorial, fn ($q) => $q->whereNotIn('estado', ['terminada', 'ejecutado'])->where(fn ($qq) => $qq->whereNull('fecha_entrada_bandeja')->orWhere('fecha_entrada_bandeja', '<=', now()->toDateString())))
            // Lógica de progresión (solo en vista activa, no en historial):
            //
            //   egreso   → siempre visible en bandeja
            //   ingreso  → visible solo si NO existe egreso para ese colaborador
            //   periódico → visible solo si NO existe egreso Y el ingreso ya está terminado
            //
            // El egreso se crea automáticamente cuando faltan ≤30 días para la
            // fecha fin de contrato; su existencia es suficiente para desplazar
            // ingreso y periódico de la bandeja activa.
            ->when(! $verHistorial && ! $tipoEvaluacion, function ($q) {
                $q->where(function ($q) {
                    // Rama 1: egreso — siempre pasa
                    $q->where('tipo_evaluacion', 'egreso')

                        // Rama 2: ingreso — solo si no existe egreso para este colaborador
                        ->orWhere(function ($q) {
                            $q->where('tipo_evaluacion', 'ingreso')
                                ->whereNotExists(function ($sub) {
                                    $sub->from('evaluaciones_medicas', 'em_eg')
                                        ->whereColumn('em_eg.colaborador_id', 'evaluaciones_medicas.colaborador_id')
                                        ->where('em_eg.tipo_evaluacion', 'egreso');
                                });
                        })

                        // Rama 3: periódico — solo si no existe egreso Y hay ingreso terminado
                        ->orWhere(function ($q) {
                            $q->where('tipo_evaluacion', 'periodico')
                                ->whereNotExists(function ($sub) {
                                    $sub->from('evaluaciones_medicas', 'em_eg')
                                        ->whereColumn('em_eg.colaborador_id', 'evaluaciones_medicas.colaborador_id')
                                        ->where('em_eg.tipo_evaluacion', 'egreso');
                                })
                                ->whereExists(function ($sub) {
                                    $sub->from('evaluaciones_medicas', 'em_ing')
                                        ->whereColumn('em_ing.colaborador_id', 'evaluaciones_medicas.colaborador_id')
                                        ->where('em_ing.tipo_evaluacion', 'ingreso')
                                        ->where('em_ing.estado', 'terminada');
                                });
                        });
                });
            })
            // Deduplicación: mostrar solo el registro más reciente (MAX id) por
            // colaborador + tipo. Evita que aparezcan múltiples filas del mismo
            // tipo cuando el colaborador tiene registros duplicados en la BD.
            ->whereIn('id', function ($sub) {
                $sub->selectRaw('MAX(id)')
                    ->from('evaluaciones_medicas')
                    ->groupBy('colaborador_id', 'tipo_evaluacion');
            })
            ->when($tipoEvaluacion, fn ($q, $v) => $q->where('tipo_evaluacion', $v))
            ->when($estado, fn ($q, $v) => $q->where('estado', $v))
            ->when($colaboradorId, fn ($q, $v) => $q->where('colaborador_id', $v))
            ->when($colaboradorTexto, function ($q, $v) {
                $q->whereHas('colaborador', function ($qq) use ($v) {
                    $qq->where('nombres', 'like', "%{$v}%")->orWhere('apellidos', 'like', "%{$v}%");
                });
            })
            ->when($identificacion, function ($q, $v) {
                $q->whereHas('colaborador', fn ($qq) => $qq->where('cedula', 'like', "%{$v}%"));
            })
            ->when($cargo, function ($q, $v) {
                $q->whereHas('colaborador', fn ($qq) => $qq->where('cargo', $v));
            })
            ->when($centro, function ($q, $v) {
                $q->whereHas('colaborador', fn ($qq) => $qq->where('centro', $v));
            })
            ->latest('fecha_evaluacion')
            ->paginate(15)
            ->withQueryString();

        $evaluaciones->getCollection()->transform(function (EvaluacionMedica $evaluacion) use ($service) {
            foreach ($service->indicadoresBandeja($evaluacion) as $clave => $valor) {
                $evaluacion->setAttribute($clave, $valor);
            }

            return $evaluacion;
        });

        return Inertia::render('seguridad/examenes-medicos/index', [
            'evaluaciones' => $evaluaciones,
            'filtros' => [
                'tipo_evaluacion' => $tipoEvaluacion,
                'estado' => $estado,
                'ver_historial' => $verHistorial,
                'colaborador' => $colaboradorTexto,
                'identificacion' => $identificacion,
                'cargo' => $cargo,
                'centro' => $centro,
            ],
            'catalogos' => [
                'cargos' => config('gente.colaboradores.cargos'),
                'centros' => config('gente.colaboradores.centros'),
            ],
        ]);
    }

    /**
     * Página de creación de nueva evaluación médica (crear.tsx).
     */
    public function create(): Response
    {
        return Inertia::render('seguridad/examenes-medicos/crear', [
            'colaboradores' => Colaborador::completos()
                ->orderBy('nombres')
                ->get(['id', 'nombres', 'apellidos', 'cedula', 'turno', 'cargo']),
        ]);
    }

    public function store(Request $request, EvaluacionMedicaService $service): RedirectResponse
    {
        $data = $request->validate([
            'colaborador_id'   => ['required', 'integer', 'exists:colaboradores,id'],
            'tipo_evaluacion'  => ['required', Rule::in(['ingreso', 'periodico', 'egreso'])],
        ]);

        $colaborador = Colaborador::findOrFail($data['colaborador_id']);
        $tipo = $data['tipo_evaluacion'];

        // ---------------------------------------------------------------
        // Regla de ciclos: Ingreso → Egreso → nuevo Ingreso → Egreso ...
        // ---------------------------------------------------------------

        if ($tipo === 'ingreso') {
            // Recuperar el Ingreso más reciente del colaborador
            $ultimoIngreso = EvaluacionMedica::where('colaborador_id', $colaborador->id)
                ->where('tipo_evaluacion', 'ingreso')
                ->latest('id')
                ->first();

            if ($ultimoIngreso) {
                // ¿Existe un Egreso posterior (id > ingreso) para cerrar ese ciclo?
                $egresoDelCiclo = EvaluacionMedica::where('colaborador_id', $colaborador->id)
                    ->where('tipo_evaluacion', 'egreso')
                    ->where('id', '>', $ultimoIngreso->id)
                    ->exists();

                if (! $egresoDelCiclo) {
                    // Si el ingreso existente no tenía exámenes cargados, generarlos si ahora existe matriz
                    if ($ultimoIngreso->examenes()->count() === 0) {
                        $service->generarExamenesDesdeMatriz($ultimoIngreso);
                        $service->recalcularEstado($ultimoIngreso);
                    }

                    // El ciclo aún está abierto: no crear otro Ingreso, abrir el existente
                    return redirect()
                        ->route('seguridad.examenes-medicos.show', $ultimoIngreso->id)
                        ->with('status', 'Ya existe un examen de Ingreso activo para este colaborador.');
                }
                // Si hay Egreso posterior → el ciclo cerró → se permite crear nuevo Ingreso
            }

            $evaluacion = $service->crear($colaborador, 'ingreso');

            return redirect()
                ->route('seguridad.examenes-medicos.show', $evaluacion->id)
                ->with('status', 'Evaluación médica de ingreso creada correctamente.');
        }

        if ($tipo === 'egreso') {
            // El Egreso solo puede crearse si hay un Ingreso previo en el ciclo
            $ultimoIngreso = EvaluacionMedica::where('colaborador_id', $colaborador->id)
                ->where('tipo_evaluacion', 'ingreso')
                ->latest('id')
                ->first();

            if (! $ultimoIngreso) {
                return back()->withErrors(['tipo_evaluacion' => 'No existe un examen de Ingreso previo para este colaborador.']);
            }

            // ¿Ya existe un Egreso posterior al último Ingreso?
            $egresoExistente = EvaluacionMedica::where('colaborador_id', $colaborador->id)
                ->where('tipo_evaluacion', 'egreso')
                ->where('id', '>', $ultimoIngreso->id)
                ->first();

            if ($egresoExistente) {
                // Ya existe Egreso del ciclo actual: abrir el existente, no duplicar
                return redirect()
                    ->route('seguridad.examenes-medicos.show', $egresoExistente->id)
                    ->with('status', 'Ya existe un examen de Egreso para el ciclo actual de este colaborador.');
            }

            $fechaRetiro = $colaborador->fecha_retiro_empresa ? Carbon::parse($colaborador->fecha_retiro_empresa) : null;
            $fechaEntrada = $fechaRetiro ? $fechaRetiro->copy()->subDays(30) : null;

            $evaluacion = $service->crear($colaborador, 'egreso', $fechaRetiro, $fechaEntrada);

            return redirect()
                ->route('seguridad.examenes-medicos.show', $evaluacion->id)
                ->with('status', 'Evaluación de egreso creada correctamente.');
        }

        // Tipo periódico: sin restricción de ciclo (la crea normalmente)
        $evaluacion = $service->crear($colaborador, $tipo);

        return redirect()
            ->route('seguridad.examenes-medicos.show', $evaluacion->id)
            ->with('status', 'Evaluación médica creada correctamente.');
    }

    /**
     * POST /examenes-medicos/{evaluacion}/iniciar
     *
     * Genera los exámenes desde la matriz del cargo (sin duplicar los
     * existentes) y recalcula el estado. Equivale a lo que hace crear()
     * internamente pero aplicado sobre una evaluación ya existente.
     */
    public function iniciar(EvaluacionMedica $evaluacion, EvaluacionMedicaService $service): RedirectResponse
    {
        $service->iniciar($evaluacion);

        return back()->with('status', 'Evaluación iniciada. Los exámenes de la matriz han sido cargados.');
    }

    /**
     * Vista de detalle y edición unificada (show.tsx).
     */
    public function show(EvaluacionMedica $evaluacion, EvaluacionMedicaService $service): Response
    {
        $historialEvaluaciones = $service->obtenerHistorialConCiclos($evaluacion->colaborador_id);

        // Forzar recarga de seguimientos con todas las columnas incluyendo soporte_path
        $evaluacion->load([
            'colaborador',
            'conceptoAptitud',
            'examenes.examen',
            'recomendaciones.recomendacion',
        ]);
        
        // Cargar seguimientos por separado para asegurar que incluya soporte_path
        $evaluacion->recomendaciones->each(function ($recomendacion) {
            $recomendacion->load([
                'seguimientos' => function ($q) {
                    $q->select('id', 'evaluacion_recomendacion_id', 'fecha_seguimiento', 'estado_seguimiento', 'observacion', 'responsable_id', 'fecha_proximo_seguimiento', 'carta_recomendacion_entregada', 'soporte_path', 'created_at', 'updated_at')
                      ->orderBy('id', 'asc');
                },
                'seguimientos.responsable:id,first_name,last_name',
            ]);
        });

        // Obtener TODAS las recomendaciones del colaborador de todas sus evaluaciones médicas
        $todasRecomendaciones = EvaluacionRecomendacion::query()
            ->whereHas('evaluacionMedica', function ($q) use ($evaluacion) {
                $q->where('colaborador_id', $evaluacion->colaborador_id);
            })
            ->with([
                'recomendacion',
                'evaluacionMedica:id,tipo_evaluacion,numero_periodo,fecha_evaluacion',
                'seguimientos' => function ($q) {
                    $q->select('id', 'evaluacion_recomendacion_id', 'fecha_seguimiento', 'estado_seguimiento', 'observacion', 'responsable_id', 'fecha_proximo_seguimiento', 'carta_recomendacion_entregada', 'soporte_path', 'created_at', 'updated_at')
                      ->orderBy('id', 'asc');
                },
                'seguimientos.responsable:id,first_name,last_name',
            ])
            ->orderBy('fecha_registro', 'desc')
            ->get()
            ->map(function ($rec) {
                // Agregar información de origen para mostrar en la tabla
                $origen = $rec->evaluacionMedica->tipo_evaluacion;
                $periodo = $rec->evaluacionMedica->numero_periodo;
                $fecha = $rec->evaluacionMedica->fecha_evaluacion;
                
                $origenLabel = match($origen) {
                    'ingreso' => 'INGRESO',
                    'periodico' => $periodo ? "PERIÓDICO #{$periodo}" : 'PERIÓDICO',
                    'egreso' => 'EGRESO',
                    default => strtoupper($origen),
                };
                
                $rec->origen_evaluacion = $origenLabel;
                $rec->fecha_origen = $fecha;
                
                return $rec;
            });

        return Inertia::render('seguridad/examenes-medicos/show', [
            'evaluacion' => $evaluacion,
            'historialEvaluaciones' => $historialEvaluaciones,
            'todasRecomendaciones' => $todasRecomendaciones,
            'conceptosAptitud' => ConceptoAptitud::where('activo', true)->orderBy('nombre')->get(['id', 'nombre']),
            'examenesCatalogo' => Examen::where('activo', true)->orderBy('nombre')->get(['id', 'nombre']),
            'recomendacionesCatalogo' => Recomendacion::where('activo', true)->orderBy('categoria')->orderBy('nombre')->get(['id', 'nombre', 'categoria']),
            'categoriasRecomendacion' => config('gente.examenes_medicos.recomendaciones.categorias') ?? [],
            'estadosSeguimiento' => config('gente.examenes_medicos.recomendaciones.estados_seguimiento') ?? [],
            'seguimientoOpciones' => config('gente.examenes_medicos.egreso.seguimiento_recomendaciones') ?? [],
            'empresaDefault' => config('gente.examenes_medicos.empresa_default') ?? 'Adenar',
        ]);
    }

    public function programarTodos(Request $request, EvaluacionMedica $evaluacion, EvaluacionMedicaService $service): RedirectResponse
    {
        $data = $request->validate(['fecha_programacion' => ['required', 'date']]);

        $evaluacion->examenes()
            ->where('estado', '!=', 'realizado')
            ->update([
                'fecha_programacion' => $data['fecha_programacion'],
                'estado' => 'programado',
            ]);

        $service->recalcularEstado($evaluacion);

        return back()->with('status', 'Todos los exámenes fueron programados.');
    }

    public function ejecutarTodos(
        Request $request,
        EvaluacionMedica $evaluacion,
        EvaluacionMedicaService $service,
        ExamenPdfExtractorService $extractor,
        RecomendacionPdfMatcherService $matcher,
    ): RedirectResponse {
        $data = $request->validate([
            'fecha_ejecucion' => ['required', 'date'],
            'soporte' => ['nullable', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:5120'],
        ]);

        $soportePath = null;
        $camposPdf = [];

        if ($request->hasFile('soporte')) {
            $archivo = $request->file('soporte');

            if (strtolower((string) $archivo->getClientOriginalExtension()) === 'pdf') {
                $texto = $extractor->extraerTexto($archivo->getRealPath());

                if ($texto !== '') {
                    $camposPdf = $extractor->extraerCamposIngreso($texto);
                    $matcher->marcarCoincidencias($evaluacion, $texto);
                }
            }

            $soportePath = $archivo->store('examenes-medicos', 'public');
        }

        $updateData = [
            'fecha_ejecucion' => $data['fecha_ejecucion'],
            'estado' => 'realizado',
            ...$camposPdf,
        ];

        if ($soportePath) {
            $updateData['soporte_path'] = $soportePath;
        }

        $evaluacion->examenes()
            ->where('estado', '!=', 'realizado')
            ->update($updateData);

        $service->recalcularEstado($evaluacion);

        return back()->with('status', 'Ejecución registrada para todos los exámenes.');
    }

    public function programarExamen(
        Request $request,
        EvaluacionMedica $evaluacion,
        ExamenEvaluacion $examenEvaluacion,
        EvaluacionMedicaService $service,
    ): RedirectResponse {
        $data = $request->validate(['fecha_programacion' => ['required', 'date']]);

        $examenEvaluacion->update([...$data, 'estado' => 'programado']);
        $service->recalcularEstado($evaluacion);

        return back()->with('status', 'Examen programado.');
    }

    public function ejecutarExamen(
        Request $request,
        EvaluacionMedica $evaluacion,
        ExamenEvaluacion $examenEvaluacion,
        EvaluacionMedicaService $service,
        ExamenPdfExtractorService $extractor,
        RecomendacionPdfMatcherService $matcher,
    ): RedirectResponse {
        $data = $request->validate([
            'fecha_ejecucion' => ['required', 'date'],
            'soporte' => ['nullable', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:5120'],
            'observacion' => ['nullable', 'string', 'max:2000'],
        ]);

        $soportePath = $examenEvaluacion->soporte_path;
        $camposPdf = [];

        if ($request->hasFile('soporte')) {
            $archivo = $request->file('soporte');

            // HU-033: si es PDF, se extrae texto ANTES de moverlo a storage
            // (una vez movido, la ruta temporal original ya no es válida).
            if (strtolower((string) $archivo->getClientOriginalExtension()) === 'pdf') {
                $texto = $extractor->extraerTexto($archivo->getRealPath());

                if ($texto !== '') {
                    $camposPdf = $extractor->extraerCamposIngreso($texto);
                    $matcher->marcarCoincidencias($evaluacion, $texto);
                }
            }

            $soportePath = $archivo->store('examenes-medicos', 'public');
        }

        $examenEvaluacion->update([
            'fecha_ejecucion' => $data['fecha_ejecucion'],
            'observacion' => $data['observacion'] ?? $examenEvaluacion->observacion,
            'soporte_path' => $soportePath,
            'estado' => 'realizado',
            ...$camposPdf,
        ]);

        $service->recalcularEstado($evaluacion);

        return back()->with('status', 'Ejecución del examen registrada.');
    }

    public function agregarExamenAdicional(Request $request, EvaluacionMedica $evaluacion, EvaluacionMedicaService $service): RedirectResponse
    {
        $data = $request->validate([
            'examen_id' => [
                'required', 'integer', 'exists:examenes,id',
                Rule::unique('examenes_evaluacion', 'examen_id')->where('evaluacion_medica_id', $evaluacion->id),
            ],
        ]);

        $evaluacion->examenes()->create([
            'examen_id' => $data['examen_id'],
            'obligatorio' => false,
            'origen' => 'adicional',
            'estado' => 'pendiente',
        ]);

        $service->recalcularEstado($evaluacion);

        return back()->with('status', 'Examen adicional agregado.');
    }

    public function actualizarConceptoAptitud(Request $request, EvaluacionMedica $evaluacion, EvaluacionMedicaService $service): RedirectResponse
    {
        $data = $request->validate([
            'concepto_aptitud_id' => ['nullable'],
            'emite' => ['nullable', 'string', 'max:255'],
            'empresa' => ['nullable', 'string', 'max:255'],
            'observacion' => ['nullable', 'string', 'max:2000'],
        ]);

        $data['concepto_aptitud_id'] = !empty($data['concepto_aptitud_id']) ? (int) $data['concepto_aptitud_id'] : null;

        if (empty($data['empresa'])) {
            $data['empresa'] = config('gente.examenes_medicos.empresa_default') ?? 'Adenar';
        }

        $evaluacion->update($data);
        $service->recalcularEstado($evaluacion);

        return back()->with('status', 'Concepto de aptitud actualizado.');
    }

    public function programarEgreso(Request $request, EvaluacionMedica $evaluacion, EvaluacionMedicaService $service): RedirectResponse
    {
        $data = $request->validate(['fecha_programacion' => ['required', 'date']]);

        $evaluacion->update($data);
        $service->recalcularEstadoEgreso($evaluacion);

        return back()->with('status', 'Examen de egreso programado.');
    }

    public function ejecutarEgreso(Request $request, EvaluacionMedica $evaluacion, EvaluacionMedicaService $service): RedirectResponse
    {
        $data = $request->validate([
            'fecha_examen_ejecutado' => ['required', 'date'],
            'soporte' => ['nullable', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:5120'],
        ]);

        $soportePath = $evaluacion->soporte_path;

        if ($request->hasFile('soporte')) {
            $soportePath = $request->file('soporte')->store('examenes-medicos', 'public');
        }

        $evaluacion->update([
            'fecha_examen_ejecutado' => $data['fecha_examen_ejecutado'],
            'soporte_path' => $soportePath,
        ]);
        $service->recalcularEstadoEgreso($evaluacion);

        return back()->with('status', 'Ejecución del examen de egreso registrada.');
    }

    public function rechazarEgreso(Request $request, EvaluacionMedica $evaluacion, EvaluacionMedicaService $service): RedirectResponse
    {
        $data = $request->validate(['observacion_rechazo' => ['required', 'string', 'max:2000']]);

        $service->rechazarEgreso($evaluacion, $data['observacion_rechazo']);

        return back()->with('status', 'Rechazo del examen de egreso registrado.');
    }

    public function actualizarSeguimientoEgreso(Request $request, EvaluacionMedica $evaluacion): RedirectResponse
    {
        $opciones = config('gente.examenes_medicos.egreso.seguimiento_recomendaciones');
        $requiereDetalle = $request->input('seguimiento_recomendaciones') === 'Soporte desestimiento u otro';

        $data = $request->validate([
            'seguimiento_recomendaciones' => ['required', Rule::in($opciones)],
            'seguimiento_recomendaciones_detalle' => [Rule::requiredIf($requiereDetalle), 'nullable', 'string', 'max:2000'],
        ]);

        $evaluacion->update($data);

        return back()->with('status', 'Seguimiento a recomendaciones actualizado.');
    }
}
