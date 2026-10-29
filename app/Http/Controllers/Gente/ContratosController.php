<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\ContratoProrroga;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorDocumento;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ContratosController extends Controller
{
    public const CAMPOS_CONTRATO = [
        'documento_contrato' => 'Contrato firmado',
        'documento_prorroga' => 'Otros soportes de prórroga',
    ];

    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $estado = $request->string('estado')->trim()->toString();

        $colaboradores = Colaborador::query()
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
            ->withExists(['prorrogas as tiene_finalizacion' => fn ($q) => $q->where('tipo', 'finalizacion')])
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
            ->orderBy('nombres')
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

    /**
     * Muestra la vista de detalle del contrato de un colaborador con su documentación.
     */
    public function show(Colaborador $colaborador): Response
    {
        $documentosMap = [];

        foreach (array_keys(self::CAMPOS_CONTRATO) as $campo) {
            $documentosMap[$campo] = [];

            // Si tiene columna directa en colaborador
            if (! empty($colaborador->{$campo})) {
                $documentosMap[$campo][] = [
                    'id' => null,
                    'path' => $colaborador->{$campo},
                    'fecha' => null,
                    'name' => basename($colaborador->{$campo}),
                ];
            }
        }

        // Documentos en la tabla colaborador_documentos
        $docsDB = $colaborador->documentos()
            ->whereIn('campo', array_keys(self::CAMPOS_CONTRATO))
            ->orderByDesc('id')
            ->get();

        foreach ($docsDB as $doc) {
            $documentosMap[$doc->campo][] = [
                'id' => $doc->id,
                'path' => $doc->path,
                'fecha' => $doc->fecha_documento?->format('Y-m-d'),
                'name' => basename($doc->path),
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

        // 1. Fecha de retiro actual del colaborador
        if ($colaborador->fecha_retiro_empresa) {
            $fechaActual = Carbon::parse($colaborador->fecha_retiro_empresa);
            $fechaActualStr = $fechaActual->format('Y-m-d');
            $fechasFinalizacion->put($fechaActualStr, [
                'fecha' => $fechaActualStr,
                'fecha_formateada' => $fechaActual->format('d/m/Y'),
                'es_actual' => true,
                'estado' => $colaborador->prorrogas()->where('tipo', 'finalizacion')->exists()
                    ? 'Finalización confirmada'
                    : 'Fecha actual de vencimiento',
            ]);
        }

        // 2. Fechas de finalización anteriores provenientes del historial de prórrogas
        foreach ($colaborador->prorrogas()->orderByDesc('created_at')->get() as $p) {
            if ($p->fecha_anterior) {
                $fechaAnt = Carbon::parse($p->fecha_anterior);
                $fechaAntStr = $fechaAnt->format('Y-m-d');
                if (! $fechasFinalizacion->has($fechaAntStr)) {
                    $fechasFinalizacion->put($fechaAntStr, [
                        'fecha' => $fechaAntStr,
                        'fecha_formateada' => $fechaAnt->format('d/m/Y'),
                        'es_actual' => false,
                        'estado' => $p->tipo === 'finalizacion'
                            ? 'Finalización'
                            : 'Prorrogado al '.($p->fecha_nueva ? Carbon::parse($p->fecha_nueva)->format('d/m/Y') : 'siguiente fecha'),
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
                        'fecha_nueva' => $p->fecha_nueva?->format('Y-m-d'),
                        'tipo' => $p->tipo,
                        'observaciones' => $p->observaciones,
                        'documento_path' => $p->documento_path ? Storage::url($p->documento_path) : null,
                        'documento_nombre' => $p->documento_nombre ?? ($p->documento_path ? basename($p->documento_path) : null),
                        'registrado_por' => $p->registradoPor?->name,
                        'fecha_registro' => $p->created_at->format('d/m/Y H:i'),
                    ])
                    ->values()
                    ->all(),

                // Indicador de alerta: ≤ 35 días para el vencimiento
                'dias_para_vencimiento' => $colaborador->fecha_retiro_empresa
                    ? (int) now()->startOfDay()->diffInDays($colaborador->fecha_retiro_empresa, false)
                    : null,

                // ¿Ya se registró una finalización? Si sí, no mostrar banner ni permitir más prórrogas
                'tiene_finalizacion' => $colaborador->prorrogas()
                    ->where('tipo', 'finalizacion')
                    ->exists(),

                // Historial de cargos
                'historial_cargos' => $colaborador->cargos()
                    ->orderByDesc('fecha_inicio')
                    ->get()
                    ->map(fn ($c) => [
                        'id' => $c->id,
                        'cargo' => $c->cargo,
                        'fecha_inicio' => $formatFecha($c->fecha_inicio),
                        'fecha_fin' => $formatFecha($c->fecha_fin),
                        'estado' => $c->estado,
                    ])
                    ->values(),
            ],
            'documentos' => $documentosMap,
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
            $rules["{$campo}.*"] = ['file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:5120'];
        }

        $request->validate($rules);

        foreach ($camposPermitidos as $campo) {
            $archivos = $request->file($campo, []);
            $archivos = is_array($archivos) ? $archivos : [$archivos];

            foreach (array_filter($archivos) as $archivo) {
                $path = $archivo->store('colaboradores/documentos', 'public');
                $colaborador->documentos()->create([
                    'campo' => $campo,
                    'path' => $path,
                    'fecha_documento' => now()->toDateString(),
                ]);
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
     * Sube o actualiza el documento de preaviso para una fecha específica de finalización.
     */
    public function storePreaviso(Request $request, Colaborador $colaborador): RedirectResponse
    {
        $request->validate([
            'documento' => ['required', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:10240'],
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
            'documento' => ['required', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:10240'],
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
}
