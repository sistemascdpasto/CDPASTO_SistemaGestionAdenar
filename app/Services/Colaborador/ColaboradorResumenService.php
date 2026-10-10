<?php

namespace App\Services\Colaborador;

use App\Models\Capacitaciones\CapacitacionMaterial;
use App\Models\Reparto\CompensacionVariable;
use App\Models\Reparto\CompensacionVariableDiaria;
use App\Models\Reparto\EventosTripulacion;
use App\Models\GeovictoriaAsistencia;
use App\Models\Seguridad\Aci;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\EncuestaMorbilidad;
use App\Services\Seguridad\EvaluacionCalculator;
use Carbon\Carbon;

class ColaboradorResumenService
{
    private const MESES_ES = [
        1 => 'Enero', 2 => 'Febrero', 3 => 'Marzo', 4 => 'Abril',
        5 => 'Mayo', 6 => 'Junio', 7 => 'Julio', 8 => 'Agosto',
        9 => 'Septiembre', 10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre',
    ];

    public function __construct(private readonly EvaluacionCalculator $evaluacionCalculator)
    {
    }

    public function resumen(Colaborador $colaborador, int $userId): array
    {
        return [
            'compensacion_diaria' => $this->compensacionDiaria($colaborador),
            'compensacion_variable' => $this->compensacionVariable($colaborador),
            'plan_premiacion' => $this->planPremiacion($colaborador),
            'plan_padrinos' => $this->planPadrinos($colaborador),
            'geovictoria' => $this->geovictoria($colaborador),
            'capacitaciones' => $this->capacitaciones($userId),
            'condicion_salud' => $this->condicionSalud($colaborador),
            'encuesta_morbilidad_pendiente' => $this->encuestaMorbilidadPendiente($colaborador),
            'indicadores_reparto' => $this->indicadoresReparto($colaborador),
        ];
    }

    private function cedulaDe(Colaborador $colaborador): string
    {
        return trim((string) ($colaborador->cedula ?? ''));
    }

    private function compensacionDiaria(Colaborador $colaborador): array
    {
        $cedula = $this->cedulaDe($colaborador);
        $inicioMes = now()->startOfMonth()->toDateString();
        $hoy = now()->toDateString();

        $fila = CompensacionVariableDiaria::where('cedula', $cedula)
            ->whereDate('fecha', '>=', $inicioMes)
            ->whereDate('fecha', '<=', $hoy)
            ->selectRaw('COUNT(*) as dias_trabajados, SUM(valor_var) as total_ganado')
            ->first();

        return [
            'dias_trabajados' => (int) ($fila->dias_trabajados ?? 0),
            'total_ganado' => round((float) ($fila->total_ganado ?? 0), 2),
            'tendencia' => $this->compensacionDiariaTendencia($colaborador),
        ];
    }

    /**
     * Ganancia diaria de los últimos 30 días, con los días sin registro
     * rellenados en 0 para que la gráfica de área muestre una serie
     * continua (mismo patrón de relleno que
     * GeovictoriaAsistenciaController::tendenciaDiaria()).
     */
    private function compensacionDiariaTendencia(Colaborador $colaborador): array
    {
        $cedula = $this->cedulaDe($colaborador);
        $desde = now()->subDays(29)->startOfDay();
        $hasta = now();

        $porDia = CompensacionVariableDiaria::where('cedula', $cedula)
            ->whereDate('fecha', '>=', $desde->toDateString())
            ->whereDate('fecha', '<=', $hasta->toDateString())
            ->get(['fecha', 'valor_var'])
            ->keyBy(fn (CompensacionVariableDiaria $r) => $r->fecha->format('Y-m-d'));

        $dias = [];
        for ($fecha = $desde->copy(); $fecha->lte($hasta); $fecha->addDay()) {
            $clave = $fecha->format('Y-m-d');
            $dias[] = [
                'fecha' => $clave,
                'valor' => round((float) ($porDia->get($clave)?->valor_var ?? 0), 2),
            ];
        }

        return $dias;
    }

    private function compensacionVariable(Colaborador $colaborador): array
    {
        $cedula = $this->cedulaDe($colaborador);
        $anio = (int) now()->year;

        $total = CompensacionVariable::where('identificador', $cedula)
            ->where('anio', $anio)
            ->sum('pago_variable_dt');

        return [
            'total_pago_variable' => round((float) $total, 2),
            'anio' => $anio,
            'historial_mensual' => $this->compensacionVariableHistorialMensual($colaborador, $anio),
        ];
    }

    private function compensacionVariableHistorialMensual(Colaborador $colaborador, int $anio): array
    {
        $cedula = $this->cedulaDe($colaborador);
        $mesesEsFlip = array_flip(array_map('strtolower', self::MESES_ES));

        $filas = CompensacionVariable::where('identificador', $cedula)
            ->where('anio', $anio)
            ->select('mes')
            ->selectRaw('SUM(pago_variable_dt) as total')
            ->groupBy('mes')
            ->get()
            ->keyBy(fn ($fila) => $mesesEsFlip[strtolower(trim($fila->mes ?? ''))] ?? 0);

        return collect(range(1, 12))->map(fn (int $mesNum) => [
            'mes_num' => $mesNum,
            'mes_label' => mb_substr(self::MESES_ES[$mesNum], 0, 3),
            'total' => round((float) ($filas->get($mesNum)?->total ?? 0), 2),
        ])->values()->all();
    }

