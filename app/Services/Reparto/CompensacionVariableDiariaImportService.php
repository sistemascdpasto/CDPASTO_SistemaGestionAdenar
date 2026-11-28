<?php

namespace App\Services\Reparto;

use App\Models\Gente\Cargo;
use App\Models\Reparto\CompensacionVariableDiaria;
use App\Models\Reparto\EventosTripulacion;
use App\Models\Seguridad\Colaborador;
use Illuminate\Support\Facades\Log;

/**
 * Calcula la Compensación Variable Diaria directamente desde
 * la tabla eventos_tripulacion — sin necesidad de subir un Excel.
 *
 * El campo rechazos en eventos_tripulacion es un porcentaje
 * (ej: 2 = 2%) que se evalúa contra las metas de la CVD.
 *
 * El valor mensual por cargo se configura en la tabla `cargos`
 * (campo valor_cvd) desde Configuración de colaboradores.
 *
 * Reglas de cálculo:
 *   valor_x_dia = cargos.valor_cvd / 26
 *
 *   Porcentaje de rechazos        → % ganado
 *     < 2.0%                      → 100%
 *     >= 2.0% y < 2.4%            → 80%
 *     >= 2.4%                     → 0%
 *
 *   valor_var     = valor_x_dia × porcentaje_ganado
 *   valor_perdido = valor_x_dia − valor_var
 *   % variable   = (valor_var / valor_x_dia) × 100
 */
class CompensacionVariableDiariaImportService
{
    private const META_1_PCT = 2.0;   // rechazos < 2.0% → gana el 100%
    private const META_2_PCT = 2.4;   // rechazos < 2.4% → gana el 80%

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

        // ── Lookup colaboradores (una sola query, solo nombre) ────────────────
        $colaboradores = Colaborador::whereNotNull('cedula')
            ->where('cedula', '!=', '')
            ->get(['cedula', 'nombres', 'apellidos'])
            ->mapWithKeys(fn($c) => [
                trim((string) $c->cedula) => [
                    'nombre' => trim(trim((string)($c->nombres ?? '')) . ' ' . trim((string)($c->apellidos ?? ''))),
                ]
            ])
            ->toArray();

        // ── Lookup valor CVD por cargo (una sola query) ───────────────────────
        // Mapa: CARGO_EN_MAYÚSCULAS → valor_cvd (int|null)
        // El cargo de eventos_tripulacion viene de la planeación y puede llegar
        // como "CONDUCTOR DE REPARTO" mientras que la tabla cargos puede tener
        // "Conductor" u otras variantes. Se normaliza a mayúsculas en ambos lados.
        $valorCvdPorCargo = Cargo::whereNotNull('valor_cvd')
            ->pluck('valor_cvd', 'nombre')
            ->mapWithKeys(fn($valor, $nombre) => [
                mb_strtoupper(trim((string) $nombre), 'UTF-8') => (int) $valor,
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
            $colaboradores, $valorCvdPorCargo, &$totalProcesados, &$registrosCreados, &$registrosActualizados, $now
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

                // Nombre: tabla colaboradores (nombre oficial) > evento
                $nombreCompleto = $colaboradores[$cedula]['nombre'] ?? $evento->nombre ?? null;

                // Cargo: siempre viene de la planeación (guardado en eventos_tripulacion).
                // El Excel nunca trae cargo y nunca vendrá vacío.
                $cargo = (string) $evento->cargo;

                // ── Valor diario según cargo ───────────────────────────────────
                // Se lee de la tabla cargos (campo valor_cvd). Ambos lados ya
                // están en MAYÚSCULAS: el cargo del evento (normalizado al
                // guardar en eventos_tripulacion) y las claves de $valorCvdPorCargo.
                // Se intenta coincidencia exacta primero; si no hay, se acepta
                // que un lado contenga al otro (ej. "CONDUCTOR" ⊂ "CONDUCTOR DE REPARTO").
                $cargoUpper = mb_strtoupper(trim($cargo), 'UTF-8');
                $valorMensual = $valorCvdPorCargo[$cargoUpper] ?? null;
                if ($valorMensual === null) {
                    foreach ($valorCvdPorCargo as $claveCargo => $valorCvd) {
                        if (str_contains($cargoUpper, $claveCargo) || str_contains($claveCargo, $cargoUpper)) {
                            $valorMensual = $valorCvd;
                            break;
                        }
                    }
                }
                $valorXDia = $valorMensual !== null && $valorMensual > 0
                    ? round($valorMensual / 26, 2)
                    : 0.0;

                if ($valorXDia <= 0) {
                    Log::warning("CVD: cargo sin valor_cvd configurado", [
                        'cedula'         => $cedula,
                        'fecha'          => $fecha,
                        'cargo'          => $cargo,
                        'cargos_config'  => array_keys($valorCvdPorCargo),
                    ]);
                }

                // ── Cálculo según porcentaje de rechazos ──────────────────────
                //   < 2.0%  → 100% (porcentaje_ganado = 1.0)
                //   < 2.4%  →  80% (porcentaje_ganado = 0.8)
                //   >= 2.4% →   0% (porcentaje_ganado = 0.0)
                if ($rechazosPct < self::META_1_PCT) {
                    $porcentajeGanado = 1.0;
                } elseif ($rechazosPct < self::META_2_PCT) {
                    $porcentajeGanado = 0.8;
                } else {
                    $porcentajeGanado = 0.0;
                }

                $valorVar     = round($valorXDia * $porcentajeGanado, 2);
                $valorPerdido = round($valorXDia - $valorVar, 2);
                $pctVariable  = $valorXDia > 0 ? round(($valorVar / $valorXDia) * 100, 1) . '%' : '0%';
                $pctNoCum     = $valorXDia > 0 ? round(($valorPerdido / $valorXDia) * 100, 1) . '%' : '0%';

                // meta_1 = valor que ganaría si rechazos < 2.0% (100% del valor diario)
                // meta_2 = valor que ganaría si rechazos < 2.4% (80% del valor diario)
                $meta1Valor = round($valorXDia * 1.0, 2);
                $meta2Valor = round($valorXDia * 0.8, 2);

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
                    'cal_rechazos'               => $porcentajeGanado,
                    'cal_rechazos_2'             => 0.0,
                    'valor_x_dia'                => $valorXDia,
                    'valor_var'                  => $valorVar,
                    'valor_perdido'              => $valorPerdido,
                    'porcentaje_variable'        => $pctVariable,
                    'porcentaje_variable_no_cum' => $pctNoCum,
                    'meta_1'                     => $meta1Valor,
                    'meta_2'                     => $meta2Valor,
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
