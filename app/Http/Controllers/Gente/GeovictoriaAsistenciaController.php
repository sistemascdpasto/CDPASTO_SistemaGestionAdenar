<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\GeovictoriaAsistencia;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class GeovictoriaAsistenciaController extends Controller
{
    /**
     * Solo lectura: estos datos los genera la automatización GeoVictoria
     * que corre en una PC local (ver POST /api/geovictoria/asistencias),
     * no se crean/editan desde la web.
     */
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $grupo = $request->string('grupo')->trim()->toString();
        $cargo = $request->string('cargo')->trim()->toString();
        $tipo = $request->string('tipo')->trim()->toString();
        $fechaDesde = $request->string('fecha_desde')->trim()->toString();
        $fechaHasta = $request->string('fecha_hasta')->trim()->toString();

        $registros = GeovictoriaAsistencia::query()
            ->when($search !== '', fn ($query) => $query->where(fn ($q) => $q
                ->where('identificador', 'like', "%{$search}%")
                ->orWhere('nombres', 'like', "%{$search}%")
                ->orWhere('apellidos', 'like', "%{$search}%")))
            ->when($grupo !== '', fn ($query) => $query->where('grupo', $grupo))
            ->when($cargo !== '', fn ($query) => $query->where('cargo', $cargo))
            ->when($tipo === 'exceso_jornada', fn ($query) => $query->where('exceso_jornada', true))
            ->when($tipo === 'descanso_no_efectivo', fn ($query) => $query->where('descanso_no_efectivo', true))
            ->tap(fn ($query) => $this->scopeFechas($query, $fechaDesde, $fechaHasta))
            ->orderByDesc('fecha')
            ->orderBy('apellidos')
            ->paginate(20)
            ->withQueryString();

        $hoy = CarbonImmutable::now();
        $registrosHoy = GeovictoriaAsistencia::query()
            ->whereDate('fecha', $hoy->toDateString())
            ->orderBy('apellidos')
            ->get();

        return Inertia::render('gente/geovictoria-asistencia/index', [
            'registros' => $registros,
            'filters' => [
                'search' => $search,
                'grupo' => $grupo,
                'cargo' => $cargo,
                'tipo' => $tipo,
                'fecha_desde' => $fechaDesde,
                'fecha_hasta' => $fechaHasta,
            ],
            'opciones' => [
                'grupos' => $this->valoresDistintos('grupo'),
                'cargos' => $this->valoresDistintos('cargo'),
            ],
            'hoy' => [
                'fecha' => $hoy->toDateString(),
                'registros' => $registrosHoy,
                'resumen' => [
                    'total' => $registrosHoy->count(),
                    'exceso_jornada' => $registrosHoy->where('exceso_jornada', true)->count(),
                    'descanso_no_efectivo' => $registrosHoy->where('descanso_no_efectivo', true)->count(),
                ],
            ],
            'seguimiento' => $this->seguimientoSalidasTarde($hoy),
            'indicadores' => [
                'resumen' => $this->resumen($fechaDesde, $fechaHasta),
                'tendencia_diaria' => $this->tendenciaDiaria($fechaDesde, $fechaHasta),
                'top_empleados' => $this->topEmpleadosConIncidencias($fechaDesde, $fechaHasta),
                'por_grupo' => $this->incidenciasPorGrupo($fechaDesde, $fechaHasta),
                'distribucion_cargo' => $this->distribucionPorCargo($fechaDesde, $fechaHasta),
                'horas_promedio_cargo' => $this->horasPromedioPorCargo($fechaDesde, $fechaHasta),
            ],
        ]);
    }

    /**
     * Filtro de rango de fechas compartido por todos los indicadores y por
     * el detalle, igual que el histórico de la automatización (desde/hasta
     * afecta tanto las gráficas como la tabla, ver app.py::index()).
     */
    private function scopeFechas(Builder $query, string $fechaDesde, string $fechaHasta): void
    {
        $query
            ->when($fechaDesde !== '', fn ($q) => $q->whereDate('fecha', '>=', $fechaDesde))
            ->when($fechaHasta !== '', fn ($q) => $q->whereDate('fecha', '<=', $fechaHasta));
    }

    /**
     * Salidas después de las 18:30 de ayer y hoy (la automatización solo
     * llena 'hora_minima_entrada' en esos casos), con el estado de la
     * siguiente entrada: pendiente si todavía no la marca, y si ya la
     * marcó, si cumplió el descanso mínimo según 'descanso_no_efectivo' de
     * ese día.
     */
    private function seguimientoSalidasTarde(CarbonImmutable $hoy): array
    {
        $registros = GeovictoriaAsistencia::query()
            ->whereNotNull('hora_minima_entrada')
            ->whereDate('fecha', '>=', $hoy->subDay()->toDateString())
            ->whereDate('fecha', '<=', $hoy->toDateString())
            ->orderBy('hora_minima_entrada')
            ->get();

        $siguientes = GeovictoriaAsistencia::query()
            ->whereIn('identificador', $registros->pluck('identificador')->unique())
            ->whereDate('fecha', '>=', $hoy->toDateString())
            ->whereDate('fecha', '<=', $hoy->addDay()->toDateString())
            ->get()
            ->keyBy(fn (GeovictoriaAsistencia $registro) => $registro->identificador.'|'.$registro->fecha->format('Y-m-d'));

        return $registros->map(function (GeovictoriaAsistencia $registro) use ($siguientes) {
            $siguiente = $siguientes->get($registro->identificador.'|'.$registro->fecha->copy()->addDay()->format('Y-m-d'));
            $entradaSiguiente = $siguiente?->entrada;

            return [
                'id' => $registro->id,
                'fecha' => $registro->fecha->format('Y-m-d'),
                'identificador' => $registro->identificador,
                'nombre' => trim("{$registro->nombres} {$registro->apellidos}") ?: $registro->identificador,
                'cargo' => $registro->cargo,
                'grupo' => $registro->grupo,
                'salida' => $registro->salida,
                'hora_minima_entrada' => $registro->hora_minima_entrada->format('Y-m-d H:i'),
                'entrada_siguiente' => $entradaSiguiente,
                'estado' => ! $entradaSiguiente ? 'pendiente' : ($siguiente->descanso_no_efectivo ? 'incumplio' : 'cumplio'),
            ];
        })->all();
    }

    private function valoresDistintos(string $columna): array
    {
        return GeovictoriaAsistencia::query()
            ->whereNotNull($columna)
            ->where($columna, '!=', '')
            ->pluck($columna)
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    private function resumen(string $fechaDesde, string $fechaHasta): array
    {
        $base = fn () => GeovictoriaAsistencia::query()->tap(fn ($q) => $this->scopeFechas($q, $fechaDesde, $fechaHasta));

        $total = $base()->count();
        $conExceso = $base()->where('exceso_jornada', true)->count();
        $conDescanso = $base()->where('descanso_no_efectivo', true)->count();
        $empleados = $base()->distinct()->count('identificador');

        return [
            'total_registros' => $total,
            'empleados' => $empleados,
            'pct_exceso_jornada' => $total > 0 ? round($conExceso * 100 / $total, 1) : 0,
            'pct_descanso_no_efectivo' => $total > 0 ? round($conDescanso * 100 / $total, 1) : 0,
            'promedio_horas_trabajadas' => $this->promedioHorasTrabajadas($fechaDesde, $fechaHasta),
        ];
    }

    /**
     * 'horas_trabajadas' llega como texto "HH:MM" desde el reporte de
     * GeoVictoria (columna HT), no como un intervalo de tipo de dato en la
     * base, así que se convierte a minutos en PHP para poder promediarlo.
     * Null si el turno todavía está en curso (sin marca de salida) o el
     * texto no tiene el formato esperado.
     */
    private function minutosTrabajados(?string $valor): ?int
    {
        if (! $valor || ! preg_match('/^(-?)(\d{1,3}):(\d{2})/', $valor, $m)) {
            return null;
        }

        $signo = $m[1] === '-' ? -1 : 1;

        return $signo * ((int) $m[2] * 60 + (int) $m[3]);
    }

    private function promedioHorasTrabajadas(string $fechaDesde, string $fechaHasta): ?string
    {
        $minutos = GeovictoriaAsistencia::query()
            ->tap(fn ($q) => $this->scopeFechas($q, $fechaDesde, $fechaHasta))
            ->whereNotNull('horas_trabajadas')
            ->where('horas_trabajadas', '!=', '')
            ->pluck('horas_trabajadas')
            ->map(fn (string $valor) => $this->minutosTrabajados($valor))
            ->filter(fn ($valor) => $valor !== null);

        if ($minutos->isEmpty()) {
            return null;
        }

        $promedio = (int) round($minutos->avg());
        $signo = $promedio < 0 ? '-' : '';
        $promedio = abs($promedio);

        return sprintf('%s%02d:%02d', $signo, intdiv($promedio, 60), $promedio % 60);
    }

    /**
     * Incidencias por día (para el stacked bar de tendencia). Si no se
     * pasa un rango de fechas, muestra los últimos 30 días por defecto
     * para no graficar todo el histórico de una vez; si se pasa un rango,
     * grafica exactamente ese rango (igual que la automatización). Se
     * agrupa en PHP en vez de con funciones de fecha de SQL para que el
     * resultado sea igual en MySQL (producción) y sqlite (tests), y se
     * rellenan los días sin datos.
     */
    private function tendenciaDiaria(string $fechaDesde, string $fechaHasta): array
    {
        $desde = $fechaDesde !== '' ? CarbonImmutable::parse($fechaDesde) : CarbonImmutable::now()->subDays(29)->startOfDay();
        $hasta = $fechaHasta !== '' ? CarbonImmutable::parse($fechaHasta) : CarbonImmutable::now();

        if ($desde->greaterThan($hasta)) {
            return [];
        }

        $porDia = GeovictoriaAsistencia::query()
            ->tap(fn ($q) => $this->scopeFechas($q, $desde->toDateString(), $hasta->toDateString()))
            ->where(fn ($query) => $query->where('exceso_jornada', true)->orWhere('descanso_no_efectivo', true))
            ->get(['fecha', 'exceso_jornada', 'descanso_no_efectivo'])
            ->groupBy(fn (GeovictoriaAsistencia $registro) => $registro->fecha->format('Y-m-d'));

        $dias = [];
        for ($fecha = $desde; $fecha <= $hasta; $fecha = $fecha->addDay()) {
            $clave = $fecha->format('Y-m-d');
            $delDia = $porDia->get($clave, collect());

            $dias[] = [
                'fecha' => $clave,
                'exceso_jornada' => $delDia->where('exceso_jornada', true)->count(),
                'descanso_no_efectivo' => $delDia->where('descanso_no_efectivo', true)->count(),
            ];
        }

        return $dias;
    }

    /**
     * Empleados con más días de incidencia (exceso de jornada o descanso
     * no efectivo) en el rango seleccionado.
     */
    private function topEmpleadosConIncidencias(string $fechaDesde, string $fechaHasta): array
    {
        return GeovictoriaAsistencia::query()
            ->tap(fn ($q) => $this->scopeFechas($q, $fechaDesde, $fechaHasta))
            ->where(fn ($query) => $query->where('exceso_jornada', true)->orWhere('descanso_no_efectivo', true))
            ->select(
                'identificador',
                DB::raw('MAX(nombres) as nombres'),
                DB::raw('MAX(apellidos) as apellidos'),
                DB::raw('SUM(CASE WHEN exceso_jornada THEN 1 ELSE 0 END) as total_exceso_jornada'),
                DB::raw('SUM(CASE WHEN descanso_no_efectivo THEN 1 ELSE 0 END) as total_descanso_no_efectivo'),
            )
            ->groupBy('identificador')
            ->orderByDesc(DB::raw('SUM(CASE WHEN exceso_jornada THEN 1 ELSE 0 END) + SUM(CASE WHEN descanso_no_efectivo THEN 1 ELSE 0 END)'))
            ->limit(10)
            ->get()
            ->map(fn ($fila) => [
                'identificador' => $fila->identificador,
                'nombre' => trim("{$fila->nombres} {$fila->apellidos}"),
                'total_exceso_jornada' => (int) $fila->total_exceso_jornada,
                'total_descanso_no_efectivo' => (int) $fila->total_descanso_no_efectivo,
            ])
            ->all();
    }

    /**
     * Incidencias por grupo en el rango seleccionado (incluye grupos sin
     * ninguna incidencia, con 0/0, para que el gráfico muestre siempre el
     * mismo conjunto de grupos).
     */
    private function incidenciasPorGrupo(string $fechaDesde, string $fechaHasta): array
    {
        return GeovictoriaAsistencia::query()
            ->tap(fn ($q) => $this->scopeFechas($q, $fechaDesde, $fechaHasta))
            ->get(['grupo', 'exceso_jornada', 'descanso_no_efectivo'])
            ->groupBy(fn (GeovictoriaAsistencia $registro) => $registro->grupo ?: 'Sin grupo')
            ->map(fn ($registros, $grupo) => [
                'grupo' => $grupo,
                'exceso_jornada' => $registros->where('exceso_jornada', true)->count(),
                'descanso_no_efectivo' => $registros->where('descanso_no_efectivo', true)->count(),
            ])
            ->sortBy('grupo')
            ->values()
            ->all();
    }

    /**
     * Distribución de registros por cargo en el rango seleccionado
     * (composición del histórico filtrado, no solo de las incidencias).
     */
    private function distribucionPorCargo(string $fechaDesde, string $fechaHasta): array
    {
        return GeovictoriaAsistencia::query()
            ->tap(fn ($q) => $this->scopeFechas($q, $fechaDesde, $fechaHasta))
            ->get(['cargo'])
            ->groupBy(fn (GeovictoriaAsistencia $registro) => $registro->cargo ?: 'Sin cargo')
            ->map(fn ($registros, $cargo) => ['cargo' => $cargo, 'total' => $registros->count()])
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /**
     * Horas trabajadas promedio por cargo en el rango seleccionado, solo
     * con turnos ya completados (con hora de salida marcada), igual que
     * el promedio general.
     */
    private function horasPromedioPorCargo(string $fechaDesde, string $fechaHasta): array
    {
        return GeovictoriaAsistencia::query()
            ->tap(fn ($q) => $this->scopeFechas($q, $fechaDesde, $fechaHasta))
            ->whereNotNull('horas_trabajadas')
            ->where('horas_trabajadas', '!=', '')
            ->get(['cargo', 'horas_trabajadas'])
            ->groupBy(fn (GeovictoriaAsistencia $registro) => $registro->cargo ?: 'Sin cargo')
            ->map(function ($registros, $cargo) {
                $minutos = $registros
                    ->map(fn (GeovictoriaAsistencia $registro) => $this->minutosTrabajados($registro->horas_trabajadas))
                    ->filter(fn ($valor) => $valor !== null);

                return $minutos->isEmpty() ? null : ['cargo' => $cargo, 'horas' => round($minutos->avg() / 60, 1)];
            })
            ->filter()
            ->sortByDesc('horas')
            ->values()
            ->all();
    }
}
