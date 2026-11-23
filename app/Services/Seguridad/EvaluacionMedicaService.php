<?php

namespace App\Services\Seguridad;

use App\Models\Seguridad\CargoExamen;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\EvaluacionMedica;
use App\Models\Seguridad\LogGeneracionExamenes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class EvaluacionMedicaService
{
    /**
     * Crea la evaluación y genera un `ExamenEvaluacion` por cada fila de la
     * matriz Cargo→Examen que aplique al cargo actual del colaborador y al
     * tipo de evaluación (HU-031/HU-034/HU-036). Si no hay matriz definida
     * para ese cargo, la evaluación queda creada sin exámenes — no es un
     * error, solo significa que SST aún no cargó la matriz para ese cargo;
     * en cualquier caso queda trazabilidad en `log_generacion_examenes`.
     *
     * `$fechaLimite` es el vencimiento propio de esta fila (HU-034/036): para
     * un Ingreso siempre es null (nunca vence); para un Periódico es el
     * `proximo_examen_fecha` que calculó la evaluación anterior terminada.
     */
    public function crear(
        Colaborador $colaborador,
        string $tipoEvaluacion,
        ?Carbon $fechaLimite = null,
        ?Carbon $fechaEntradaBandeja = null,
    ): EvaluacionMedica {
        return DB::transaction(function () use ($colaborador, $tipoEvaluacion, $fechaLimite, $fechaEntradaBandeja) {
            $numeroPeriodo = $tipoEvaluacion === 'periodico' ? $this->siguienteNumeroPeriodo($colaborador) : null;

            $evaluacion = EvaluacionMedica::create([
                'colaborador_id'        => $colaborador->id,
                'tipo_evaluacion'       => $tipoEvaluacion,
                'numero_periodo'        => $numeroPeriodo,
                'fecha_evaluacion'      => now()->toDateString(),
                'fecha_limite'          => $fechaLimite?->toDateString(),
                'fecha_entrada_bandeja' => $fechaEntradaBandeja?->toDateString(),
                'estado'                => 'sin_iniciar',
            ]);

            $matriz = CargoExamen::where('cargo', $colaborador->cargo)
                ->where('tipo_evaluacion', $tipoEvaluacion)
                ->where('activo', true)
                ->get();

            foreach ($matriz as $fila) {
                $evaluacion->examenes()->create([
                    'examen_id'   => $fila->examen_id,
                    'obligatorio' => $fila->obligatorio,
                    'origen'      => 'matriz',
                    'estado'      => 'pendiente',
                ]);
            }

            $this->registrarLogGeneracion($colaborador, $tipoEvaluacion, $matriz->count());

            $this->heredarRecomendacionesActivas($colaborador, $evaluacion);

            return $evaluacion;
        });
    }

    /**
     * Copia las recomendaciones activas (vigentes) de la evaluación previa
     * más reciente del colaborador hacia la nueva evaluación para preservar
     * su historial y continuidad.
     */
    private function heredarRecomendacionesActivas(Colaborador $colaborador, EvaluacionMedica $nuevaEvaluacion): void
    {
        $evaluacionPrevia = EvaluacionMedica::where('colaborador_id', $colaborador->id)
            ->where('id', '!=', $nuevaEvaluacion->id)
            ->whereHas('recomendaciones', fn ($q) => $q->where('activa', true))
            ->latest('id')
            ->first();

        if (! $evaluacionPrevia) {
            return;
        }

        foreach ($evaluacionPrevia->recomendaciones()->where('activa', true)->get() as $rec) {
            $nuevaEvaluacion->recomendaciones()->firstOrCreate(
                ['recomendacion_id' => $rec->recomendacion_id],
                [
                    'observacion'    => $rec->observacion,
                    'activa'         => true,
                    'origen'         => 'heredada',
                    'fecha_registro' => now()->toDateString(),
                ]
            );
        }
    }

    private function siguienteNumeroPeriodo(Colaborador $colaborador): int
    {
        return 1 + (int) EvaluacionMedica::where('colaborador_id', $colaborador->id)
            ->where('tipo_evaluacion', 'periodico')
            ->max('numero_periodo');
    }

    private function registrarLogGeneracion(Colaborador $colaborador, string $tipoEvaluacion, int $examenesGenerados): void
    {
        LogGeneracionExamenes::create([
            'colaborador_id' => $colaborador->id,
            'fecha_evento' => now(),
            'resultado' => $examenesGenerados > 0 ? LogGeneracionExamenes::RESULTADO_OK : LogGeneracionExamenes::RESULTADO_SIN_MATRIZ,
            'detalle' => $examenesGenerados > 0
                ? "{$examenesGenerados} examen(es) generados desde la matriz para el cargo \"{$colaborador->cargo}\" ({$tipoEvaluacion})."
                : "Sin matriz definida para el cargo \"{$colaborador->cargo}\" y tipo \"{$tipoEvaluacion}\".",
        ]);
    }

    /**
     * Genera los ExamenEvaluacion desde la matriz Cargo→Examen para la
     * evaluación dada, usando exactamente la misma lógica que crear().
     * Si ya existen exámenes de la misma matriz, los omite (no duplica).
     * Útil para la acción "Iniciar evaluación" desde show.tsx.
     *
     * @return int Número de exámenes nuevos generados
     */
    public function generarExamenesDesdeMatriz(EvaluacionMedica $evaluacion): int
    {
        $evaluacion->load('colaborador', 'examenes');

        $matriz = CargoExamen::where('cargo', $evaluacion->colaborador->cargo)
            ->where('tipo_evaluacion', $evaluacion->tipo_evaluacion)
            ->where('activo', true)
            ->get();

        $examenesExistentes = $evaluacion->examenes->pluck('examen_id')->toArray();
        $generados = 0;

        foreach ($matriz as $fila) {
            if (in_array($fila->examen_id, $examenesExistentes, true)) {
                continue; // no duplicar
            }

            $evaluacion->examenes()->create([
                'examen_id'   => $fila->examen_id,
                'obligatorio' => $fila->obligatorio,
                'origen'      => 'matriz',
                'estado'      => 'pendiente',
            ]);

            $generados++;
        }

        return $generados;
    }

    /**
     * Inicia una evaluación médica: genera los exámenes desde la matriz
     * del cargo (sin duplicar los existentes) y recalcula el estado.
     * Se invoca desde el botón "Iniciar evaluación" en show.tsx cuando
     * la evaluación está en estado sin_iniciar y no tiene exámenes.
     */
    public function iniciar(EvaluacionMedica $evaluacion): void
    {
        $this->generarExamenesDesdeMatriz($evaluacion);
        $this->recalcularEstado($evaluacion->fresh());
    }

    /**
     * Recalcula el estado de la evaluación (HU-059/060) y, si queda
     * Terminada, el próximo examen (HU-057/058). Si es Ingreso o Periódico y
     * queda Terminada por primera vez, además crea automáticamente el
     * siguiente Periódico (HU-034/036) — nunca duplica si ya existe. Se
     * llama después de cualquier cambio a sus exámenes (programar, ejecutar,
     * agregar adicional) o al concepto de aptitud.
     */
    public function recalcularEstado(EvaluacionMedica $evaluacion): void
    {
        $evaluacion->load('examenes');
        $obligatorios = $evaluacion->examenes->where('obligatorio', true);

        if ($obligatorios->isNotEmpty() && $obligatorios->every(fn ($e) => $e->estado === 'realizado')) {
            $datos = ['estado' => 'terminada'];
            // Fecha REAL de ejecución de los exámenes (la más reciente de los obligatorios)
            $fechaMasReciente = $obligatorios->pluck('fecha_ejecucion')->filter()->max();

            if (in_array($evaluacion->tipo_evaluacion, ['ingreso', 'periodico'], true) && $fechaMasReciente) {
                $meses = (int) config('gente.examenes_medicos.periodicidad_meses');
                // Próximo objetivo anual: Fecha REAL de ejecución + 1 año (12 meses)
                $proximo = Carbon::parse($fechaMasReciente)->addMonths($meses);
                $datos['proximo_examen_fecha'] = $proximo->toDateString();
                // Ventana de entrada a bandeja: 30 días antes del próximo objetivo
                $datos['fecha_entrada_bandeja'] = $proximo->copy()->subDays(30)->toDateString();
            }

            $evaluacion->update($datos);

            if (isset($datos['proximo_examen_fecha'])) {
                $this->sincronizarOSiguientePeriodico($evaluacion, Carbon::parse($datos['proximo_examen_fecha']));
            }

            return;
        }

        $fechaLimite = $evaluacion->fecha_limite ?? $this->fechaLimiteHeredada($evaluacion);

        if ($fechaLimite && Carbon::today()->gt($fechaLimite)) {
            $evaluacion->update(['estado' => 'demorada']);

            return;
        }

        $enProceso = $obligatorios->contains(fn ($e) => $e->estado !== 'pendiente');
        $evaluacion->update(['estado' => $enProceso ? 'en_proceso' : 'sin_iniciar']);
    }

    /**
     * Respaldo para evaluaciones Periódicas creadas antes de que
     * `fecha_limite` quedara persistida en la propia fila (o creadas
     * directamente vía `crear()` sin ese dato) — mira hacia atrás la
     * evaluación Terminada más reciente del mismo colaborador.
     */
    private function fechaLimiteHeredada(EvaluacionMedica $evaluacion): ?Carbon
    {
        if ($evaluacion->tipo_evaluacion !== 'periodico') {
            return null;
        }

        $anterior = EvaluacionMedica::where('colaborador_id', $evaluacion->colaborador_id)
            ->where('id', '!=', $evaluacion->id)
            ->where('estado', 'terminada')
            ->whereNotNull('proximo_examen_fecha')
            ->latest('fecha_evaluacion')
            ->first();

        return $anterior?->proximo_examen_fecha;
    }

    /**
     * Sincroniza o crea el siguiente examen periódico cuando la evaluación
     * previa (Ingreso o Periódico anterior) finaliza. Su fecha límite objetivo
     * es la fecha real de ejecución + 1 año, y entra a bandeja 30 días antes.
     */
    private function sincronizarOSiguientePeriodico(EvaluacionMedica $anterior, Carbon $proximaFechaObjetivo): void
    {
        $numeroSiguiente = $anterior->tipo_evaluacion === 'ingreso' ? 1 : ((int) $anterior->numero_periodo) + 1;
        $fechaEntradaBandeja = $proximaFechaObjetivo->copy()->subDays(30);

        $siguiente = EvaluacionMedica::where('colaborador_id', $anterior->colaborador_id)
            ->where('tipo_evaluacion', 'periodico')
            ->where('numero_periodo', $numeroSiguiente)
            ->first();

        if ($siguiente) {
            if ($siguiente->estado !== 'terminada') {
                $siguiente->update([
                    'fecha_limite'          => $proximaFechaObjetivo->toDateString(),
                    'fecha_entrada_bandeja' => $fechaEntradaBandeja->toDateString(),
                ]);
            }

            return;
        }

        $this->crear($anterior->colaborador, 'periodico', $proximaFechaObjetivo, $fechaEntradaBandeja);
    }

    /**
     * Egreso (HU-037/038) es un flujo aparte: sin matriz de exámenes ni
     * periodicidad, solo el registro del examen de retiro del colaborador.
     * `fecha_limite`/`fecha_programacion` se derivan directamente de la
     * fecha fin del contrato (ver `sincronizarEgresoPorContrato`).
     */
    public function crearEgreso(
        Colaborador $colaborador,
        ?Carbon $fechaLimite = null,
        ?Carbon $fechaEntradaBandeja = null,
    ): EvaluacionMedica {
        return $this->crear($colaborador, 'egreso', $fechaLimite, $fechaEntradaBandeja);
    }

    /**
     * Pendiente/Programado/Ejecutado o Sin Iniciar/En Proceso/Terminada
     */
    public function recalcularEstadoEgreso(EvaluacionMedica $evaluacion): void
    {
        $this->recalcularEstado($evaluacion);
    }

    /**
     * HU-038: el colaborador rechaza el examen de egreso. No puede coexistir
     * con un cierre "por examen" — `tipo_cierre` es una u otra condición.
     */
    public function rechazarEgreso(EvaluacionMedica $evaluacion, string $observacion): void
    {
        $evaluacion->update([
            'tipo_cierre' => 'rechazado',
            'fecha_rechazo' => now()->toDateString(),
            'observacion_rechazo' => $observacion,
            'estado' => 'terminada',
        ]);
    }

    /**
     * HU-030/035/041: cantidades requerida/ejecutada/pendiente y la alerta
     * de vencimiento, calculadas en tiempo de consulta — nunca se persisten
     * como estado (regla de negocio).
     *
     * @return array{cantidad_requerida: int, cantidad_ejecutada: int, cantidad_pendiente: int, fecha_referencia: ?string, dias_restantes: ?int, alerta: ?string}
     */
    public function indicadoresBandeja(EvaluacionMedica $evaluacion): array
    {
        $completada = in_array($evaluacion->estado, ['terminada', 'ejecutado'], true);

        $requerida = (int) ($evaluacion->cantidad_requerida_examenes ?? $evaluacion->examenes()->count());
        $ejecutada = (int) ($evaluacion->cantidad_ejecutada_examenes ?? $evaluacion->examenes()->where('estado', 'realizado')->count());

        // Fecha de referencia para mostrar en la columna "Próximo examen":
        // - activo  → fecha_limite (vencimiento del examen en curso)
        // - terminado → proximo_examen_fecha (cuándo debe realizarse el siguiente)
        $fechaReferencia = $completada
            ? $evaluacion->proximo_examen_fecha?->toDateString()
            : $evaluacion->fecha_limite?->toDateString();

        $diasRestantes = null;
        $alerta = null;

        if ($fechaReferencia) {
            $limite = Carbon::parse($fechaReferencia)->startOfDay();
            $diasRestantes = (int) round(($limite->timestamp - Carbon::today()->timestamp) / 86400);
            $alerta = match (true) {
                $diasRestantes < 0   => 'vencido',
                $diasRestantes <= 30 => 'proximo_a_vencer',
                default              => null,
            };
        }

        return [
            'cantidad_requerida' => $requerida,
            'cantidad_ejecutada' => $ejecutada,
            'cantidad_pendiente' => max(0, $requerida - $ejecutada),
            'fecha_referencia'   => $fechaReferencia,
            'dias_restantes'     => $diasRestantes,
            'alerta'             => $alerta,
        ];
    }

    /**
     * Sincroniza la evaluación de Egreso del colaborador con su
     * fecha_retiro_empresa. La fecha límite de ejecución será fecha_retiro_empresa
     * y su fecha de entrada a bandeja será 30 días antes de su ejecución.
     */
    public function sincronizarEgresoPorRetiro(Colaborador $colaborador, Carbon|string $fechaRetiro): EvaluacionMedica
    {
        $fechaRetiroCarbon = is_string($fechaRetiro) ? Carbon::parse($fechaRetiro) : $fechaRetiro;
        $fechaEntradaBandeja = $fechaRetiroCarbon->copy()->subDays(30);

        $evaluacion = EvaluacionMedica::where('colaborador_id', $colaborador->id)
            ->where('tipo_evaluacion', 'egreso')
            ->latest('id')
            ->first();

        if (! $evaluacion) {
            return $this->crear($colaborador, 'egreso', $fechaRetiroCarbon, $fechaEntradaBandeja);
        }

        if ($evaluacion->estado !== 'terminada') {
            $evaluacion->update([
                'fecha_limite'          => $fechaRetiroCarbon->toDateString(),
                'fecha_entrada_bandeja' => $fechaEntradaBandeja->toDateString(),
            ]);
            $this->recalcularEstado($evaluacion);
        }

        return $evaluacion;
    }

    public function sincronizarEgresoPorContrato(Colaborador $colaborador, Carbon $fechaFin): void
    {
        $this->sincronizarEgresoPorRetiro($colaborador, $fechaFin);
    }

    /**
     * Obtiene el historial médico completo del colaborador asignando a cada
     * evaluación su ciclo laboral correspondiente:
     * Ciclo N: Ingreso -> Periódico(s) -> Egreso
     * Muestra todos los registros reales existentes sin omitir información.
     */
    public function obtenerHistorialConCiclos(int $colaboradorId): \Illuminate\Support\Collection
    {
        $evaluaciones = EvaluacionMedica::query()
            ->where('colaborador_id', $colaboradorId)
            ->with([
                'conceptoAptitud:id,nombre',
                'examenes.examen:id,nombre',
            ])
            ->orderBy('fecha_evaluacion')
            ->orderBy('id')
            ->get();

        $cicloActual = 1;
        $cicloTieneEgreso = false;
        $cicloTieneIngreso = false;

        foreach ($evaluaciones as $eval) {
            // Si ya hubo un egreso en el ciclo previo o un nuevo ingreso después de tener uno, avanzamos de ciclo
            if ($cicloTieneEgreso || ($eval->tipo_evaluacion === 'ingreso' && $cicloTieneIngreso)) {
                $cicloActual++;
                $cicloTieneEgreso = false;
                $cicloTieneIngreso = false;
            }

            if ($eval->tipo_evaluacion === 'ingreso') {
                $cicloTieneIngreso = true;
            } elseif ($eval->tipo_evaluacion === 'egreso') {
                $cicloTieneEgreso = true;
            }

            $eval->setAttribute('ciclo_numero', $cicloActual);
        }

        // Retornamos ordenado de la más reciente a la más antigua para visualización
        return $evaluaciones->sortByDesc('id')->values();
    }
}
