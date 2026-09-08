<?php

namespace App\Http\Controllers\Seguridad;

use App\Exports\Seguridad\CondicionesSaludExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\Seguridad\StoreCondicionSaludRequest;
use App\Models\Seguridad\CondicionSalud;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class CondicionSaludController extends Controller
{
    /**
     * HU027: vista de Seguridad con filtros por identificación/nombre/fecha y
     * una fila combinada de ingreso+salida por colaborador y día, igual a la
     * plantilla en papel PAS-BAV-SST-FR-028.
     */
    public function index(Request $request): Response
    {
        [$filtros, $filas] = $this->filasFiltradas($request);
        $page = (int) $request->input('page', 1);

        $perPage = 15;
        $paginado = new LengthAwarePaginator(
            $filas->forPage($page, $perPage)->values(),
            $filas->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        return Inertia::render('seguridad/condiciones-salud/index', [
            'registros' => $paginado,
            'filters' => $filtros,
        ]);
    }

    public function exportarPdf(Request $request): \Illuminate\Http\Response
    {
        [$filtros, $filas] = $this->filasFiltradas($request);

        return Pdf::loadView('seguridad.condiciones-salud-pdf', ['filas' => $filas, 'filtros' => $filtros])
            ->setPaper('a4', 'landscape')
            ->download('condiciones-salud-'.now()->format('Y-m-d').'.pdf');
    }

    public function exportarExcel(Request $request): BinaryFileResponse
    {
        [, $filas] = $this->filasFiltradas($request);

        return Excel::download(new CondicionesSaludExport($filas), 'condiciones-salud-'.now()->format('Y-m-d').'.xlsx');
    }

    /**
     * Filtros compartidos por el listado y ambas exportaciones. Devuelve los
     * filtros normalizados y las filas ya combinadas (ingreso + salida por
     * colaborador y día), ordenadas de la más reciente a la más antigua.
     *
     * @return array{0: array<string, string>, 1: Collection<int, array<string, mixed>>}
     */
    private function filasFiltradas(Request $request): array
    {
        $identificacion = $request->string('identificacion')->trim()->toString();
        $nombre = $request->string('nombre')->trim()->toString();
        $desde = $request->filled('desde') ? Carbon::parse($request->input('desde'))->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
        $hasta = $request->filled('hasta') ? Carbon::parse($request->input('hasta'))->endOfDay() : Carbon::now()->endOfDay();

        $registros = CondicionSalud::query()
            ->with(['colaborador:id,nombres,apellidos,cedula,cargo,area,turno', 'pruebaAlcoholemia:id,firma_path'])
            ->whereBetween('fecha_hora', [$desde, $hasta])
            ->when($identificacion !== '', fn ($query) => $query->whereHas(
                'colaborador',
                fn ($q) => $q->where('cedula', 'like', "%{$identificacion}%")
            ))
            ->when($nombre !== '', fn ($query) => $query->whereHas(
                'colaborador',
                fn ($q) => $q->where(function ($q) use ($nombre) {
                    $q->where('nombres', 'like', "%{$nombre}%")->orWhere('apellidos', 'like', "%{$nombre}%");
                })
            ))
            ->orderBy('fecha_hora')
            ->get();

        $filas = $registros
            ->groupBy(fn (CondicionSalud $condicion) => $condicion->colaborador_id.'|'.$condicion->fecha_hora->toDateString())
            ->map(function ($grupo) {
                $ingreso = $grupo->firstWhere('momento', 'ingreso');
                $salida = $grupo->firstWhere('momento', 'salida');
                $colaborador = $grupo->first()->colaborador;
                $firmaColaboradorPath = $salida?->pruebaAlcoholemia?->firma_path ?? $ingreso?->pruebaAlcoholemia?->firma_path;

                return [
                    'fecha' => $grupo->first()->fecha_hora->toDateString(),
                    'colaborador' => [
                        'nombres' => $colaborador->nombres,
                        'apellidos' => $colaborador->apellidos,
                        'cedula' => $colaborador->cedula,
                        'cargo' => $colaborador->cargo,
                        'area' => $colaborador->area,
                        'turno' => $colaborador->turno,
                    ],
                    'hora_ingreso' => $ingreso?->fecha_hora?->format('H:i'),
                    'estado_ingreso' => $ingreso?->estado,
                    'observacion_ingreso' => $ingreso?->observacion,
                    'hora_salida' => $salida?->fecha_hora?->format('H:i'),
                    'estado_salida' => $salida?->estado,
                    'observacion_salida' => $salida?->observacion,
                    'salida_id' => $salida?->id,
                    'firma_colaborador_url' => $firmaColaboradorPath ? '/storage/'.$firmaColaboradorPath : null,
                    'firma_supervisor_url' => $salida?->firma_supervisor_path ? '/storage/'.$salida->firma_supervisor_path : null,
                    'firmado_en' => $salida?->firmado_en,
                ];
            })
            ->sortByDesc('fecha')
            ->values();

        $filtros = [
            'identificacion' => $identificacion,
            'nombre' => $nombre,
            'desde' => $desde->toDateString(),
            'hasta' => $hasta->toDateString(),
        ];

        return [$filtros, $filas];
    }

    public function store(StoreCondicionSaludRequest $request): RedirectResponse
    {
        CondicionSalud::create([
            ...$request->validated(),
            'responsable_id' => $request->user()->id,
            'fecha_hora' => Carbon::now(),
        ]);

        return back()->with('status', 'Condición de salud registrada correctamente.');
    }

    /**
     * Firma de supervisor (Seguridad) sobre el registro de salida — solo
     * válida cuando el día ya está completo (ingreso + salida), igual a la
     * plantilla en papel.
     */
    public function firmar(Request $request, CondicionSalud $condicion): RedirectResponse
    {
        abort_unless($condicion->momento === 'salida', 403, 'La firma de supervisor solo se aplica sobre el registro de salida.');

        $existeIngreso = CondicionSalud::query()
            ->where('colaborador_id', $condicion->colaborador_id)
            ->where('momento', 'ingreso')
            ->whereDate('fecha_hora', $condicion->fecha_hora->toDateString())
            ->exists();

        abort_unless($existeIngreso, 422, 'No se puede firmar: falta el registro de ingreso de ese día.');

        $request->validate([
            'firma' => ['required', 'image', 'max:2048'],
        ]);

        $condicion->update([
            'firma_supervisor_path' => $request->file('firma')->store('firmas-supervisor', 'public'),
            'firmado_por_id' => $request->user()->id,
            'firmado_en' => Carbon::now(),
        ]);

        return back()->with('status', 'Firma registrada correctamente.');
    }
}
