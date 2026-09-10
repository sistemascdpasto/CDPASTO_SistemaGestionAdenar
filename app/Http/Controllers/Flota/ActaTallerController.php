<?php

namespace App\Http\Controllers\Flota;

use App\Http\Controllers\Controller;
use App\Exports\Flota\ActaTallerExport;
use App\Models\Flota\ActaTaller;
use App\Models\Flota\ActaTallerNovedad;
use App\Models\Flota\Vehiculo;
use App\Models\Seguridad\Colaborador;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;

class ActaTallerController extends Controller
{
    // ── Helpers privados ──────────────────────────────────────────────────────

    private function vehiculos(): array
    {
        return Vehiculo::where('is_active', true)
            ->orderBy('placa')
            ->pluck('placa')
            ->toArray();
    }

    private function colaboradores(): array
    {
        return Colaborador::select(['id', 'cedula', 'nombres', 'apellidos', 'cargo', 'celular_1'])
            ->where('is_active', true)
            ->orderBy('nombres')
            ->get()
            ->map(fn ($c) => [
                'id'              => $c->id,
                'nombre_completo' => trim("{$c->nombres} {$c->apellidos}"),
                'cargo'           => $c->cargo ?? '',
                'cedula'          => $c->cedula ?? '',
                'celular'         => $c->celular_1 ?? '',
            ])
            ->toArray();
    }

    private function formatActa(ActaTaller $acta): array
    {
        return [
            'id'                      => $acta->id,
            'numero_acta'             => $acta->numero_acta,
            'placa'                   => $acta->placa,
            'fecha_entrega'           => $acta->fecha_entrega?->format('Y-m-d H:i'),
            'fecha_estimada_solucion' => $acta->fecha_estimada_solucion?->format('Y-m-d H:i'),
            'fecha_cierre'            => $acta->fecha_cierre?->format('Y-m-d H:i'),
            'kilometraje_entrada'     => $acta->kilometraje_entrada,
            'kilometraje_salida'      => $acta->kilometraje_salida,
            'taller'                  => $acta->taller,
            'motivo_ingreso'          => $acta->motivo_ingreso,
            'quien_reporta'           => $acta->quien_reporta,
            'diagnostico_taller'      => $acta->diagnostico_taller,
            'solucion_realizada'      => $acta->solucion_realizada,
            'estado_vehiculo'         => $acta->estado_vehiculo ?? [],
            'inventario'              => $acta->inventario ?? [],
            'observaciones'           => $acta->observaciones,
            'observacion_cierre'      => $acta->observacion_cierre,
            'combustible'             => $acta->combustible,
            'nombre_entrega'          => $acta->nombre_entrega,
            'cargo_entrega'           => $acta->cargo_entrega,
            'identificacion_entrega'  => $acta->identificacion_entrega,
            'telefono_entrega'        => $acta->telefono_entrega,
            'nombre_recibe'           => $acta->nombre_recibe,
            'cargo_recibe'            => $acta->cargo_recibe,
            'nombre_autorizacion'     => $acta->nombre_autorizacion,
            'cargo_autorizacion'      => $acta->cargo_autorizacion,
            'firma_entrega'           => $acta->firma_entrega
                ? Storage::disk('public')->url($acta->firma_entrega) : null,
            'firma_recibe'            => $acta->firma_recibe
                ? Storage::disk('public')->url($acta->firma_recibe) : null,
            'firma_autorizacion'      => $acta->firma_autorizacion
                ? Storage::disk('public')->url($acta->firma_autorizacion) : null,
            'estado_acta'             => $acta->estado_acta,
            'estado_label'            => $acta->estado_label,
            'estado_color'            => $acta->estado_color,
            'novedades' => $acta->novedades->map(fn ($n) => [
                'id'             => $n->id,
                'titulo'         => $n->titulo,
                'descripcion'    => $n->descripcion,
                'categoria'      => $n->categoria,
                'prioridad'      => $n->prioridad,
                'estado'         => $n->estado,
                'responsable'    => $n->responsable,
                'fecha_reporte'  => $n->fecha_reporte?->format('Y-m-d'),
                'fecha_solucion' => $n->fecha_solucion?->format('Y-m-d'),
            ])->toArray(),
            'evidencias' => $acta->evidencias->map(fn ($e) => [
                'id'       => $e->id,
                'url'      => $e->url,
                'etiqueta' => $e->etiqueta,
                'orden'    => $e->orden,
            ])->toArray(),
        ];
    }

