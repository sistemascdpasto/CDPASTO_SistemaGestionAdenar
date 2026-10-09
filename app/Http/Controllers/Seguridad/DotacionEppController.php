<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\EppEntrega;
use App\Services\Seguridad\EppEstadoService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class DotacionEppController extends Controller
{
    public function __construct(private readonly EppEstadoService $estado)
    {
    }

    public function index(Request $request): Response
    {
        $centro = trim((string) $request->input('centro', ''));
        $area = trim((string) $request->input('area', ''));
        $cargo = trim((string) $request->input('cargo', ''));
        $estadoFiltro = trim((string) $request->input('estado', ''));

        $colaboradores = Colaborador::query()
            ->where('is_active', true)
            ->when($centro !== '', fn ($q) => $q->where('centro', $centro))
            ->when($area !== '', fn ($q) => $q->where('area', $area))
            ->when($cargo !== '', fn ($q) => $q->where('cargo', $cargo))
            ->with('eppEntregas')
            ->orderBy('nombres')
            ->get();

        $filas = $colaboradores->map(function (Colaborador $c) {
            $porItem = $this->estado->estadoPorItem($c);

            return [
                'id' => $c->id,
                'nombre_completo' => $c->nombre_completo,
                'cedula' => $c->cedula,
                'centro' => $c->centro,
                'area' => $c->area,
                'cargo' => $c->cargo,
                'items' => $porItem,
                'estado' => $this->estado->resumenColaborador($c),
            ];
        });

        if ($estadoFiltro !== '') {
            $filas = $filas->filter(fn (array $f) => $f['estado'] === $estadoFiltro)->values();
        }

        return Inertia::render('seguridad/dotacion-epp/index', [
            'filas' => $filas,
            'kpis' => [
                'total' => $colaboradores->count(),
                'al_dia' => $filas->where('estado', 'al_dia')->count(),
                'proximos' => $filas->where('estado', 'proximo')->count(),
                'vencidos' => $filas->where('estado', 'vencido')->count(),
            ],
            'items_labels' => EppEntrega::ITEMS,
            'opciones' => [
                'centros' => Colaborador::query()->where('is_active', true)->whereNotNull('centro')->distinct()->orderBy('centro')->pluck('centro'),
                'areas' => Colaborador::query()->where('is_active', true)->whereNotNull('area')->distinct()->orderBy('area')->pluck('area'),
                'cargos' => Colaborador::query()->where('is_active', true)->whereNotNull('cargo')->distinct()->orderBy('cargo')->pluck('cargo'),
            ],
            'filters' => ['centro' => $centro, 'area' => $area, 'cargo' => $cargo, 'estado' => $estadoFiltro],
        ]);
    }

    public function show(Colaborador $colaborador): Response
    {
        $colaborador->load(['eppPerfil', 'eppEntregas.registradoPor:id,name']);

        return Inertia::render('seguridad/dotacion-epp/show', [
            'colaborador' => [
                'id' => $colaborador->id,
                'nombre_completo' => $colaborador->nombre_completo,
                'cedula' => $colaborador->cedula,
                'centro' => $colaborador->centro,
                'area' => $colaborador->area,
                'cargo' => $colaborador->cargo,
                'fecha_ingreso_empresa' => $colaborador->fecha_ingreso_empresa?->format('Y-m-d'),
            ],
            'perfil' => $colaborador->eppPerfil,
            'entregas' => $colaborador->eppEntregas->map(fn (EppEntrega $e) => [
                'id' => $e->id,
                'fecha_entrega' => $e->fecha_entrega->format('Y-m-d'),
                ...array_combine(array_keys(EppEntrega::ITEMS), array_map(fn ($item) => (bool) $e->$item, array_keys(EppEntrega::ITEMS))),
                'otros_cual' => $e->otros_cual,
                'firma_url' => $e->firma_url,
                'foto_url' => $e->foto_url,
                'observaciones' => $e->observaciones,
                'registrado_por' => $e->registradoPor?->name,
            ]),
            'items_labels' => EppEntrega::ITEMS,
            'estado_por_item' => $this->estado->estadoPorItem($colaborador),
        ]);
    }

    public function storeEntrega(Request $request, Colaborador $colaborador): RedirectResponse
    {
        $rules = [
            'fecha_entrega' => ['required', 'date'],
            'otros_cual' => ['nullable', 'string', 'max:150'],
            'observaciones' => ['nullable', 'string'],
            'firma' => ['nullable', 'string'],
            'foto' => ['nullable', 'image', 'max:5120'],
        ];
        foreach (array_keys(EppEntrega::ITEMS) as $item) {
            $rules[$item] = ['nullable', 'boolean'];
        }
        $data = $request->validate($rules);

        $entrega = DB::transaction(function () use ($data, $request, $colaborador) {
            $items = [];
            foreach (array_keys(EppEntrega::ITEMS) as $item) {
                $items[$item] = $request->boolean($item);
            }

            $entrega = $colaborador->eppEntregas()->create([
                'fecha_entrega' => $data['fecha_entrega'],
                ...$items,
                'otros_cual' => $data['otros_cual'] ?? null,
                'observaciones' => $data['observaciones'] ?? null,
                'registrado_por_id' => $request->user()?->id,
            ]);

            if (! empty($data['firma']) && str_starts_with($data['firma'], 'data:image')) {
                $entrega->update(['firma_path' => $this->guardarBase64($data['firma'], "seguridad/epp/{$colaborador->id}")]);
            }

            if ($request->hasFile('foto')) {
                $path = $request->file('foto')->store("seguridad/epp/{$colaborador->id}", 'public');
                $entrega->update(['foto_path' => $path]);
            }

            return $entrega;
        });

        return back()->with('status', "Entrega del {$entrega->fecha_entrega->format('d/m/Y')} registrada correctamente.");
    }

    public function updatePerfil(Request $request, Colaborador $colaborador): RedirectResponse
    {
        $data = $request->validate([
            'talla_calzado' => ['nullable', 'string', 'max:20'],
            'talla_camisa' => ['nullable', 'string', 'max:20'],
            'talla_pantalon' => ['nullable', 'string', 'max:20'],
            'talla_otros' => ['nullable', 'string', 'max:50'],
        ]);

        $colaborador->eppPerfil()->updateOrCreate(['colaborador_id' => $colaborador->id], $data);

        return back()->with('status', 'Tallas actualizadas correctamente.');
    }

    public function storeCompromiso(Request $request, Colaborador $colaborador): RedirectResponse
    {
        $data = $request->validate([
            'firma' => ['required', 'string'],
        ]);

        $perfil = $colaborador->eppPerfil ?: $colaborador->eppPerfil()->make(['colaborador_id' => $colaborador->id]);

        if ($perfil->compromiso_firma_path) {
            Storage::disk('public')->delete($perfil->compromiso_firma_path);
        }

        $path = $this->guardarBase64($data['firma'], "seguridad/epp/{$colaborador->id}/compromiso");

        $colaborador->eppPerfil()->updateOrCreate(
            ['colaborador_id' => $colaborador->id],
            ['compromiso_firma_path' => $path, 'compromiso_firmado_en' => now()],
        );

        return back()->with('status', 'Compromiso firmado correctamente.');
    }

    public function exportarPdf(Colaborador $colaborador)
    {
        $colaborador->load(['eppPerfil', 'eppEntregas.registradoPor:id,name']);

        return Pdf::loadView('seguridad.dotacion-epp-pdf', [
            'colaborador' => $colaborador,
            'perfil' => $colaborador->eppPerfil,
            'entregas' => $colaborador->eppEntregas()->orderBy('fecha_entrega')->get(),
        ])
            ->setPaper('a4', 'portrait')
            ->download('dotacion-epp-'.str($colaborador->nombre_completo)->slug().'.pdf');
    }

    private function guardarBase64(string $base64, string $carpeta): string
    {
        [$meta, $datos] = explode(',', $base64, 2);
        $ext = str_contains($meta, 'png') ? 'png' : 'jpg';
        $name = uniqid('firma_', true).".{$ext}";
        $path = "{$carpeta}/{$name}";
        Storage::disk('public')->put($path, base64_decode($datos));

        return $path;
    }
}
