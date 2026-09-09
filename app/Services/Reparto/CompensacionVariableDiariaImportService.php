<?php

namespace App\Services\Reparto;

use App\Models\Reparto\CompensacionVariableDiaria;
use App\Models\Reparto\EventosTripulacion;
use App\Models\Seguridad\Colaborador;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Calcula la Compensación Variable Diaria directamente desde
 * la tabla eventos_tripulacion — sin necesidad de subir un Excel.
 *
 * El campo rechazos en eventos_tripulacion es un porcentaje
 * (ej: 2 = 2%) que coincide con las metas de la CVD (meta1 < 2.1%, meta2 < 2.6%).
 *
 * Reglas de cálculo:
 *   valor_x_dia  = 100,000 / 26                      → $3,846.15
 *   cal_rechazos   = 0.8  si rechazos < 2.6%
 *   cal_rechazos_2 = 0.2  si rechazos <= 2.1%
 *   valor_var    = (cal_rechazos + cal_rechazos_2) × valor_x_dia
 *   valor_perdido = valor_x_dia − valor_var
 *   % variable   = (valor_var / valor_x_dia) × 100
 */
class CompensacionVariableDiariaImportService
{
    private const VALOR_DIA  = 3846.15;   // 100 000 / 26
    private const META_1_PCT = 2.1;       // rechazos <= 2.1% → 80%
    private const META_2_PCT = 2.6;       // rechazos <  2.6% → 20% adicional

    private const MESES_ES = [
        1 => 'Enero',    2 => 'Febrero',   3 => 'Marzo',
        4 => 'Abril',    5 => 'Mayo',      6 => 'Junio',
        7 => 'Julio',    8 => 'Agosto',    9 => 'Septiembre',
        10 => 'Octubre', 11 => 'Noviembre',12 => 'Diciembre',
    ];