    // ── index ─────────────────────────────────────────────────────────────────

    public function index(Request $request): Response
    {
        $actas = ActaTaller::with(['novedades', 'evidencias'])
            ->when($request->input('placa'),  fn ($q, $v) => $q->where('placa', $v))
            ->when($request->input('estado'), fn ($q, $v) => $q->where('estado_acta', $v))
            ->when($request->input('desde'),  fn ($q, $v) => $q->whereDate('fecha_entrega', '>=', $v))
            ->when($request->input('hasta'),  fn ($q, $v) => $q->whereDate('fecha_entrega', '<=', $v))
            ->orderByDesc('id')
            ->paginate(20)
            ->through(fn ($a) => [
                'id'                     => $a->id,
                'numero_acta'            => $a->numero_acta,
                'placa'                  => $a->placa,
                'taller'                 => $a->taller,
                'motivo_ingreso'         => $a->motivo_ingreso,
                'fecha_entrega'          => $a->fecha_entrega?->format('d/m/Y H:i'),
                'fecha_cierre'           => $a->fecha_cierre?->format('d/m/Y H:i'),
                'estado_acta'            => $a->estado_acta,
                'estado_label'           => $a->estado_label,
                'estado_color'           => $a->estado_color,
                'total_novedades'        => $a->novedades->count(),
                'novedades_solucionadas' => $a->novedades->where('estado', 'solucionado')->count(),
                'novedades_pendientes'   => $a->novedades->where('estado', 'pendiente')->count(),
            ]);

        return Inertia::render('flota/actas-taller/index', [
            'actas'     => $actas,
            'vehiculos' => $this->vehiculos(),
            'filters'   => $request->only(['placa', 'estado', 'desde', 'hasta']),
        ]);
    }

    // ── create ────────────────────────────────────────────────────────────────

    public function create(): Response
    {
        $user = auth()->user();

        return Inertia::render('flota/actas-taller/create', [
            'vehiculos'       => $this->vehiculos(),
            'colaboradores'   => $this->colaboradores(),
            'numero_acta'     => ActaTaller::generarNumero(),
            'fecha_actual'    => now()->format('Y-m-d\TH:i'),
            'usuario_nombre'  => $user?->name ?? '',
        ]);
    }

