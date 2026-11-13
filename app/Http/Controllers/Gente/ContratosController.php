<?php

namespace App\Http\Controllers\Gente;

use App\Exports\Gente\ContratosExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\Gente\UpdateContratoColaboradorRequest;
use App\Http\Requests\Gente\UpdateContratoProrrogaRequest;
use App\Models\Gente\ContratoProrroga;
use App\Models\Gente\ColaboradorContrato;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorActivacionHistorial;
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
        $search          = $request->string('search')->trim()->toString();
        $estado          = $request->string('estado', 'activo')->trim()->toString();
        $estadoContrato  = $request->string('estado_contrato')->trim()->toString();
        $fechaInicioDesde = $request->string('fecha_inicio_desde')->trim()->toString();
        $fechaInicioHasta = $request->string('fecha_inicio_hasta')->trim()->toString();
        $fechaFinDesde   = $request->string('fecha_fin_desde')->trim()->toString();
        $fechaFinHasta   = $request->string('fecha_fin_hasta')->trim()->toString();

        $colaboradores = $this->consultaContratos($search, $estado, $estadoContrato, $fechaInicioDesde, $fechaInicioHasta, $fechaFinDesde, $fechaFinHasta)
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('gente/contratos/index', [
            'colaboradores' => $colaboradores,
            'filters' => [
                'search'           => $search,
                'estado'           => $estado,
                'estado_contrato'  => $estadoContrato,
                'fecha_inicio_desde' => $fechaInicioDesde,
                'fecha_inicio_hasta' => $fechaInicioHasta,
                'fecha_fin_desde'  => $fechaFinDesde,
                'fecha_fin_hasta'  => $fechaFinHasta,
            ],
        ]);
    }

    public function exportar(Request $request)
    {
        $search          = $request->string('search')->trim()->toString();
        $estado          = $request->string('estado', 'activo')->trim()->toString();
        $estadoContrato  = $request->string('estado_contrato')->trim()->toString();
        $fechaInicioDesde = $request->string('fecha_inicio_desde')->trim()->toString();
        $fechaInicioHasta = $request->string('fecha_inicio_hasta')->trim()->toString();
        $fechaFinDesde   = $request->string('fecha_fin_desde')->trim()->toString();
        $fechaFinHasta   = $request->string('fecha_fin_hasta')->trim()->toString();

        $colaboradores = $this->consultaContratos($search, $estado, $estadoContrato, $fechaInicioDesde, $fechaInicioHasta, $fechaFinDesde, $fechaFinHasta)
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

    /**
     * Bloquea toda escritura si el colaborador está inactivo o tiene
     * finalización de contrato confirmada.
     */
    private function asegurarEditable(Colaborador $colaborador): void
    {
        abort_if(
            $colaborador->tieneFinalizacionConfirmada(),
            403,
            'El contrato ya fue finalizado y no se puede modificar.',
        );

        abort_if(
            ! $colaborador->is_active,
            403,
            'El colaborador está inactivo y no se puede modificar. Actívelo primero.',
        );
    }

    private function consultaContratos(
        string $search,
        string $estado,
        string $estadoContrato = '',
        string $fechaInicioDesde = '',
        string $fechaInicioHasta = '',
        string $fechaFinDesde = '',
        string $fechaFinHasta = '',
    ): Builder {
        $diasAlerta = (int) config('seguridad.dias_alerta_vencimiento_contrato', 35);
        $hoy        = Carbon::today();

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
            ->withExists(['prorrogas as tiene_finalizacion' => fn ($query) => $query
                ->where('tipo', 'finalizacion')
                ->where((new Colaborador)->qualifyColumn('is_active'), false)])
            ->withCount(['prorrogas as cantidad_prorrogas' => fn (Builder $query) => $query->where('tipo', 'prorroga')])
            ->withMax(['prorrogas as ultima_fecha_prorroga' => fn (Builder $query) => $query->where('tipo', 'prorroga')], 'fecha_nueva')
            ->completos()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('nombres', 'like', "%{$search}%")
                        ->orWhere('apellidos', 'like', "%{$search}%")
                        ->orWhere('cedula', 'like', "%{$search}%")
                        ->orWhereRaw("CONCAT(nombres, ' ', apellidos) LIKE ?", ["%{$search}%"])
                        ->orWhereRaw("CONCAT(apellidos, ' ', nombres) LIKE ?", ["%{$search}%"]);
                });
            })
            ->when($estado === 'activo',   fn ($q) => $q->where('is_active', true))
            ->when($estado === 'inactivo', fn ($q) => $q->where('is_active', false))
            // ── Filtro por estado del contrato ────────────────────────────────
            ->when($estadoContrato === 'vigente', fn ($q) => $q
                ->whereDoesntHave('prorrogas', fn ($p) => $p->where('tipo', 'finalizacion'))
                ->whereNotNull('fecha_retiro_empresa')
                ->whereRaw($this->sqlFechaVigente().' > ?', [$hoy->copy()->addDays($diasAlerta)->toDateString()]))
            ->when($estadoContrato === 'por_vencer', fn ($q) => $q
                ->whereDoesntHave('prorrogas', fn ($p) => $p->where('tipo', 'finalizacion'))
                ->whereNotNull('fecha_retiro_empresa')
                ->whereRaw($this->sqlFechaVigente().' BETWEEN ? AND ?', [
                    $hoy->toDateString(),
                    $hoy->copy()->addDays($diasAlerta)->toDateString(),
                ]))
            ->when($estadoContrato === 'vencido', fn ($q) => $q
                ->whereDoesntHave('prorrogas', fn ($p) => $p->where('tipo', 'finalizacion'))
                ->whereNotNull('fecha_retiro_empresa')
                ->whereRaw($this->sqlFechaVigente().' < ?', [$hoy->toDateString()]))
            ->when($estadoContrato === 'finalizado', fn ($q) => $q
                ->whereHas('prorrogas', fn ($p) => $p->where('tipo', 'finalizacion')))
            ->when($estadoContrato === 'sin_fecha', fn ($q) => $q
                ->whereNull('fecha_retiro_empresa'))
            // ── Filtro por rango de fecha de inicio de contrato ───────────────
            ->when($fechaInicioDesde !== '', fn ($q) => $q->whereDate('fecha_ingreso_empresa', '>=', $fechaInicioDesde))
            ->when($fechaInicioHasta !== '', fn ($q) => $q->whereDate('fecha_ingreso_empresa', '<=', $fechaInicioHasta))
            // ── Filtro por rango de fecha de finalización vigente ─────────────
            ->when($fechaFinDesde !== '', fn ($q) => $q
                ->whereRaw($this->sqlFechaVigente().' >= ?', [$fechaFinDesde]))
            ->when($fechaFinHasta !== '', fn ($q) => $q
                ->whereRaw($this->sqlFechaVigente().' <= ?', [$fechaFinHasta]))
            ->orderBy('nombres');
    }

    /**
     * Expresión SQL que devuelve la fecha de vencimiento vigente real:
     * la fecha_nueva de la última prórroga si existe, o fecha_retiro_empresa.
     * Se usa en whereRaw para filtrar sin cargar relaciones en memoria.
     */
    private function sqlFechaVigente(): string
    {
        return 'COALESCE(
            (SELECT MAX(cp.fecha_nueva) FROM contrato_prorrogas cp
             WHERE cp.colaborador_id = colaboradores.id
               AND cp.tipo = "prorroga"),
            colaboradores.fecha_retiro_empresa
        )';
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

        $contratoActual = $contratoVigencia->contratoActual($colaborador);

        if ($contratoActual) {
            $ultimaProrrogaContratoActual = $contratoActual->prorrogas()
                ->where('tipo', 'prorroga')
                ->orderByDesc('fecha_nueva')
                ->orderByDesc('id')
                ->first();

            $fechaVigenteEfectiva = $ultimaProrrogaContratoActual?->fecha_nueva ?? $contratoActual->fecha_fin;

            if ($fechaVigenteEfectiva && (! $colaborador->fecha_retiro_empresa || ! $colaborador->fecha_retiro_empresa->equalTo($fechaVigenteEfectiva))) {
                $colaborador->update([
                    'fecha_retiro_empresa' => $fechaVigenteEfectiva,
                    'fecha_ingreso_empresa' => $contratoActual->fecha_inicio,
                    'tipo_contrato' => $contratoActual->tipo_contrato,
                    'tipo_contrato_otro' => $contratoActual->tipo_contrato_otro,
                ]);
            }
        }

        $ultimaProrrogaContratoActual = $contratoActual
            ? $contratoActual->prorrogas()
                ->where('tipo', 'prorroga')
                ->orderByDesc('fecha_nueva')
                ->orderByDesc('id')
                ->first()
            : null;

        $fechaVigenteActual = $contratoActual
            ? ($ultimaProrrogaContratoActual?->fecha_nueva ?? $contratoActual->fecha_fin)
            : null;

        // Fechas de finalización para preavisos (detectadas de la fecha actual y de prórrogas)
        $fechasFinalizacion = collect();

        // fecha_desde para la tarjeta actual: fecha_nueva de la última prórroga que le pertenece, o fecha_inicio
        $fechaDesdeActual = $ultimaProrrogaContratoActual?->fechaInicioEfectiva()
            ? $ultimaProrrogaContratoActual->fechaInicioEfectiva()->format('d/m/Y')
            : ($ultimaProrrogaContratoActual?->fecha_anterior
                ? Carbon::parse($ultimaProrrogaContratoActual->fecha_anterior)->addDay()->format('d/m/Y')
                : ($contratoActual?->fecha_inicio ? Carbon::parse($contratoActual->fecha_inicio)->format('d/m/Y') : null));

        // 1. Fecha de vencimiento actual del contrato vigente
        if ($fechaVigenteActual) {
            $fechaActual = Carbon::parse($fechaVigenteActual);
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

        // 3. Fechas de finalización del contrato inicial / contratos base (antes de prórrogas)
        foreach ($colaborador->contratos()->orderBy('fecha_inicio')->get() as $c) {
            $primeraProrrogaContrato = $c->prorrogas()
                ->where('tipo', 'prorroga')
                ->orderBy('fecha_anterior')
                ->orderBy('id')
                ->first();

            $fechaFinInicial = $primeraProrrogaContrato?->fecha_anterior ?? $c->fecha_fin;
            $fechaInicioInicial = $c->fecha_inicio ?? $colaborador->fecha_ingreso_empresa;

            if ($fechaFinInicial) {
                try {
                    $fechaFinCarbon = Carbon::parse($fechaFinInicial);
                    $fechaFinStr = $fechaFinCarbon->format('Y-m-d');

                    if (! $fechasFinalizacion->has($fechaFinStr)) {
                        $fechasFinalizacion->put($fechaFinStr, [
                            'fecha' => $fechaFinStr,
                            'fecha_formateada' => $fechaFinCarbon->format('d/m/Y'),
                            'es_actual' => false,
                            'estado' => 'Contrato inicial',
                            'fecha_desde' => $fechaInicioInicial ? Carbon::parse($fechaInicioInicial)->format('d/m/Y') : null,
                            'fecha_hasta' => $fechaFinCarbon->format('d/m/Y'),
                        ]);
                    }
                } catch (\Throwable) {
                    // Ignorar fecha inválida
                }
            }
        }

        // Si no se registró mediante contratos o no se cubrió la primera prórroga global:
        $primeraProrrogaGlobal = $colaborador->prorrogas()
            ->where('tipo', 'prorroga')
            ->orderBy('fecha_anterior')
            ->orderBy('id')
            ->first();

        if ($primeraProrrogaGlobal && $primeraProrrogaGlobal->fecha_anterior) {
            try {
                $fechaFinInicial = Carbon::parse($primeraProrrogaGlobal->fecha_anterior);
                $fechaFinStr = $fechaFinInicial->format('Y-m-d');

                if (! $fechasFinalizacion->has($fechaFinStr)) {
                    $fechasFinalizacion->put($fechaFinStr, [
                        'fecha' => $fechaFinStr,
                        'fecha_formateada' => $fechaFinInicial->format('d/m/Y'),
                        'es_actual' => false,
                        'estado' => 'Contrato inicial',
                        'fecha_desde' => $colaborador->fecha_ingreso_empresa ? Carbon::parse($colaborador->fecha_ingreso_empresa)->format('d/m/Y') : null,
                        'fecha_hasta' => $fechaFinInicial->format('d/m/Y'),
                    ]);
                }
            } catch (\Throwable) {
                // Ignorar fecha inválida
            }
        }

        if ($colaborador->contrato_fecha_hasta) {
            try {
                $fechaFinContrato = Carbon::parse($colaborador->contrato_fecha_hasta);
                $fechaFinStr = $fechaFinContrato->format('Y-m-d');

                if (! $fechasFinalizacion->has($fechaFinStr)) {
                    $fechasFinalizacion->put($fechaFinStr, [
                        'fecha' => $fechaFinStr,
                        'fecha_formateada' => $fechaFinContrato->format('d/m/Y'),
                        'es_actual' => false,
                        'estado' => 'Contrato inicial',
                        'fecha_desde' => ($colaborador->contrato_fecha_desde ?? $colaborador->fecha_ingreso_empresa)
                            ? Carbon::parse($colaborador->contrato_fecha_desde ?? $colaborador->fecha_ingreso_empresa)->format('d/m/Y')
                            : null,
                        'fecha_hasta' => $fechaFinContrato->format('d/m/Y'),
                    ]);
                }
            } catch (\Throwable) {
                // Ignorar fecha inválida
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
                'fecha_vencimiento_vigente' => $formatFecha($fechaVigenteActual),
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
                // La vigencia se calcula únicamente a partir del contrato actual y la última prórroga que le pertenece.
                // Si no hay contrato registrado, es null (no se generan alertas falsas).
                'dias_para_vencimiento' => $fechaVigenteActual
                    ? (int) now()->startOfDay()->diffInDays(Carbon::parse($fechaVigenteActual)->startOfDay(), false)
                    : null,

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
                            'area' => $c->area,
                            'perfil' => $c->perfil,
                            'fecha_inicio' => $formatFecha($c->fecha_inicio),
                            'fecha_fin' => $formatFecha($c->fecha_fin),
                            'estado' => $c->estado,
                            'pertenece_a' => $pertenece,
                        ];
                    })
                    ->values(),

                // Historial de contratos en orden cronológico, con fechas vacías al final.
                'historial_contratos' => $colaborador->contratos()
                    ->reorder()
                    ->orderByRaw('CASE WHEN fecha_inicio IS NULL THEN 1 ELSE 0 END')
                    ->orderBy('fecha_inicio')
                    ->orderBy('id')
                    ->withCount(['prorrogas as cantidad_prorrogas' => fn ($query) => $query->where('tipo', 'prorroga')])
                    ->withExists(['prorrogas as tiene_finalizacion' => fn ($query) => $query->where('tipo', 'finalizacion')])
                    ->with(['prorrogas' => fn ($q) => $q->where('tipo', 'prorroga')->orderByDesc('fecha_nueva')->orderByDesc('id')])
                    ->with('registradoPor:id,name')
                    ->get()
                    ->map(function ($c) use ($formatFecha) {
                        $ultimaProrrogaContrato = $c->prorrogas->first();
                        $fechaVigenciaContrato = $ultimaProrrogaContrato?->fecha_nueva ?? $c->fecha_fin;

                        return [
                            'id' => $c->id,
                            'tipo_contrato' => $c->tipo_contrato,
                            'tipo_contrato_otro' => $c->tipo_contrato_otro,
                            'cargo' => $c->cargo,
                            'area' => $c->area,
                            'fecha_inicio' => $formatFecha($c->fecha_inicio),
                            'fecha_fin' => $formatFecha($c->fecha_fin),
                            'fecha_vigencia' => $formatFecha($fechaVigenciaContrato),
                            'ultima_prorroga_fecha' => $formatFecha($ultimaProrrogaContrato?->fecha_nueva),
                            'cantidad_prorrogas' => $c->cantidad_prorrogas,
                            'es_aprendiz' => $c->esAprendiz(),
                            'estado' => $c->tiene_finalizacion ? 'finalizado' : $c->estado,
                            'observaciones' => $c->observaciones,
                            'registrado_por' => $c->registradoPor?->name,
                            'fecha_registro' => $c->created_at->format('d/m/Y H:i'),
                        ];
                    })
                    ->values()
                    ->all(),
            ],
            'documentos' => $documentosMap,
            'catalogos' => [
                'cargos' => $catalogos->cargos(),
                'tiposContrato' => $catalogos->tiposContrato(),
                'perfilesCargos' => $catalogos->perfilesCargos(),
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
        $this->asegurarEditable($colaborador);
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
    public function destroyDocumento(Colaborador $colaborador, string|int $documento): RedirectResponse
    {
        $this->asegurarEditable($colaborador);

        $doc = ColaboradorDocumento::find($documento);

        if (! $doc) {
            return back()->with('status', 'El documento ya ha sido eliminado.');
        }

        if ($doc->colaborador_id !== $colaborador->id) {
            abort(403);
        }

        if ($doc->path && Storage::disk('public')->exists($doc->path)) {
            Storage::disk('public')->delete($doc->path);
        }

        $doc->delete();

        return back()->with('status', 'Documento eliminado correctamente.');
    }

    /**
     * Elimina solo el archivo físico del documento y limpia el path,
     * dejando el registro en la base de datos.
     */
    public function clearArchivoDocumento(Colaborador $colaborador, string|int $documento): RedirectResponse
    {
        $this->asegurarEditable($colaborador);

        $doc = ColaboradorDocumento::find($documento);

        if (! $doc) {
            return back()->with('status', 'El documento ya no existe.');
        }

        if (
            $doc->colaborador_id !== $colaborador->id
            || ! array_key_exists($doc->campo, self::CAMPOS_CONTRATO)
        ) {
            abort(403);
        }

        if ($doc->path && Storage::disk('public')->exists($doc->path)) {
            Storage::disk('public')->delete($doc->path);
        }

        $doc->update([
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
        $this->asegurarEditable($colaborador);

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
        $this->asegurarEditable($colaborador);

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
        $this->asegurarEditable($colaborador);

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
        $this->asegurarEditable($colaborador);

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
        $this->asegurarEditable($colaborador);
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
        $this->asegurarEditable($colaborador);

        $colaborador->update($request->validated());

        return back()->with('status', 'Datos del contrato actualizados correctamente.');
    }

    public function destroyDatosContrato(Colaborador $colaborador): RedirectResponse
    {
        $this->asegurarEditable($colaborador);

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
        $this->asegurarEditable($colaborador);

        $colaborador->update([
            'ha_trabajado_antes' => 'no',
            'cargo_anterior' => null,
            'fecha_ultima_laboral' => null,
        ]);

        return back()->with('status', 'El antecedente laboral anterior fue eliminado correctamente.');
    }

    /**
     * Actualiza motivo y observaciones de un registro del historial de activación.
     */
    public function updateActivacion(
        Request $request,
        Colaborador $colaborador,
        ColaboradorActivacionHistorial $activacion,
    ): RedirectResponse {
        abort_if((int) $activacion->colaborador_id !== (int) $colaborador->id, 403);

        $data = $request->validate([
            'motivo'       => ['nullable', 'string', 'max:255'],
            'observaciones' => ['nullable', 'string', 'max:1000'],
        ]);

        $activacion->update($data);

        return back()->with('status', 'Registro de activación actualizado correctamente.');
    }

    /**
     * Elimina un registro del historial de activación.
     */
    public function destroyActivacion(
        Colaborador $colaborador,
        ColaboradorActivacionHistorial $activacion,
    ): RedirectResponse {
        abort_if((int) $activacion->colaborador_id !== (int) $colaborador->id, 403);

        $activacion->delete();

        return back()->with('status', 'Registro de activación eliminado correctamente.');
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

        // Obtener el último contrato ingresado del colaborador
        $ultimoContrato = $colaborador->contratos()
            ->orderByDesc('fecha_inicio')
            ->orderByDesc('id')
            ->first();

        // Obtener la última prórroga de tipo 'prorroga' de ese contrato
        $ultimaProrroga = $ultimoContrato
            ? $ultimoContrato->prorrogas()
                ->where('tipo', 'prorroga')
                ->orderByDesc('fecha_nueva')
                ->orderByDesc('id')
                ->first()
            : null;

        // Fecha fin efectiva: última prórroga del contrato o fecha_fin del contrato
        $fechaFinEfectiva = $ultimaProrroga?->fecha_nueva ?? $ultimoContrato?->fecha_fin;

        // Si se pasa ?fecha= como override manual, usar esa
        if ($request->input('fecha')) {
            $fechaFinEfectiva = \Illuminate\Support\Carbon::parse($request->input('fecha'));
        }

        // Formatear en español: "31 de diciembre de 2025"
        $nuevaFechaFinalizacion = $fechaFinEfectiva
            ? \Illuminate\Support\Carbon::parse($fechaFinEfectiva)->locale('es')->isoFormat('D [de] MMMM [de] YYYY')
            : '—';

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
     * Genera el certificado laboral en PDF para un colaborador.
     * Toma la fecha inicio del primer contrato y la fecha fin de la última
     * prórroga (o del último contrato si no hay prórroga).
     */
    public function exportarCertificadoLaboralPdf(Colaborador $colaborador): HttpResponse
    {
        // Primer contrato (el más antiguo)
        $primerContrato = $colaborador->contratos()
            ->orderBy('fecha_inicio')
            ->orderBy('id')
            ->first();

        // Último contrato (el más reciente)
        $ultimoContrato = $colaborador->contratos()
            ->orderByDesc('fecha_inicio')
            ->orderByDesc('id')
            ->first();

        // Última prórroga de tipo 'prorroga' del último contrato
        $ultimaProrroga = $ultimoContrato
            ? $ultimoContrato->prorrogas()
                ->where('tipo', 'prorroga')
                ->orderByDesc('fecha_nueva')
                ->orderByDesc('id')
                ->first()
            : null;

        // Fecha inicio: primer contrato
        $fechaInicio = $primerContrato?->fecha_inicio
            ? Carbon::parse($primerContrato->fecha_inicio)->locale('es')->isoFormat('D [de] MMMM [de] YYYY')
            : '—';

        // Fecha fin: última prórroga o fecha_fin del último contrato
        $fechaFinRaw = $ultimaProrroga?->fecha_nueva ?? $ultimoContrato?->fecha_fin;
        $fechaFin = $fechaFinRaw
            ? Carbon::parse($fechaFinRaw)->locale('es')->isoFormat('D [de] MMMM [de] YYYY')
            : '—';

        // Fecha de hoy (día que se descarga = fecha de firma)
        $hoy = now()->locale('es');
        $fechaEmision = $hoy->isoFormat('D [de] MMMM [de] YYYY');
        $diaFirma     = $hoy->day;
        $mesFirma     = $hoy->isoFormat('MMMM');
        $anioFirma    = $hoy->year;

        $pdf = Pdf::loadView('gente.certificado-laboral-pdf', [
            'colaborador'  => $colaborador,
            'fechaInicio'  => $fechaInicio,
            'fechaFin'     => $fechaFin,
            'fechaEmision' => $fechaEmision,
            'diaFirma'     => $diaFirma,
            'mesFirma'     => $mesFirma,
            'anioFirma'    => $anioFirma,
        ])->setPaper('a4', 'portrait');

        $nombreArchivo = 'certificado-laboral-'.str($colaborador->nombre_completo)->slug().'.pdf';

        return $pdf->download($nombreArchivo);
    }

    /**
     * Genera el certificado laboral CON FUNCIONES en PDF.
     * Mismo encabezado que el certificado laboral simple, pero al final del
     * párrafo de término fijo añade las funciones de cada cargo que haya
     * ocupado el colaborador (campo `perfil` de colaborador_cargos).
     */
    public function exportarCertificadoLaboralConFuncionesPdf(Colaborador $colaborador): HttpResponse
    {
        // Primer contrato (el más antiguo)
        $primerContrato = $colaborador->contratos()
            ->orderBy('fecha_inicio')
            ->orderBy('id')
            ->first();

        // Último contrato (el más reciente)
        $ultimoContrato = $colaborador->contratos()
            ->orderByDesc('fecha_inicio')
            ->orderByDesc('id')
            ->first();

        // Última prórroga de tipo 'prorroga' del último contrato
        $ultimaProrroga = $ultimoContrato
            ? $ultimoContrato->prorrogas()
                ->where('tipo', 'prorroga')
                ->orderByDesc('fecha_nueva')
                ->orderByDesc('id')
                ->first()
            : null;

        // Fecha inicio: primer contrato
        $fechaInicio = $primerContrato?->fecha_inicio
            ? Carbon::parse($primerContrato->fecha_inicio)->locale('es')->isoFormat('D [de] MMMM [de] YYYY')
            : '—';

        // Fecha fin: última prórroga o fecha_fin del último contrato
        $fechaFinRaw = $ultimaProrroga?->fecha_nueva ?? $ultimoContrato?->fecha_fin;
        $fechaFin = $fechaFinRaw
            ? Carbon::parse($fechaFinRaw)->locale('es')->isoFormat('D [de] MMMM [de] YYYY')
            : '—';

        // Fecha de hoy
        $hoy = now()->locale('es');
        $fechaEmision = $hoy->isoFormat('D [de] MMMM [de] YYYY');
        $diaFirma     = $hoy->day;
        $mesFirma     = $hoy->isoFormat('MMMM');
        $anioFirma    = $hoy->year;

        // Historial de cargos ordenado cronológicamente, solo los que tengan perfil/funciones
        $cargos = $colaborador->cargos()
            ->reorder()
            ->orderBy('fecha_inicio')
            ->orderBy('id')
            ->get()
            ->map(fn ($c) => [
                'cargo'        => $c->cargo,
                'area'         => $c->area,
                'perfil'       => $c->perfil,
                'fecha_inicio' => $c->fecha_inicio?->locale('es')->isoFormat('D [de] MMMM [de] YYYY'),
                'fecha_fin'    => $c->fecha_fin?->locale('es')->isoFormat('D [de] MMMM [de] YYYY'),
                'estado'       => $c->estado,
            ]);

        $pdf = Pdf::loadView('gente.certificado-laboral-con-funciones-pdf', [
            'colaborador'  => $colaborador,
            'fechaInicio'  => $fechaInicio,
            'fechaFin'     => $fechaFin,
            'fechaEmision' => $fechaEmision,
            'diaFirma'     => $diaFirma,
            'mesFirma'     => $mesFirma,
            'anioFirma'    => $anioFirma,
            'cargos'       => $cargos,
        ])->setPaper('a4', 'portrait');

        $nombreArchivo = 'certificado-laboral-con-funciones-'.str($colaborador->nombre_completo)->slug().'.pdf';

        return $pdf->download($nombreArchivo);
    }


    public function updateContratoHistorial(
        Request $request,
        Colaborador $colaborador,
        ColaboradorContrato $contrato,
    ): RedirectResponse {
        $this->asegurarEditable($colaborador);
        abort_if($contrato->colaborador_id !== $colaborador->id, 403);

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
        $contrato,
        ContratoVigenciaService $contratoVigencia,
    ): RedirectResponse {
        $this->asegurarEditable($colaborador);

        $contratoModel = $contrato instanceof ColaboradorContrato
            ? $contrato
            : ($colaborador->contratos()->find($contrato) ?? ColaboradorContrato::find($contrato));

        if (! $contratoModel) {
            return back()->with('status', 'El contrato ya no existe.');
        }

        abort_if((int) $contratoModel->colaborador_id !== (int) $colaborador->id, 403);

        $rutasDocumentos = $contratoModel->documentos()
            ->whereNotNull('path')
            ->pluck('path')
            ->merge(
                $contratoModel->prorrogas()
                    ->whereNotNull('documento_path')
                    ->pluck('documento_path'),
            )
            ->unique();

        DB::transaction(function () use ($contratoModel, $colaborador, $contratoVigencia): void {
            // 1. Eliminar preavisos asociados a este contrato
            $contratoModel->preavisos()->delete();

            // 2. Eliminar prórrogas asociadas a este contrato en la base de datos
            $contratoModel->prorrogas()->delete();

            // 3. Eliminar documentos asociados a este contrato en la base de datos
            $contratoModel->documentos()->delete();

            // 4. Eliminar el contrato de la base de datos
            $contratoModel->delete();

            // 5. Recalcular el contrato activo del colaborador
            $colaborador->refresh();
            $siguienteContrato = $contratoVigencia->contratoActual($colaborador);

            if ($siguienteContrato) {
                $ultimaProrrogaSiguiente = $siguienteContrato->prorrogas()
                    ->where('tipo', 'prorroga')
                    ->orderByDesc('fecha_nueva')
                    ->orderByDesc('id')
                    ->first();

                $colaborador->update([
                    'fecha_ingreso_empresa' => $siguienteContrato->fecha_inicio,
                    'fecha_retiro_empresa' => $ultimaProrrogaSiguiente?->fecha_nueva ?? $siguienteContrato->fecha_fin,
                    'tipo_contrato' => $siguienteContrato->tipo_contrato,
                    'tipo_contrato_otro' => $siguienteContrato->tipo_contrato_otro,
                ]);
            } else {
                // Ya no quedan contratos: limpiar datos y eliminar prórrogas huérfanas
                $colaborador->prorrogas()->delete();

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

        return back()->with('status', 'Contrato y sus prórrogas eliminados correctamente de la base de datos.');
    }
}
