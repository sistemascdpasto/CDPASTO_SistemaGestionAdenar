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
            'capacitaciones_pendientes' => $this->capacitacionesPendientes($userId),
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
        $inicio = now()->startOfMonth()->toDateString();
        $hoy = now()->toDateString();

        $fila = CompensacionVariableDiaria::where('cedula', $cedula)
            ->whereDate('fecha', '>=', $inicio)
            ->whereDate('fecha', '<=', $hoy)
            ->selectRaw('COUNT(*) as dias_trabajados, SUM(valor_var) as total_ganado')
            ->first();

        return [
            'dias_trabajados' => (int) ($fila->dias_trabajados ?? 0),
            'total_ganado' => round((float) ($fila->total_ganado ?? 0), 2),
        ];
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
        ];
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

        foreach ($etapasConfig as $etapaKey => $dias) {
            $fechaPrueba = $fechaIngreso->copy()->addDays($dias);
            if ($hoy->lessThan($fechaPrueba)) {
                continue;
            }

            $realizada = $colaborador->pruebasPeriodo()
                ->where('etapa', $etapaKey)
                ->where('realizada', true)
                ->exists();

            if (! $realizada) {
                return ['etapa_pendiente' => $etapasLabels[$etapaKey]];
            }
        }

        return ['etapa_pendiente' => null];
    }

    private function geovictoria(Colaborador $colaborador): array
    {
        $cedula = $this->cedulaDe($colaborador);

        $base = fn () => GeovictoriaAsistencia::query()
            ->where('identificador', $cedula)
            ->where(fn ($q) => $q->where('exceso_jornada', true)->orWhere('descanso_no_efectivo', true));

        return [
            'recientes_30_dias' => $base()->whereDate('fecha', '>=', now()->subDays(30)->toDateString())->count(),
        ];
    }

    private function capacitacionesPendientes(int $userId): int
    {
        return CapacitacionMaterial::where('estado', 'publicado')
            ->whereDoesntHave('revisiones', fn ($q) => $q->where('user_id', $userId))
            ->count();
    }

    private function condicionSalud(Colaborador $colaborador): array
    {
        $ultima = $this->evaluacionCalculator->ultimoRegistro($colaborador);

        return [
            'estado' => $ultima?->estado,
            'fecha_hora' => $ultima?->fecha_hora,
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