    // ── store ─────────────────────────────────────────────────────────────────

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'placa'                      => ['required', 'string', 'max:50'],
            'fecha_entrega'              => ['required', 'date'],
            'fecha_estimada_solucion'    => ['nullable', 'date'],
            'kilometraje_entrada'        => ['nullable', 'integer', 'min:0'],
            'taller'                     => ['nullable', 'string', 'max:150'],
            'motivo_ingreso'             => ['nullable', 'string', 'max:255'],
            'colaborador_id'             => ['nullable', 'exists:colaboradores,id'],
            'quien_reporta'              => ['nullable', 'string', 'max:150'],
            'diagnostico_taller'         => ['nullable', 'string'],
            'solucion_realizada'         => ['nullable', 'string'],
            'estado_vehiculo'            => ['nullable', 'array'],
            'inventario'                 => ['nullable', 'array'],
            'observaciones'              => ['nullable', 'string'],
            'combustible'                => ['nullable', 'integer', 'min:0', 'max:100'],
            'nombre_entrega'             => ['nullable', 'string', 'max:120'],
            'cargo_entrega'              => ['nullable', 'string', 'max:100'],
            'nombre_recibe'              => ['nullable', 'string', 'max:120'],
            'identificacion_entrega'     => ['nullable', 'string', 'max:30'],
            'telefono_entrega'           => ['nullable', 'string', 'max:30'],
            'cargo_recibe'               => ['nullable', 'string', 'max:100'],
            'nombre_autorizacion'        => ['nullable', 'string', 'max:120'],
            'cargo_autorizacion'         => ['nullable', 'string', 'max:100'],
            'estado_acta'                => ['nullable', 'string', 'in:en_taller,cerrada,cancelada'],
            'novedades'                  => ['nullable', 'array'],
            'novedades.*.titulo'         => ['required_with:novedades', 'string', 'max:200'],
            'novedades.*.descripcion'    => ['nullable', 'string'],
            'novedades.*.categoria'      => ['nullable', 'string', 'max:100'],
            'novedades.*.prioridad'      => ['nullable', 'in:alta,media,baja'],
            'novedades.*.estado'         => ['nullable', 'in:pendiente,en_revision,solucionado'],
            'novedades.*.responsable'    => ['nullable', 'string', 'max:100'],
            'novedades.*.fecha_reporte'  => ['nullable', 'date'],
            'novedades.*.fecha_solucion' => ['nullable', 'date'],
            'firma_entrega'              => ['nullable'],
            'firma_recibe'               => ['nullable'],
            'firma_autorizacion'         => ['nullable'],
            'evidencias'                 => ['nullable', 'array'],
            'evidencias.*'               => ['nullable', 'file', 'image', 'max:5120'],
        ]);

        $acta = DB::transaction(function () use ($data, $request) {
            $acta = ActaTaller::create([
                'numero_acta'             => ActaTaller::generarNumero(),
                'placa'                   => $data['placa'],
                'fecha_entrega'           => $data['fecha_entrega'],
                'fecha_estimada_solucion' => $data['fecha_estimada_solucion'] ?? null,
                'kilometraje_entrada'     => $data['kilometraje_entrada'] ?? null,
                'taller'                  => $data['taller'] ?? null,
                'motivo_ingreso'          => $data['motivo_ingreso'] ?? null,
                'colaborador_id'          => $data['colaborador_id'] ?? null,
                'quien_reporta'           => $data['quien_reporta'] ?? null,
                'diagnostico_taller'      => $data['diagnostico_taller'] ?? null,
                'solucion_realizada'      => $data['solucion_realizada'] ?? null,
                'estado_vehiculo'         => $data['estado_vehiculo'] ?? null,
                'inventario'              => $data['inventario'] ?? null,
                'observaciones'           => $data['observaciones'] ?? null,
                'combustible'             => $data['combustible'] ?? null,
                'nombre_entrega'          => $data['nombre_entrega'] ?? null,
                'cargo_entrega'           => $data['cargo_entrega'] ?? null,
                'identificacion_entrega'  => $data['identificacion_entrega'] ?? null,
                'telefono_entrega'        => $data['telefono_entrega'] ?? null,
                'contacto_taller'         => $data['contacto_taller'] ?? null,
                'nombre_recibe'           => $data['nombre_recibe'] ?? null,
                'cargo_recibe'            => $data['cargo_recibe'] ?? null,
                'nombre_autorizacion'     => $data['nombre_autorizacion'] ?? null,
                'cargo_autorizacion'      => $data['cargo_autorizacion'] ?? null,
                'estado_acta'             => $data['estado_acta'] ?? ActaTaller::ESTADO_EN_TALLER,
                'user_id'                 => $request->user()?->id,
            ]);

            foreach ($data['novedades'] ?? [] as $i => $nov) {
                $realizada = filter_var($request->input("novedades.{$i}.realizada"), FILTER_VALIDATE_BOOLEAN);
                $estado    = $realizada ? 'solucionado' : ($nov['estado'] ?? 'pendiente');

                $acta->novedades()->create([
                    'titulo'         => $nov['titulo'],
                    'descripcion'    => $nov['descripcion'] ?? null,
                    'categoria'      => $nov['categoria'] ?? null,
                    'prioridad'      => $nov['prioridad'] ?? 'media',
                    'estado'         => $estado,
                    'responsable'    => $nov['responsable'] ?? null,
                    'fecha_reporte'  => $nov['fecha_reporte'] ?? now()->toDateString(),
                    'fecha_solucion' => $nov['fecha_solucion'] ?? null,
                    'orden'          => $i,
                ]);
            }

            foreach (['firma_entrega', 'firma_recibe', 'firma_autorizacion'] as $campo) {
                $valor = $request->input($campo);
                if ($valor && str_starts_with($valor, 'data:image')) {
                    $path = $this->guardarFirmaBase64($valor, "actas-taller/firmas/{$acta->id}");
                    $acta->update([$campo => $path]);
                }
            }

            if ($request->hasFile('evidencias')) {
                foreach ($request->file('evidencias') as $i => $file) {
                    $path = $file->store("actas-taller/evidencias/{$acta->id}", 'public');
                    $acta->evidencias()->create([
                        'path'     => $path,
                        'etiqueta' => $request->input("etiquetas_evidencia.{$i}"),
                        'orden'    => $i,
                    ]);
                }
            }

            return $acta;
        });

        return to_route('flota.actas-taller.index')
            ->with('status', "Acta {$acta->numero_acta} creada correctamente.");
    }

    // ── show ──────────────────────────────────────────────────────────────────

    public function show(ActaTaller $actasTaller): Response
    {
        $actasTaller->load(['novedades', 'evidencias', 'colaborador']);

        return Inertia::render('flota/actas-taller/show', [
            'acta'          => $this->formatActa($actasTaller),
            'colaboradores' => $this->colaboradores(),
            'vehiculos'     => $this->vehiculos(),
        ]);
    }

    // ── update ────────────────────────────────────────────────────────────────

    public function update(Request $request, ActaTaller $actasTaller): RedirectResponse
    {
        $data = $request->validate([
            'placa'                      => ['sometimes', 'string', 'max:50'],
            'fecha_entrega'              => ['sometimes', 'date'],
            'fecha_estimada_solucion'    => ['nullable', 'date'],
            'fecha_cierre'               => ['nullable', 'date'],
            'kilometraje_entrada'        => ['nullable', 'integer', 'min:0'],
            'kilometraje_salida'         => ['nullable', 'integer', 'min:0'],
            'taller'                     => ['nullable', 'string', 'max:150'],
            'motivo_ingreso'             => ['nullable', 'string', 'max:255'],
            'colaborador_id'             => ['nullable', 'exists:colaboradores,id'],
            'quien_reporta'              => ['nullable', 'string', 'max:150'],
            'diagnostico_taller'         => ['nullable', 'string'],
            'solucion_realizada'         => ['nullable', 'string'],
            'estado_vehiculo'            => ['nullable', 'array'],
            'inventario'                 => ['nullable', 'array'],
            'observaciones'              => ['nullable', 'string'],
            'observacion_cierre'         => ['nullable', 'string'],
            'combustible'                => ['nullable', 'integer', 'min:0', 'max:100'],
            'nombre_entrega'             => ['nullable', 'string', 'max:120'],
            'cargo_entrega'              => ['nullable', 'string', 'max:100'],
            'nombre_recibe'              => ['nullable', 'string', 'max:120'],
            'identificacion_entrega'     => ['nullable', 'string', 'max:30'],
            'telefono_entrega'           => ['nullable', 'string', 'max:30'],
            'cargo_recibe'               => ['nullable', 'string', 'max:100'],
            'nombre_autorizacion'        => ['nullable', 'string', 'max:120'],
            'cargo_autorizacion'         => ['nullable', 'string', 'max:100'],
            'estado_acta'                => ['nullable', 'in:en_taller,cerrada,cancelada'],
            'novedades'                  => ['nullable', 'array'],
            'novedades.*.id'             => ['nullable', 'integer'],
            'novedades.*.titulo'         => ['required_with:novedades', 'string', 'max:200'],
            'novedades.*.descripcion'    => ['nullable', 'string'],
            'novedades.*.categoria'      => ['nullable', 'string', 'max:100'],
            'novedades.*.prioridad'      => ['nullable', 'in:alta,media,baja'],
            'novedades.*.estado'         => ['nullable', 'in:pendiente,en_revision,solucionado'],
            'novedades.*.responsable'    => ['nullable', 'string', 'max:100'],
            'novedades.*.fecha_reporte'  => ['nullable', 'date'],
            'novedades.*.fecha_solucion' => ['nullable', 'date'],
        ]);

        DB::transaction(function () use ($data, $request, $actasTaller) {
            $actasTaller->fill($data)->save();

            if (array_key_exists('novedades', $data)) {
                $ids = [];
                foreach ($data['novedades'] ?? [] as $i => $nov) {
                    $reg = $actasTaller->novedades()->updateOrCreate(
                        ['id' => $nov['id'] ?? null],
                        [
                            'titulo'         => $nov['titulo'],
                            'descripcion'    => $nov['descripcion'] ?? null,
                            'categoria'      => $nov['categoria'] ?? null,
                            'prioridad'      => $nov['prioridad'] ?? 'media',
                            'estado'         => $nov['estado'] ?? 'pendiente',
                            'responsable'    => $nov['responsable'] ?? null,
                            'fecha_reporte'  => $nov['fecha_reporte'] ?? null,
                            'fecha_solucion' => $nov['fecha_solucion'] ?? null,
                            'orden'          => $i,
                        ]
                    );
                    $ids[] = $reg->id;
                }
                $actasTaller->novedades()->whereNotIn('id', $ids)->delete();
            }

            foreach (['firma_entrega', 'firma_recibe', 'firma_autorizacion'] as $campo) {
                $valor = $request->input($campo);
                if ($valor && str_starts_with($valor, 'data:image')) {
                    $path = $this->guardarFirmaBase64($valor, "actas-taller/firmas/{$actasTaller->id}");
                    $actasTaller->update([$campo => $path]);
                }
            }

            if ($request->hasFile('evidencias_nuevas')) {
                $offset = $actasTaller->evidencias()->count();
                foreach ($request->file('evidencias_nuevas') as $i => $file) {
                    $path = $file->store("actas-taller/evidencias/{$actasTaller->id}", 'public');
                    $actasTaller->evidencias()->create([
                        'path'     => $path,
                        'etiqueta' => $request->input("etiquetas_nuevas.{$i}"),
                        'orden'    => $offset + $i,
                    ]);
                }
            }
        });

        return back()->with('status', 'Acta actualizada correctamente.');
    }

    // ── exportarExcel ─────────────────────────────────────────────────────────

    public function exportarExcel(Request $request)
    {
        $actas = $this->queryExport($request)->get();

        return Excel::download(
            new ActaTallerExport($actas),
            'actas-taller-' . now()->format('Y-m-d') . '.xlsx'
        );
    }

    // ── exportarPdf (lista, con filtros) ─────────────────────────────────────

    public function exportarPdf(Request $request)
    {
        $actas = $this->queryExport($request)->get();

        return Pdf::loadView('flota.actas-taller-pdf', ['actas' => $actas])
            ->setPaper('a4', 'landscape')
            ->download('actas-taller-' . now()->format('Y-m-d') . '.pdf');
    }

    // ── exportarActaPdf (una sola acta por número) ────────────────────────────

    public function exportarActaPdf(ActaTaller $actasTaller)
    {
        $actasTaller->load(['novedades']);

        return Pdf::loadView('flota.acta-taller-pdf', ['acta' => $actasTaller])
            ->setPaper('a4', 'portrait')
            ->download('acta-' . $actasTaller->numero_acta . '.pdf');
    }

    // ── Query compartida para exports ─────────────────────────────────────────

    private function queryExport(Request $request)
    {
        return ActaTaller::with(['novedades'])
            ->when($request->input('placa'),  fn ($q, $v) => $q->where('placa', $v))
            ->when($request->input('estado'), fn ($q, $v) => $q->where('estado_acta', $v))
            ->when($request->input('desde'),  fn ($q, $v) => $q->whereDate('fecha_entrega', '>=', $v))
            ->when($request->input('hasta'),  fn ($q, $v) => $q->whereDate('fecha_entrega', '<=', $v))
            ->latest('fecha_entrega');
    }

    // ── destroy ───────────────────────────────────────────────────────────────

    public function destroy(ActaTaller $actasTaller): RedirectResponse
    {
        $actasTaller->delete();
        return to_route('flota.actas-taller.index')
            ->with('status', 'Acta eliminada.');
    }

    // ── dashboard ─────────────────────────────────────────────────────────────

    public function dashboard(Request $request): Response
    {
        $desde = $request->input('desde', now()->startOfMonth()->toDateString());
        $hasta = $request->input('hasta', now()->toDateString());

        $actas     = ActaTaller::with('novedades')
            ->whereDate('fecha_entrega', '>=', $desde)
            ->whereDate('fecha_entrega', '<=', $hasta)
            ->get();
        $novedades = $actas->flatMap->novedades;

        $total       = $novedades->count();
        $solucionadas = $novedades->where('estado', 'solucionado')->count();
        $pendientes   = $novedades->where('estado', 'pendiente')->count();
        $pct          = $total > 0 ? round($solucionadas / $total * 100) : 0;

        $tiempoPromedio = $novedades
            ->filter(fn ($n) => $n->fecha_reporte && $n->fecha_solucion)
            ->avg(fn ($n) => $n->fecha_reporte->diffInDays($n->fecha_solucion));

        $vencidas = $actas->filter(fn ($a) =>
            $a->estado_acta === 'en_taller' &&
            $a->fecha_estimada_solucion?->isPast()
        )->count();

        $novedadesPorMes = ActaTallerNovedad::selectRaw("DATE_FORMAT(fecha_reporte,'%Y-%m') as mes, COUNT(*) as total")
            ->whereDate('fecha_reporte', '>=', now()->subMonths(5)->startOfMonth())
            ->groupBy('mes')->orderBy('mes')->get()
            ->map(fn ($r) => ['mes' => $r->mes, 'total' => $r->total]);

        $novedadesPorTipo = $novedades
            ->groupBy(fn ($n) => $n->categoria ?: 'Sin categoría')
            ->map(fn ($g, $cat) => ['categoria' => $cat, 'total' => $g->count()])
            ->values();

        $vehiculosMasNovedades = $actas
            ->groupBy('placa')
            ->map(fn ($g, $placa) => ['placa' => $placa, 'total' => $g->flatMap->novedades->count()])
            ->sortByDesc('total')->take(5)->values();

        $tallerMejorTiempo = ActaTaller::with('novedades')
            ->whereNotNull('taller')
            ->whereDate('fecha_entrega', '>=', $desde)->get()
            ->groupBy('taller')
            ->map(fn ($g, $t) => [
                'taller'   => $t,
                'promedio' => $g->flatMap->novedades
                    ->filter(fn ($n) => $n->fecha_reporte && $n->fecha_solucion)
                    ->avg(fn ($n) => $n->fecha_reporte->diffInDays($n->fecha_solucion)) ?? 0,
            ])
            ->filter(fn ($t) => $t['promedio'] > 0)
            ->sortBy('promedio')->first();

        return Inertia::render('flota/actas-taller/dashboard', [
            'kpis' => [
                'vehiculos_enviados' => $actas->pluck('placa')->unique()->count(),
                'actas_creadas'      => $actas->count(),
                'total_novedades'    => $total,
                'solucionadas'       => $solucionadas,
                'pendientes'         => $pendientes,
                'pct_cumplimiento'   => $pct,
                'tiempo_promedio'    => round((float) $tiempoPromedio, 1),
                'vencidas'           => $vencidas,
                'actas_cerradas'     => $actas->where('estado_acta', 'cerrada')->count(),
                'taller_mejor'       => $tallerMejorTiempo,
            ],
            'novedades_por_mes'       => $novedadesPorMes,
            'novedades_por_tipo'      => $novedadesPorTipo,
            'vehiculos_mas_novedades' => $vehiculosMasNovedades,
            'filters'                 => compact('desde', 'hasta'),
        ]);
    }

    // ── Firma base64 → storage ────────────────────────────────────────────────

    private function guardarFirmaBase64(string $base64, string $carpeta): string
    {
        [$meta, $datos] = explode(',', $base64, 2);
        $ext  = str_contains($meta, 'png') ? 'png' : 'jpg';
        $name = uniqid('firma_', true) . ".{$ext}";
        $path = "{$carpeta}/{$name}";
        Storage::disk('public')->put($path, base64_decode($datos));
        return $path;
    }
}