    /**
     * Sincroniza la tabla compensaciones_variables_diarias desde eventos_tripulacion.
     * Calcula el mes/año indicado. Si no se envía parámetro, usa el mes actual.
     *
     * @param int|null $anio  Año a calcular (ej: 2026). Si null → año actual.
     * @param int|null $mes   Mes a calcular (1-12). Si null → mes actual.
     */
    public function calcularDesdeEventos(?int $anio = null, ?int $mes = null): array
    {
        set_time_limit(600);
        ini_set('memory_limit', '512M');

        // Validar y normalizar mes/año. Si faltan, usar el momento actual.
        $hoy = now();
        $anio = $anio > 0 ? $anio : (int) $hoy->format('Y');
        $mes  = ($mes >= 1 && $mes <= 12) ? $mes : (int) $hoy->format('n');

        $fechaDesde = \Carbon\Carbon::create($anio, $mes, 1)->startOfMonth()->format('Y-m-d');
        $fechaHasta = \Carbon\Carbon::create($anio, $mes, 1)->endOfMonth()->format('Y-m-d');
        $mesNombre  = self::MESES_ES[$mes] ?? "Mes {$mes}";
        $periodo    = "{$mesNombre} {$anio}";

        // ── Lookup colaboradores (una sola query) ──────────────────────────────
        $colaboradores = Colaborador::whereNotNull('cedula')
            ->where('cedula', '!=', '')
            ->get(['cedula', 'nombres', 'apellidos', 'cargo'])
            ->mapWithKeys(fn($c) => [
                trim((string) $c->cedula) => [
                    'nombre' => trim(trim((string)($c->nombres ?? '')) . ' ' . trim((string)($c->apellidos ?? ''))),
                    'cargo'  => trim((string) ($c->cargo ?? '')),
                ]
            ])
            ->toArray();

        // ── Query base sobre eventos_tripulacion ───────────────────────────────
        $query = EventosTripulacion::whereNotNull('documento')
            ->where('documento', '!=', '')
            ->whereNotNull('fecha')
            ->whereNotNull('rechazos')
            ->where('fecha', '>=', $fechaDesde)
            ->where('fecha', '<=', $fechaHasta);

        $totalProcesados  = 0;
        $registrosCreados = 0;
        $registrosActualizados = 0;
        $now = now()->toDateTimeString();

        // ── Procesar en lotes ──────────────────────────────────────────────────
        $query->orderBy('fecha')->chunk(500, function ($eventos) use (
            $colaboradores, &$totalProcesados, &$registrosCreados, &$registrosActualizados, $now
        ) {
            $batch = [];

            foreach ($eventos as $evento) {
                $cedula = trim((string) ($evento->documento ?? ''));
                $fecha  = $evento->fecha instanceof \DateTimeInterface
                    ? $evento->fecha->format('Y-m-d')
                    : (string) $evento->fecha;

                // rechazos en eventos_tripulacion es decimal = porcentaje directo (ej: 3.50 = 3.50%)
                $rechazosPct = (float) ($evento->rechazos ?? 0);

                // Año y mes desde la fecha
                $anioVal = (int) date('Y', strtotime($fecha));
                $mesNum  = (int) date('n', strtotime($fecha));
                $mesVal  = self::MESES_ES[$mesNum] ?? null;

                // Nombre y cargo desde la BD de colaboradores
                $nombreCompleto = $colaboradores[$cedula]['nombre'] ?? $evento->nombre ?? null;
                $cargo          = $colaboradores[$cedula]['cargo']  ?? $evento->cargo  ?? null;

                // ── Cálculos ──────────────────────────────────────────────────
                $valorXDia    = self::VALOR_DIA;
                $calRechazos  = $rechazosPct < self::META_2_PCT ? 0.8 : 0.0;
                $calRechazos2 = $rechazosPct <= self::META_1_PCT ? 0.2 : 0.0;
                $valorVar     = round(($calRechazos + $calRechazos2) * $valorXDia, 2);
                $valorPerdido = round($valorXDia - $valorVar, 2);
                $pctVariable  = $valorXDia > 0 ? round(($valorVar / $valorXDia) * 100, 1) . '%' : '0%';
                $pctNoCum     = $valorXDia > 0 ? round(($valorPerdido / $valorXDia) * 100, 1) . '%' : '0%';

                $batch[] = [
                    'cedula'                     => $cedula,
                    'fecha'                      => $fecha,
                    'anio'                       => $anioVal,
                    'mes'                        => $mesVal,
                    'placa'                      => $evento->placa,
                    'transporte'                 => $evento->doc_transporte,
                    'nombre_completo'            => $nombreCompleto,
                    'cargo'                      => $cargo,
                    'rechazos'                   => $rechazosPct,
                    'cal_rechazos'               => $calRechazos,
                    'cal_rechazos_2'             => $calRechazos2,
                    'valor_x_dia'                => $valorXDia,
                    'valor_var'                  => $valorVar,
                    'valor_perdido'              => $valorPerdido,
                    'porcentaje_variable'        => $pctVariable,
                    'porcentaje_variable_no_cum' => $pctNoCum,
                    'meta_1'                     => self::META_1_PCT,
                    'meta_2'                     => self::META_2_PCT,
                    'created_at'                 => $now,
                    'updated_at'                 => $now,
                ];
            }

            if (!empty($batch)) {
                [$ins, $upd] = $this->flushBatch($batch);
                $registrosCreados      += $ins;
                $registrosActualizados += $upd;
                $totalProcesados       += count($batch);
            }
        });

        Log::info("CVD: Sincronización completada para {$periodo}. Creados: {$registrosCreados}, Actualizados: {$registrosActualizados}");

        return [
            'total_procesados'      => $totalProcesados,
            'registros_creados'     => $registrosCreados,
            'registros_actualizados'=> $registrosActualizados,
            'periodo'               => $periodo,
            'anio'                  => $anio,
            'mes'                   => $mes,
            'fecha_desde'           => $fechaDesde,
            'fecha_hasta'           => $fechaHasta,
        ];
    }

    // ── Upsert por (cedula, fecha) ────────────────────────────────────────────

    private function flushBatch(array $batch): array
    {
        $antes = CompensacionVariableDiaria::count();

        CompensacionVariableDiaria::upsert(
            $batch,
            ['cedula', 'fecha'],
            [
                'anio', 'mes', 'placa', 'transporte',
                'nombre_completo', 'cargo', 'rechazos',
                'cal_rechazos', 'cal_rechazos_2',
                'valor_x_dia', 'valor_var', 'valor_perdido',
                'porcentaje_variable', 'porcentaje_variable_no_cum',
                'meta_1', 'meta_2', 'updated_at',
            ]
        );

        $despues      = CompensacionVariableDiaria::count();
        $insertados   = max(0, $despues - $antes);
        $actualizados = max(0, count($batch) - $insertados);

        return [$insertados, $actualizados];
    }
}