    private function planPremiacion(Colaborador $colaborador): array
    {
        $metaBase = 32;
        $hoy = now();

        $aciRealizadas = Aci::whereMonth('fecha_incidente', $hoy->month)
            ->whereYear('fecha_incidente', $hoy->year)
            ->where('colaborador_id', $colaborador->id)
            ->count();

        return [
            'aci_realizadas' => $aciRealizadas,
            'meta' => $metaBase,
            'porcentaje' => min(100, (int) round($aciRealizadas / $metaBase * 100)),
        ];
    }

    private function planPadrinos(Colaborador $colaborador): ?array
    {
        $fechaIngreso = $colaborador->fecha_ingreso_empresa;
        if (! $fechaIngreso) {
            return null;
        }

        $hoy = Carbon::today();
        $etapasConfig = ['7_dias' => 8, '30_dias' => 30, '90_dias' => 90];
        $etapasLabels = ['7_dias' => '7 días', '30_dias' => '30 días', '90_dias' => '90 días'];

        $etapasRealizadas = $colaborador->pruebasPeriodo()
            ->where('realizada', true)
            ->pluck('etapa');

        $etapas = [];
        foreach ($etapasConfig as $etapaKey => $dias) {
            $aplica = $hoy->greaterThanOrEqualTo($fechaIngreso->copy()->addDays($dias));

            $etapas[] = [
                'etapa' => $etapaKey,
                'label' => $etapasLabels[$etapaKey],
                'estado' => $etapasRealizadas->contains($etapaKey) ? 'realizada' : ($aplica ? 'pendiente' : 'no_aplica'),
            ];
        }

        return ['etapas' => $etapas];
    }

    private function geovictoria(Colaborador $colaborador): array
    {
        $cedula = $this->cedulaDe($colaborador);

        $base = fn () => GeovictoriaAsistencia::query()
            ->where('identificador', $cedula)
            ->where(fn ($q) => $q->where('exceso_jornada', true)->orWhere('descanso_no_efectivo', true));

        return [
            'recientes_30_dias' => $base()->whereDate('fecha', '>=', now()->subDays(30)->toDateString())->count(),
            'tendencia' => $this->geovictoriaTendencia($colaborador),
        ];
    }

    private function geovictoriaTendencia(Colaborador $colaborador): array
    {
        $cedula = $this->cedulaDe($colaborador);
        $desde = now()->subDays(29)->startOfDay();
        $hasta = now();

        $porDia = GeovictoriaAsistencia::where('identificador', $cedula)
            ->whereDate('fecha', '>=', $desde->toDateString())
            ->whereDate('fecha', '<=', $hasta->toDateString())
            ->get(['fecha', 'exceso_jornada', 'descanso_no_efectivo'])
            ->keyBy(fn (GeovictoriaAsistencia $r) => $r->fecha->format('Y-m-d'));

        $dias = [];
        for ($fecha = $desde->copy(); $fecha->lte($hasta); $fecha->addDay()) {
            $clave = $fecha->format('Y-m-d');
            $registro = $porDia->get($clave);
            $dias[] = [
                'fecha' => $clave,
                'exceso_jornada' => $registro?->exceso_jornada ? 1 : 0,
                'descanso_no_efectivo' => $registro?->descanso_no_efectivo ? 1 : 0,
            ];
        }

        return $dias;
    }

    private function capacitaciones(int $userId): array
    {
        $totalPublicado = CapacitacionMaterial::where('estado', 'publicado')->count();
        $pendientes = CapacitacionMaterial::where('estado', 'publicado')
            ->whereDoesntHave('revisiones', fn ($q) => $q->where('user_id', $userId))
            ->count();

        return [
            'pendientes' => $pendientes,
            'total_publicado' => $totalPublicado,
            'porcentaje' => $totalPublicado > 0 ? (int) round(($totalPublicado - $pendientes) / $totalPublicado * 100) : 100,
        ];
    }

    private function condicionSalud(Colaborador $colaborador): array
    {
        $ultima = $this->evaluacionCalculator->ultimoRegistro($colaborador);

        $historial = $colaborador->condicionesSalud()
            ->latest('fecha_hora')
            ->limit(5)
            ->get(['estado', 'fecha_hora']);

        return [
            'estado' => $ultima?->estado,
            'fecha_hora' => $ultima?->fecha_hora,
            'historial' => $historial,
        ];
    }

    private function encuestaMorbilidadPendiente(Colaborador $colaborador): bool
    {
        return $colaborador->encuestasMorbilidad()
            ->where('estado', EncuestaMorbilidad::ESTADO_BORRADOR)
            ->exists();
    }

    private function indicadoresReparto(Colaborador $colaborador): array
    {
        $cedula = $this->cedulaDe($colaborador);
        $inicio = now()->startOfMonth()->toDateString();
        $hoy = now()->toDateString();

        $jornadas = EventosTripulacion::where('documento', $cedula)
            ->whereBetween('fecha', [$inicio, $hoy])
            ->count();

        return [
            'jornadas_mes' => $jornadas,
        ];
    }
}
