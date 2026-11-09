<?php

namespace App\Http\Controllers\Gente;

use App\Exports\Gente\ContratosExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\Gente\UpdateContratoColaboradorRequest;
use App\Http\Requests\Gente\UpdateContratoProrrogaRequest;
use App\Models\Gente\ContratoProrroga;
use App\Models\Gente\ColaboradorContrato;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorDocumento;
use App\Services\Gente\ContratoVigenciaService;
use App\Services\Seguridad\ColaboradorCatalogoService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;

class ContratosController extends Controller
{
    public const CAMPOS_CONTRATO = [
        'documento_contrato' => 'Contrato firmado',
    ];

    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $estado = $request->string('estado')->trim()->toString();

        $colaboradores = $this->consultaContratos($search, $estado)
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('gente/contratos/index', [
            'colaboradores' => $colaboradores,
            'filters' => [
                'search' => $search,
                'estado' => $estado,
            ],
        ]);
    }

    public function exportar(Request $request)
    {
        $search = $request->string('search')->trim()->toString();
        $estado = $request->string('estado')->trim()->toString();

        $colaboradores = $this->consultaContratos($search, $estado)
            ->with([
                'prorrogas' => fn (HasMany $query) => $query
                    ->where('tipo', 'prorroga')
                    ->reorder()
                    ->orderBy('fecha_nueva')
                    ->orderBy('id'),
                'documentos' => fn (HasMany $query) => $query
                    ->select('id', 'colaborador_id', 'campo', 'path', 'fecha_documento')
                    ->where('campo', 'documento_preaviso_terminacion'),
            ])
            ->get();

        return Excel::download(new ContratosExport($colaboradores), 'contratos.xlsx');
    }

    private function consultaContratos(string $search, string $estado): Builder
    {
        return Colaborador::query()
            ->select([
                'id',
                'cedula',
                'nombres',
                'apellidos',
                'cargo',
                'tipo_contrato',
                'fecha_ingreso_empresa',
                'fecha_retiro_empresa',
                'is_active',
            ])
            ->withExists(['prorrogas as tiene_finalizacion' => fn ($query) => $query->where('tipo', 'finalizacion')])
            ->withCount(['prorrogas as cantidad_prorrogas' => fn (Builder $query) => $query->where('tipo', 'prorroga')])
            ->withMax(['prorrogas as ultima_fecha_prorroga' => fn (Builder $query) => $query->where('tipo', 'prorroga')], 'fecha_nueva')
            ->completos()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('nombres', 'like', "%{$search}%")
                        ->orWhere('apellidos', 'like', "%{$search}%")
                        ->orWhere('cedula', 'like', "%{$search}%");
                });
            })
            ->when($estado === 'activo', fn ($query) => $query->where('is_active', true))
            ->when($estado === 'inactivo', fn ($query) => $query->where('is_active', false))
            ->orderBy('nombres');
    }

    /**
     * Muestra la vista de detalle del contrato de un colaborador con su documentación.
     */
    public function show(
        Colaborador $colaborador,
        ColaboradorCatalogoService $catalogos,
        ContratoVigenciaService $contratoVigencia,
    ): Response {
        $documentosMap = [];

        foreach (array_keys(self::CAMPOS_CONTRATO) as $campo) {
            $documentosMap[$campo] = [];

            // Si tiene columna directa en colaborador
            if (! empty($colaborador->{$campo})) {
                $documentosMap[$campo][] = [
                    'id' => null,
                    'path' => Storage::url($colaborador->{$campo}),
                    'fecha' => null,
                    'name' => basename($colaborador->{$campo}),
                ];
            }
        }

        // Documentos en la tabla colaborador_documentos
        $docsDB = $colaborador->documentos()
            ->whereIn('campo', array_keys(self::CAMPOS_CONTRATO))
            ->orderBy('id')
            ->get();

        foreach ($docsDB as $doc) {
            $documentosMap[$doc->campo][] = [
                'id' => $doc->id,
                'contrato_id' => $doc->contrato_id,
                'path' => $doc->path ? Storage::url($doc->path) : null,
                'fecha' => $doc->fecha_documento?->format('Y-m-d'),
                'name' => $doc->nombre_original ?? ($doc->path ? basename($doc->path) : null),
                'tipo_contrato' => $doc->tipo_contrato,
            ];
        }

        $formatFecha = fn ($val) => $val instanceof CarbonInterface
            ? $val->format('Y-m-d')
            : ($val ? (string) $val : null);

        $activacionesDB = [];
        try {
            $activacionesDB = $colaborador->activacionHistorial()
                ->with('user:id,name')
                ->orderByDesc('fecha')
                ->get()
                ->map(fn ($h) => [
                    'id' => (string) $h->id,
                    'is_active' => (bool) $h->is_active,
                    'tipo' => $h->tipo,
                    'fecha' => $h->fecha?->format('d/m/Y h:i A') ?? ($h->fecha ? (string) $h->fecha : null),
                    'motivo' => $h->motivo,
                    'observaciones' => $h->observaciones,
                    'usuario' => $h->user?->name,
                ])
                ->all();
        } catch (\Throwable) {
            $activacionesDB = [];
        }

        $eventosSinteticos = [];
        if ($colaborador->ha_trabajado_antes === 'si' || $colaborador->fecha_ultima_laboral) {
            $eventosSinteticos[] = [
                'id' => 'prev-desactivacion',
                'is_active' => false,
                'tipo' => 'desactivacion',
                'fecha' => $formatFecha($colaborador->fecha_ultima_laboral) ?? 'Periodo anterior',
                'motivo' => $colaborador->motivo_retiro ?: 'Finalización de contrato previo (Salida)',
                'observaciones' => $colaborador->motivo_retiro_observaciones ?: ($colaborador->cargo_anterior ? "Cargo previo: {$colaborador->cargo_anterior}" : null),
                'usuario' => 'Retiro / Desactivación previa',
            ];

            $eventosSinteticos[] = [
                'id' => 'reingreso-activacion',
                'is_active' => true,
                'tipo' => 'activacion',
                'fecha' => $formatFecha($colaborador->fecha_ingreso_empresa) ?? $formatFecha($colaborador->created_at),
                'motivo' => 'Reactivación para reingreso a la empresa (Entrada)',
                'observaciones' => 'Reactivado en el sistema para nueva vinculación laboral. Cargo: '.($colaborador->cargo ?: 'Asignado').($colaborador->tipo_contrato ? " ({$colaborador->tipo_contrato})" : ''),
                'usuario' => 'Reingreso registrado',
            ];
        }

        if (! $colaborador->is_active && empty($activacionesDB) && empty($eventosSinteticos)) {
            $eventosSinteticos[] = [
                'id' => 'actual-desactivado',
                'is_active' => false,
                'tipo' => 'desactivacion',
                'fecha' => $formatFecha($colaborador->fecha_retiro_empresa) ?? $formatFecha($colaborador->updated_at),
                'motivo' => $colaborador->motivo_retiro ?: 'Desactivación de contrato',
                'observaciones' => $colaborador->motivo_retiro_observaciones,
                'usuario' => 'Sistema',
            ];
        }

        $historialActivaciones = ! empty($activacionesDB)
            ? $activacionesDB
            : array_reverse($eventosSinteticos);

        // Fechas de finalización para preavisos (detectadas de la fecha actual y de prórrogas)
        $fechasFinalizacion = collect();

        // fecha_desde para la tarjeta actual: fecha_nueva de la última prórroga, o fecha_ingreso_empresa
        $ultimaProrroga = $colaborador->prorrogas()
            ->where('tipo', 'prorroga')
            ->orderByDesc('created_at')
            ->first();
        $fechaDesdeActual = $ultimaProrroga?->fechaInicioEfectiva()
            ? $ultimaProrroga->fechaInicioEfectiva()->format('d/m/Y')
            : ($ultimaProrroga?->fecha_anterior
                ? Carbon::parse($ultimaProrroga->fecha_anterior)->addDay()->format('d/m/Y')
                : ($colaborador->fecha_ingreso_empresa ? Carbon::parse($colaborador->fecha_ingreso_empresa)->format('d/m/Y') : null));

        // 1. Fecha de retiro actual del colaborador
        if ($colaborador->fecha_retiro_empresa) {
            $fechaActual = Carbon::parse($colaborador->fecha_retiro_empresa);
            $fechaActualStr = $fechaActual->format('Y-m-d');
            $fechasFinalizacion->put($fechaActualStr, [
                'fecha' => $fechaActualStr,
                'fecha_formateada' => $fechaActual->format('d/m/Y'),
                'es_actual' => true,
                'estado' => $colaborador->tieneFinalizacionConfirmada()
                    ? 'Finalización confirmada'
                    : 'Fecha actual de vencimiento',
                'fecha_desde' => $fechaDesdeActual,
                'fecha_hasta' => $fechaActual->format('d/m/Y'),
            ]);
        }

        // 2. Fechas de las prórrogas (fecha_nueva de cada prórroga, excluyendo la actual ya registrada)
        foreach ($colaborador->prorrogas()->orderBy('created_at')->get() as $p) {
            if ($p->fecha_nueva) {
                $fechaNueva = Carbon::parse($p->fecha_nueva);
                $fechaNuevaStr = $fechaNueva->format('Y-m-d');
                if (! $fechasFinalizacion->has($fechaNuevaStr)) {
                    $fechasFinalizacion->put($fechaNuevaStr, [
                        'fecha' => $fechaNuevaStr,
                        'fecha_formateada' => $fechaNueva->format('d/m/Y'),
                        'es_actual' => false,
                        'estado' => $p->tipo === 'finalizacion' ? 'Finalización' : 'Histórico',
                        'fecha_desde' => $p->fechaInicioEfectiva()
                                ? $p->fechaInicioEfectiva()->format('d/m/Y')
                                : ($p->fecha_anterior ? Carbon::parse($p->fecha_anterior)->addDay()->format('d/m/Y') : null),
                        'fecha_hasta' => $fechaNueva->format('d/m/Y'),
                    ]);
                }
            }
        }

        // 3. Documentos de preaviso registrados en colaborador_documentos
        $preavisosDocs = $colaborador->documentos()
            ->where('campo', 'documento_preaviso_terminacion')
            ->orderByDesc('id')
            ->get();

        // Mapear el documento de preaviso que le corresponde a cada fecha
        $fechasFinalizacionList = $fechasFinalizacion->values()->map(function ($item) use ($preavisosDocs) {
            $doc = $preavisosDocs->first(function ($d) use ($item) {
                return $d->fecha_documento && $d->fecha_documento->format('Y-m-d') === $item['fecha'];
            });

            return array_merge($item, [
                'documento' => $doc ? [
                    'id' => $doc->id,
                    'name' => basename($doc->path),
                    'path' => Storage::url($doc->path),
                    'fecha' => $doc->fecha_documento?->format('Y-m-d'),
                ] : null,
            ]);
        });

        // 4. Preavisos huérfanos o con fechas distintas a las detectadas
        $fechasConocidas = $fechasFinalizacion->keys()->all();
        $otrosPreavisos = $preavisosDocs->filter(function ($d) use ($fechasConocidas) {
            return ! $d->fecha_documento || ! in_array($d->fecha_documento->format('Y-m-d'), $fechasConocidas, true);
        })->map(fn ($doc) => [
            'id' => $doc->id,
            'name' => basename($doc->path),
            'path' => Storage::url($doc->path),
            'fecha' => $doc->fecha_documento?->format('Y-m-d'),
        ])->values()->all();

        $prorrogasCronologicas = $colaborador->prorrogas()
            ->where('tipo', 'prorroga')
            ->reorder()
            ->orderBy('fecha_nueva')
            ->orderBy('id')
            ->get();
        $colaborador->setRelation('prorrogas', $prorrogasCronologicas);
        $numeroProrrogaPorId = $contratoVigencia->numerarProrrogas($prorrogasCronologicas);
        $contratoActual = $contratoVigencia->contratoActual($colaborador);

        return Inertia::render('gente/contratos/show', [
            'colaborador' => [
                'id' => $colaborador->id,
                'cedula' => $colaborador->cedula,
                'nombres' => $colaborador->nombres,
                'apellidos' => $colaborador->apellidos,
                'nombre_completo' => "{$colaborador->nombres} {$colaborador->apellidos}",
                'cargo' => $colaborador->cargo,
                'area' => $colaborador->area,
                'tipo_contrato' => $colaborador->tipo_contrato,
                'fecha_ingreso_empresa' => $formatFecha($colaborador->fecha_ingreso_empresa),
                'fecha_retiro_empresa' => $formatFecha($colaborador->fecha_retiro_empresa),
                'fecha_vencimiento_vigente' => $formatFecha($ultimaProrroga?->fecha_nueva ?? $colaborador->fecha_retiro_empresa),
                'contrato_actual_id' => $contratoActual?->id,
                'cantidad_prorrogas_contrato_actual' => $contratoVigencia->cantidadProrrogas($colaborador, $contratoActual),
                'contrato_actual_es_aprendiz' => $contratoActual
                    ? $contratoActual->esAprendiz()
                    : $contratoVigencia->esAprendiz($colaborador, $contratoActual),
                'is_active' => (bool) $colaborador->is_active,
                'imagen' => $colaborador->imagen,

                // Antecedentes en la empresa y reingreso
                'ha_trabajado_antes' => $colaborador->ha_trabajado_antes,
                'cargo_anterior' => $colaborador->cargo_anterior,
                'fecha_ultima_laboral' => $formatFecha($colaborador->fecha_ultima_laboral),
                'motivo_retiro' => $colaborador->motivo_retiro,
                'motivo_retiro_observaciones' => $colaborador->motivo_retiro_observaciones,

                // Historial de activación y desactivación
                'historial_activaciones' => $historialActivaciones,

                // Ubicación y contrato
                'centro' => $colaborador->centro,
                'centro_trabajo' => $colaborador->centro_trabajo,
                'contrato_fecha_desde' => $formatFecha($colaborador->contrato_fecha_desde),
                'contrato_fecha_hasta' => $formatFecha($colaborador->contrato_fecha_hasta),

                // Historial de prórrogas
                'prorrogas' => $colaborador->prorrogas()
                    ->with('registradoPor:id,name')
                    ->orderByDesc('created_at')
                    ->get()
                    ->map(fn ($p) => [
                        'id' => $p->id,
                        'fecha_anterior' => $p->fecha_anterior?->format('Y-m-d'),
                        'fecha_inicio' => $p->fechaInicioEfectiva()?->format('Y-m-d'),
                        'fecha_nueva' => $p->fecha_nueva?->format('Y-m-d'),
                        'contrato_id' => $p->contrato_id,
                        'numero_prorroga' => $p->tipo === 'prorroga' ? $numeroProrrogaPorId->get($p->id) : null,
                        'tipo' => $p->tipo,
                        'observaciones' => $p->observaciones,
                        'documento_path' => $p->documento_path ? Storage::url($p->documento_path) : null,
                        'documento_nombre' => $p->documento_nombre ?? ($p->documento_path ? basename($p->documento_path) : null),
                        'registrado_por' => $p->registradoPor?->name,
                        'fecha_registro' => $p->created_at->format('d/m/Y H:i'),
                    ])
                    ->values()
                    ->all(),

                // Indicador de alerta: ≤ 35 días para el vencimiento.
                // Si hay prórrogas, la fecha vigente es la fecha_nueva de la última prórroga;
                // si no, se usa fecha_retiro_empresa del colaborador.
                'dias_para_vencimiento' => (function () use ($colaborador, $ultimaProrroga) {
                    $fechaVigente = $ultimaProrroga?->fecha_nueva ?? $colaborador->fecha_retiro_empresa;
                    return $fechaVigente
                        ? (int) now()->startOfDay()->diffInDays($fechaVigente, false)
                        : null;
                })(),

                // ¿Ya se registró una finalización? Si sí, no mostrar banner ni permitir más prórrogas
                'tiene_finalizacion' => $colaborador->tieneFinalizacionConfirmada(),

                // Historial de cargos — cada cargo se asocia al periodo del
                // contrato/prórroga al que pertenece su fecha de inicio, usando
                // la misma regla central que valida el cambio de cargo.
                'historial_cargos' => $colaborador->cargos()
                    ->orderByDesc('fecha_inicio')
                    ->get()
                    ->map(function ($c) use ($colaborador, $formatFecha, $numeroProrrogaPorId) {
                        $periodo = $c->fecha_inicio
                            ? $colaborador->periodoCargoParaFecha($c->fecha_inicio)
                            : null;

                        $pertenece = match (true) {
                            $periodo === null => 'Sin periodo contractual asociado',
                            $periodo['tipo'] === 'prorroga' && $periodo['prorroga'] !== null => 'Prórroga '
                                .$numeroProrrogaPorId->get($periodo['prorroga']->id),
                            default => 'Contrato inicial',
                        };

                        return [
                            'id' => $c->id,
                            'cargo' => $c->cargo,
                            'fecha_inicio' => $formatFecha($c->fecha_inicio),
                            'fecha_fin' => $formatFecha($c->fecha_fin),
                            'estado' => $c->estado,
                            'pertenece_a' => $pertenece,
                        ];
                    })
                    ->values(),

                // Historial de contratos (independiente de prórrogas)
                'historial_contratos' => $colaborador->contratos()
                    ->reorder()
                    ->orderByRaw('CASE WHEN fecha_inicio IS NULL THEN 1 ELSE 0 END')
                    ->orderBy('fecha_inicio')
                    ->orderBy('id')
                    ->withCount(['prorrogas as cantidad_prorrogas' => fn ($query) => $query->where('tipo', 'prorroga')])
                    ->with('registradoPor:id,name')
                    ->get()
                    ->map(fn ($c) => [
                        'id' => $c->id,
                        'tipo_contrato' => $c->tipo_contrato,
                        'tipo_contrato_otro' => $c->tipo_contrato_otro,
                        'fecha_inicio' => $formatFecha($c->fecha_inicio),
                        'fecha_fin' => $formatFecha($c->fecha_fin),
                        'cantidad_prorrogas' => $c->cantidad_prorrogas,
                        'es_aprendiz' => $c->esAprendiz(),
                        'estado' => $c->estado,
                        'observaciones' => $c->observaciones,
                        'registrado_por' => $c->registradoPor?->name,
                        'fecha_registro' => $c->created_at->format('d/m/Y H:i'),
                    ])
                    ->values()
                    ->all(),
            ],
            'documentos' => $documentosMap,
            'catalogos' => [
                'cargos' => $catalogos->cargos(),
                'tiposContrato' => $catalogos->tiposContrato(),
            ],
            'fechas_preaviso' => $fechasFinalizacionList,
            'otros_preavisos' => $otrosPreavisos,
            'campos' => collect(self::CAMPOS_CONTRATO)->map(fn ($label, $key) => [
                'key' => $key,
                'label' => $label,
            ])->values(),
        ]);
    }

    /**
     * Guarda nuevos archivos de documentación de contrato para el colaborador.
     */
    public function storeDocumentos(Request $request, Colaborador $colaborador): RedirectResponse
    {
        $camposPermitidos = array_keys(self::CAMPOS_CONTRATO);

        $rules = [];
        foreach ($camposPermitidos as $campo) {
            $rules[$campo] = ['nullable', 'array'];
            $rules["{$campo}.*"] = ['file', 'mimes:pdf,doc,docx,jpg,jpeg,png'];
        }
        $rules['contrato_id'] = [
            'required',
            'integer',
            Rule::exists('colaborador_contratos', 'id')
                ->where('colaborador_id', $colaborador->id),
        ];

        if (! $request->hasFile('documento_contrato') && ! $request->hasFile('documento_prorroga')) {
            return back()->withErrors([
                'documentos' => 'No se recibió ningún archivo. Intenta adjuntarlo nuevamente.',
            ]);
        }

        $validated = $request->validate($rules);
        $contrato = $colaborador->contratos()->findOrFail($validated['contrato_id']);

        foreach ($camposPermitidos as $campo) {
            $archivos = $request->file($campo, []);
            $archivos = is_array($archivos) ? $archivos : [$archivos];

            foreach (array_filter($archivos) as $archivo) {
                $path = $archivo->store('colaboradores/documentos', 'public');
                if (! $path) {
                    return back()->withErrors([
                        'documentos' => 'No fue posible guardar el archivo. Intenta nuevamente.',
                    ]);
                }

                $documento = $contrato->documentos()->first();
                $pathAnterior = $documento?->path;
                $atributos = [
                    'colaborador_id' => $colaborador->id,
                    'contrato_id' => $contrato->id,
                    'campo' => $campo,
                    'path' => $path,
                    'nombre_original' => $archivo->getClientOriginalName(),
                    'tipo_contrato' => $contrato->tipo_contrato,
                    'fecha_documento' => $contrato->fecha_inicio,
                ];

                if ($documento) {
                    $documento->update($atributos);
                } else {
                    $documento = $colaborador->documentos()->create($atributos);
                }

                if ($pathAnterior && $pathAnterior !== $path) {
                    Storage::disk('public')->delete($pathAnterior);
                }
            }
        }

        return back()->with('status', 'Documentación actualizada correctamente.');
    }

    /**
     * Elimina un documento de la tabla colaborador_documentos.
     */
    public function destroyDocumento(Colaborador $colaborador, ColaboradorDocumento $documento): RedirectResponse
    {
        if ($documento->colaborador_id !== $colaborador->id) {
            abort(403);
        }

        if (Storage::disk('public')->exists($documento->path)) {
            Storage::disk('public')->delete($documento->path);
        }

        $documento->delete();

        return back()->with('status', 'Documento eliminado correctamente.');
    }

    /**
     * Elimina solo el archivo físico del documento y limpia el path,
     * dejando el registro en la base de datos.
     */
    public function clearArchivoDocumento(Colaborador $colaborador, ColaboradorDocumento $documento): RedirectResponse
    {
        if (
            $documento->colaborador_id !== $colaborador->id
            || ! array_key_exists($documento->campo, self::CAMPOS_CONTRATO)
        ) {
            abort(403);
        }

        if ($documento->path && Storage::disk('public')->exists($documento->path)) {
            Storage::disk('public')->delete($documento->path);
        }

        $documento->update([
            'path' => null,
            'nombre_original' => null,
        ]);

        return back()->with('status', 'Archivo quitado correctamente.');
    }

    /**
     * Sube o actualiza el documento de preaviso para una fecha específica de finalización.
     */
    public function storePreaviso(Request $request, Colaborador $colaborador): RedirectResponse
    {
        $request->validate([
            'documento' => ['required', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png'],
            'fecha' => ['required', 'date'],
        ]);

        $fechaStr = Carbon::parse($request->input('fecha'))->format('Y-m-d');
        $archivo = $request->file('documento');
        $path = $archivo->store('colaboradores/documentos', 'public');

        // Si ya existía un preaviso para esta fecha, eliminar archivo físico anterior
        $existente = $colaborador->documentos()
            ->where('campo', 'documento_preaviso_terminacion')
            ->where('fecha_documento', $fechaStr)
            ->first();

        if ($existente) {
            if (Storage::disk('public')->exists($existente->path)) {
                Storage::disk('public')->delete($existente->path);
            }
            $existente->update([
                'path' => $path,
            ]);
        } else {
            $colaborador->documentos()->create([
                'campo' => 'documento_preaviso_terminacion',
                'path' => $path,
                'fecha_documento' => $fechaStr,
            ]);
        }

        return back()->with('status', 'Preaviso guardado correctamente.');
    }

    /**
     * Sube o actualiza el documento de soporte para una prórroga específica.
     */
    public function storeDocumentoProrroga(Request $request, Colaborador $colaborador, ContratoProrroga $prorroga): RedirectResponse
    {
        if ($prorroga->colaborador_id !== $colaborador->id) {
            abort(403);
        }

        $request->validate([
            'documento' => ['required', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png'],
        ]);

        $archivo = $request->file('documento');

        // Eliminar el documento anterior si existía
        if ($prorroga->documento_path && Storage::disk('public')->exists($prorroga->documento_path)) {
            Storage::disk('public')->delete($prorroga->documento_path);
        }

        $path = $archivo->store('colaboradores/prorrogas', 'public');

        $prorroga->update([
            'documento_path' => $path,
            'documento_nombre' => $archivo->getClientOriginalName(),
        ]);

        return back()->with('status', 'Documento de prórroga subido correctamente.');
    }

    /**
     * Elimina el documento de soporte de una prórroga específica.
     */
    public function destroyDocumentoProrroga(Colaborador $colaborador, ContratoProrroga $prorroga): RedirectResponse
    {
        if ($prorroga->colaborador_id !== $colaborador->id) {
            abort(403);
        }

        if ($prorroga->documento_path && Storage::disk('public')->exists($prorroga->documento_path)) {
            Storage::disk('public')->delete($prorroga->documento_path);
        }

        $prorroga->update([
            'documento_path' => null,
            'documento_nombre' => null,
        ]);

        return back()->with('status', 'Documento de prórroga eliminado correctamente.');
    }

    public function updateProrroga(
        UpdateContratoProrrogaRequest $request,
        Colaborador $colaborador,
        ContratoProrroga $prorroga,
        ContratoVigenciaService $contratoVigencia,
    ): RedirectResponse {
        abort_if(
            $colaborador->tieneFinalizacionConfirmada(),
            403,
            'El contrato ya fue finalizado y no se puede modificar.',
        );

        $datos = $request->validated();
        $datos['fecha_inicio'] = $datos['tipo'] === 'prorroga'
            ? ($datos['fecha_inicio'] ?? null)
            : null;

        DB::transaction(function () use ($colaborador, $prorroga, $datos, $contratoVigencia) {
            $contratoActual = $contratoVigencia->contratoActual($colaborador);
            $esContratoActual = $contratoActual
                ? $prorroga->contrato_id === $contratoActual->id
                : $prorroga->contrato_id === null;

            $prorroga->update($datos);

            if (! $esContratoActual) {
                return;
            }

            $prorrogasContrato = $contratoActual
                ? $contratoActual->prorrogas()
                : $colaborador->prorrogas()->whereNull('contrato_id');
            $ultimaProrroga = $prorrogasContrato
                ->where('tipo', 'prorroga')
                ->orderByDesc('fecha_nueva')
                ->orderByDesc('id')
                ->first();

            if (! $ultimaProrroga) {
                return;
            }

            $colaborador->update(['fecha_retiro_empresa' => $ultimaProrroga->fecha_nueva]);
        });

        return back()->with('status', 'Historial de contrato actualizado correctamente.');
    }

    public function destroyProrroga(Colaborador $colaborador, ContratoProrroga $prorroga): RedirectResponse
    {
        abort_if($prorroga->colaborador_id !== $colaborador->id, 403);

        if ($prorroga->documento_path && Storage::disk('public')->exists($prorroga->documento_path)) {
            Storage::disk('public')->delete($prorroga->documento_path);
        }

        $prorroga->delete();

        return back()->with('status', 'Registro de prórroga eliminado correctamente.');
    }

    public function updateDatosContrato(
        UpdateContratoColaboradorRequest $request,
        Colaborador $colaborador,
    ): RedirectResponse {
        abort_if(
            $colaborador->tieneFinalizacionConfirmada(),
            403,
            'El contrato ya fue finalizado y no se puede modificar.',
        );

        $colaborador->update($request->validated());

        return back()->with('status', 'Datos del contrato actualizados correctamente.');
    }

    public function destroyDatosContrato(Colaborador $colaborador): RedirectResponse
    {
        abort_if(
            $colaborador->tieneFinalizacionConfirmada(),
            403,
            'El contrato ya fue finalizado y no se puede modificar.',
        );

        $colaborador->update([
            'fecha_ingreso_empresa' => null,
            'fecha_retiro_empresa' => null,
            'tipo_contrato' => null,
            'tipo_contrato_otro' => null,
        ]);

        return back()->with('status', 'Datos actuales del contrato eliminados correctamente.');
    }

    public function destroyAntecedente(Colaborador $colaborador): RedirectResponse
    {
        $colaborador->update([
            'ha_trabajado_antes' => 'no',
            'cargo_anterior' => null,
            'fecha_ultima_laboral' => null,
        ]);

        return back()->with('status', 'El antecedente laboral anterior fue eliminado correctamente.');
    }

    /**
     * Genera y descarga la carta de prórroga de contrato en PDF.
     * La nueva fecha de finalización se recibe como query param ?fecha=YYYY-MM-DD.
     * Si no se pasa, se usa la fecha_retiro_empresa actual del colaborador.
     */
    public function exportarProrrogaPdf(Request $request, Colaborador $colaborador): HttpResponse
    {
        $request->validate([
            'fecha' => ['nullable', 'date'],
        ]);

        $nuevaFecha = $request->input('fecha')
            ? \Illuminate\Support\Carbon::parse($request->input('fecha'))
            : $colaborador->fecha_retiro_empresa;

        $nuevaFechaFinalizacion = $nuevaFecha?->format('d/m/Y') ?? '—';
        $fechaEmision = now()->locale('es')->isoFormat('D [de] MMMM [de] YYYY');

        $pdf = Pdf::loadView('gente.prorroga-contrato-pdf', [
            'colaborador' => $colaborador,
            'nuevaFechaFinalizacion' => $nuevaFechaFinalizacion,
            'fechaEmision' => $fechaEmision,
        ])->setPaper('a4', 'portrait');

        $nombreArchivo = 'prorroga-contrato-'.str($colaborador->nombre_completo)->slug().'.pdf';

        return $pdf->download($nombreArchivo);
    }

    /**
     * Edita directamente un registro de colaborador_contratos.
     */
    public function updateContratoHistorial(
        Request $request,
        Colaborador $colaborador,
        ColaboradorContrato $contrato,
    ): RedirectResponse {
        abort_if($contrato->colaborador_id !== $colaborador->id, 403);
        abort_if($colaborador->tieneFinalizacionConfirmada(), 403, 'El contrato ya fue finalizado.');

        $data = $request->validate([
            'fecha_inicio'      => ['nullable', 'date'],
            'fecha_fin'         => ['nullable', 'date'],
            'tipo_contrato'     => ['nullable', 'string', 'max:255'],
            'tipo_contrato_otro'=> ['nullable', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($contrato, $colaborador, $data): void {
            $contrato->update($data);
            $contrato->documentos()->update([
                'fecha_documento' => $contrato->fecha_inicio,
                'tipo_contrato' => $contrato->tipo_contrato,
            ]);

            if ($contrato->estado === 'activo') {
                $colaborador->update([
                    'fecha_ingreso_empresa' => $contrato->fecha_inicio,
                    'fecha_retiro_empresa' => $contrato->fecha_fin,
                    'tipo_contrato' => $contrato->tipo_contrato,
                    'tipo_contrato_otro' => $contrato->tipo_contrato_otro,
                ]);
            }
        });

        return back()->with('status', 'Contrato actualizado correctamente.');
    }

    /**
     * Elimina un registro de colaborador_contratos y sus prórrogas asociadas.
     */
    public function destroyContratoHistorial(
        Colaborador $colaborador,
        ColaboradorContrato $contrato,
    ): RedirectResponse {
        abort_if($contrato->colaborador_id !== $colaborador->id, 403);

        $rutasDocumentos = $contrato->documentos()
            ->whereNotNull('path')
            ->pluck('path')
            ->merge(
                $contrato->prorrogas()
                    ->whereNotNull('documento_path')
                    ->pluck('documento_path'),
            )
            ->unique();

        DB::transaction(function () use ($contrato, $colaborador): void {
            $contrato->delete();

            if ($contrato->estado === 'activo') {
                $colaborador->update([
                    'fecha_ingreso_empresa' => null,
                    'fecha_retiro_empresa' => null,
                    'tipo_contrato' => null,
                    'tipo_contrato_otro' => null,
                ]);
            }
        });

        foreach ($rutasDocumentos as $ruta) {
            if (Storage::disk('public')->exists($ruta)) {
                Storage::disk('public')->delete($ruta);
            }
        }

        return back()->with('status', 'Contrato eliminado correctamente.');
    }
}
