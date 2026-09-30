<?php

namespace App\Services\Seguridad;

use App\Models\Reparto\Modulacion;
use App\Models\Reparto\ModulacionItem;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\PruebaAlcoholemia;
use App\Models\Seguridad\PruebaAlcoholemiaRequisito;
use Illuminate\Support\Facades\DB;

class CoberturaPlaneacionService
{
    /**
     * Resuelve y retorna los datos de planeación ( snapshot ) para un colaborador en una fecha dada.
     *
     * @return array{pertenece_planeacion: bool, modulacion_id: int|null, ruta_asignada: string|null}
     */
    public function resolverPlaneacionRuta(Colaborador|int $colaborador, string $fecha): array
    {
        $colaboradorModel = $colaborador instanceof Colaborador
            ? $colaborador
            : Colaborador::find($colaborador);

        if (! $colaboradorModel) {
            return [
                'pertenece_planeacion' => false,
                'modulacion_id' => null,
                'ruta_asignada' => null,
            ];
        }

        $colaborador = $colaboradorModel;

        $modulacion = Modulacion::with(['items', 'novedades'])
            ->whereDate('fecha', $fecha)
            ->first();

        if (! $modulacion) {
            return [
                'pertenece_planeacion' => false,
                'modulacion_id' => null,
                'ruta_asignada' => null,
            ];
        }

        // 1. Buscar en ítems de modulación (como principal/conductor)
        $itemDirecto = $modulacion->items
            ->first(function (ModulacionItem $item) use ($colaborador) {
                if ($item->colaborador_id && (int) $item->colaborador_id === (int) $colaborador->id) {
                    return true;
                }

                return $item->cedula && trim((string) $item->cedula) === trim((string) $colaborador->cedula);
            });

        if ($itemDirecto) {
            return [
                'pertenece_planeacion' => true,
                'modulacion_id' => $modulacion->id,
                'ruta_asignada' => $this->formatearRutaItem($itemDirecto),
            ];
        }

        // 2. Buscar en tripulaciones dentro de los ítems
        foreach ($modulacion->items as $item) {
            if (is_array($item->tripulacion)) {
                foreach ($item->tripulacion as $miembro) {
                    $mColId = ! empty($miembro['colaborador_id']) ? (int) $miembro['colaborador_id'] : null;
                    $mCedula = ! empty($miembro['cedula']) ? trim((string) $miembro['cedula']) : null;

                    if (($mColId && $mColId === (int) $colaborador->id) || ($mCedula && $mCedula === trim((string) $colaborador->cedula))) {
                        return [
                            'pertenece_planeacion' => true,
                            'modulacion_id' => $modulacion->id,
                            'ruta_asignada' => $this->formatearRutaMiembro($item, $miembro),
                        ];
                    }
                }
            }
        }

        // 3. Buscar en novedades marcadas como personal fijo activo (sin ausencias)
        foreach ($modulacion->novedades as $nov) {
            $novColId = $nov->colaborador_id ? (int) $nov->colaborador_id : null;
            $novCedula = $nov->cedula ? trim((string) $nov->cedula) : null;

            $coincide = ($novColId && $novColId === (int) $colaborador->id) || ($novCedula && $novCedula === trim((string) $colaborador->cedula));

            if ($coincide) {
                $esFijo = ! empty($nov->fijo) || ! empty($nov->fijo_rescate) || ! empty($nov->fijo_taller);
                $ausente = ! empty($nov->permiso) || ! empty($nov->incapacidad) || ! empty($nov->vacaciones);

                if ($esFijo && ! $ausente) {
                    $role = $nov->fijo_rescate ? 'Personal Fijo - Rescate' : ($nov->fijo_taller ? 'Personal Fijo - Taller' : 'Personal Fijo');

                    return [
                        'pertenece_planeacion' => true,
                        'modulacion_id' => $modulacion->id,
                        'ruta_asignada' => $role,
                    ];
                }
            }
        }

        return [
            'pertenece_planeacion' => false,
            'modulacion_id' => null,
            'ruta_asignada' => null,
        ];
    }

    /**
     * Obtiene el resumen de cobertura de planeación para un rango de fechas o todo el histórico acumulado.
     */
    public function obtenerResumenCobertura(?string $fechaDesde = null, ?string $fechaHasta = null, ?string $colaboradorFiltro = null): array
    {
        // 1. Cargar modulaciones registradas
        $modQuery = Modulacion::with(['items', 'novedades'])->orderBy('fecha', 'desc');

        if (! empty($fechaDesde) && empty($fechaHasta)) {
            $modQuery->whereDate('fecha', $fechaDesde);
        } elseif (empty($fechaDesde) && ! empty($fechaHasta)) {
            $modQuery->whereDate('fecha', '<=', $fechaHasta);
        } elseif (! empty($fechaDesde) && ! empty($fechaHasta)) {
            $modQuery->whereDate('fecha', '>=', $fechaDesde)->whereDate('fecha', '<=', $fechaHasta);
        }

        $modulaciones = $modQuery->get();
        $planeadosMap = [];

        foreach ($modulaciones as $modulacion) {
            $fechaMod = $modulacion->fecha;

            // Ítems principales (conductores)
            foreach ($modulacion->items as $item) {
                if ($item->colaborador_id || $item->cedula) {
                    $itemKey = $item->colaborador_id ? 'id_' . $item->colaborador_id : 'ced_' . trim((string) $item->cedula);
                    $fullKey = $fechaMod . '_' . $itemKey;

                    $planeadosMap[$fullKey] = [
                        'key' => $fullKey,
                        'fecha' => $fechaMod,
                        'modulacion_id' => $modulacion->id,
                        'colaborador_id' => $item->colaborador_id ? (int) $item->colaborador_id : null,
                        'cedula' => $item->cedula ? trim((string) $item->cedula) : null,
                        'nombres' => $item->nombres ?? '',
                        'cargo' => $item->cargo ?? '',
                        'ruta_asignada' => $this->formatearRutaItem($item),
                        'placa' => $item->placa,
                        'ud' => $item->ud,
                    ];
                }

                // Tripulación
                if (is_array($item->tripulacion)) {
                    foreach ($item->tripulacion as $m) {
                        $mColId = ! empty($m['colaborador_id']) ? (int) $m['colaborador_id'] : null;
                        $mCedula = ! empty($m['cedula']) ? trim((string) $m['cedula']) : null;

                        if ($mColId || $mCedula) {
                            $itemKey = $mColId ? 'id_' . $mColId : 'ced_' . $mCedula;
                            $fullKey = $fechaMod . '_' . $itemKey;

                            if (! isset($planeadosMap[$fullKey])) {
                                $planeadosMap[$fullKey] = [
                                    'key' => $fullKey,
                                    'fecha' => $fechaMod,
                                    'modulacion_id' => $modulacion->id,
                                    'colaborador_id' => $mColId,
                                    'cedula' => $mCedula,
                                    'nombres' => $m['nombres'] ?? '',
                                    'cargo' => $m['cargo'] ?? $item->cargo ?? '',
                                    'ruta_asignada' => $this->formatearRutaMiembro($item, $m),
                                    'placa' => $item->placa,
                                    'ud' => $item->ud,
                                ];
                            }
                        }
                    }
                }
            }

            // Personal fijo activo en novedades
            foreach ($modulacion->novedades as $nov) {
                $esFijo = ! empty($nov->fijo) || ! empty($nov->fijo_rescate) || ! empty($nov->fijo_taller);
                $ausente = ! empty($nov->permiso) || ! empty($nov->incapacidad) || ! empty($nov->vacaciones);

                if ($esFijo && ! $ausente) {
                    $novColId = $nov->colaborador_id ? (int) $nov->colaborador_id : null;
                    $novCedula = $nov->cedula ? trim((string) $nov->cedula) : null;

                    if ($novColId || $novCedula) {
                        $itemKey = $novColId ? 'id_' . $novColId : 'ced_' . $novCedula;
                        $fullKey = $fechaMod . '_' . $itemKey;

                        if (! isset($planeadosMap[$fullKey])) {
                            $role = $nov->fijo_rescate ? 'Personal Fijo - Rescate' : ($nov->fijo_taller ? 'Personal Fijo - Taller' : 'Personal Fijo');
                            $planeadosMap[$fullKey] = [
                                'key' => $fullKey,
                                'fecha' => $fechaMod,
                                'modulacion_id' => $modulacion->id,
                                'colaborador_id' => $novColId,
                                'cedula' => $novCedula,
                                'nombres' => $nov->nombres ?? '',
                                'cargo' => $nov->cargo ?? '',
                                'ruta_asignada' => $role,
                                'placa' => null,
                                'ud' => null,
                            ];
                        }
                    }
                }
            }
        }

        // 2. Cargar pruebas de alcoholemia
        $pruebasQuery = PruebaAlcoholemia::with(['colaborador:id,nombres,apellidos,cedula,cargo'])
            ->where('estado', 'realizada');

        if (! empty($fechaDesde) && empty($fechaHasta)) {
            $pruebasQuery->whereDate('fecha_hora', $fechaDesde);
        } elseif (empty($fechaDesde) && ! empty($fechaHasta)) {
            $pruebasQuery->whereDate('fecha_hora', '<=', $fechaHasta);
        } elseif (! empty($fechaDesde) && ! empty($fechaHasta)) {
            $pruebasQuery->whereDate('fecha_hora', '>=', $fechaDesde)->whereDate('fecha_hora', '<=', $fechaHasta);
        }

        $pruebas = $pruebasQuery->get();

        // 3. Incluir en $planeadosMap cualquier prueba con pertenece_planeacion=true o modulacion_id no nula
        foreach ($pruebas as $prueba) {
            if (! $prueba->pertenece_planeacion && ! $prueba->modulacion_id) {
                continue;
            }

            $fechaPrueba = date('Y-m-d', strtotime($prueba->fecha_hora));
            $colId = $prueba->colaborador_id;
            $cedula = $prueba->colaborador?->cedula ? trim((string) $prueba->colaborador->cedula) : null;

            $candidateKeyId = $colId ? "{$fechaPrueba}_id_{$colId}" : null;
            $candidateKeyCed = $cedula ? "{$fechaPrueba}_ced_{$cedula}" : null;

            if (($candidateKeyId && isset($planeadosMap[$candidateKeyId])) || ($candidateKeyCed && isset($planeadosMap[$candidateKeyCed]))) {
                continue;
            }

            $key = $candidateKeyId ?: ($candidateKeyCed ?: "{$fechaPrueba}_prueba_{$prueba->id}");
            $nombre = $prueba->colaborador ? trim("{$prueba->colaborador->nombres} {$prueba->colaborador->apellidos}") : 'Colaborador';

            $planeadosMap[$key] = [
                'key' => $key,
                'fecha' => $fechaPrueba,
                'modulacion_id' => $prueba->modulacion_id,
                'colaborador_id' => $colId,
                'cedula' => $cedula,
                'nombres' => $nombre,
                'cargo' => $prueba->colaborador?->cargo ?? '',
                'ruta_asignada' => $prueba->ruta_asignada ?: 'Ruta asignada',
                'placa' => null,
                'ud' => null,
            ];
        }

        // 4. Enriquecer datos de Colaborador
        $ids = array_filter(array_column($planeadosMap, 'colaborador_id'));
        $cedulas = array_filter(array_column($planeadosMap, 'cedula'));

        $colaboradores = Colaborador::query()
            ->whereIn('id', $ids)
            ->orWhereIn('cedula', $cedulas)
            ->get()
            ->keyBy('id');

        $colaboradoresPorCedula = $colaboradores->keyBy('cedula');

        foreach ($planeadosMap as &$p) {
            $col = null;
            if (! empty($p['colaborador_id']) && isset($colaboradores[$p['colaborador_id']])) {
                $col = $colaboradores[$p['colaborador_id']];
            } elseif (! empty($p['cedula']) && isset($colaboradoresPorCedula[$p['cedula']])) {
                $col = $colaboradoresPorCedula[$p['cedula']];
            }

            if ($col) {
                $p['colaborador_id'] = $col->id;
                $p['nombre_completo'] = trim("{$col->nombres} {$col->apellidos}");
                $p['cedula'] = $col->cedula;
                $p['cargo'] = $col->cargo ?: ($p['cargo'] ?? '');
            } else {
                $p['nombre_completo'] = $p['nombres'] ?: 'Colaborador';
            }
            $p['estado_cobertura'] = 'pendiente';
            $p['prueba'] = null;
        }
        unset($p);

        $requisitosQuery = PruebaAlcoholemiaRequisito::query()
            ->whereIn('fecha', array_values(array_unique(array_column($planeadosMap, 'fecha'))));
        $colaboradorIds = array_values(array_filter(array_column($planeadosMap, 'colaborador_id')));
        if ($colaboradorIds !== []) {
            $requisitos = $requisitosQuery
                ->whereIn('colaborador_id', $colaboradorIds)
                ->get()
                ->keyBy(fn (PruebaAlcoholemiaRequisito $requisito) => $requisito->fecha->format('Y-m-d') . '_id_' . $requisito->colaborador_id);
        } else {
            $requisitos = collect();
        }

        foreach ($planeadosMap as $key => &$planeado) {
            $requisitoKey = $planeado['fecha'] . '_id_' . ($planeado['colaborador_id'] ?? '');
            $planeado['tipo_prueba_planeado'] = $requisitos->get($requisitoKey)?->tipo;
        }
        unset($planeado);

        // 5. Cruzar estado de cobertura realizada
        $adicionalesCount = 0;
        $pruebasPorTipo = [];
        foreach ($planeadosMap as $key => $item) {
            $pruebasPorTipo[$key] = [];
        }

        foreach ($pruebas as $prueba) {
            $fechaPrueba = date('Y-m-d', strtotime($prueba->fecha_hora));
            $matchedKey = null;

            if ($prueba->colaborador_id) {
                $candidateKey = $fechaPrueba . '_id_' . $prueba->colaborador_id;
                if (isset($planeadosMap[$candidateKey])) {
                    $matchedKey = $candidateKey;
                }
            }

            if (! $matchedKey && $prueba->colaborador?->cedula) {
                $candidateKey = $fechaPrueba . '_ced_' . trim((string) $prueba->colaborador->cedula);
                if (isset($planeadosMap[$candidateKey])) {
                    $matchedKey = $candidateKey;
                }
            }

            if ($matchedKey && isset($planeadosMap[$matchedKey])) {
                $pruebasPorTipo[$matchedKey][$prueba->tipo] = true;
                $planeadosMap[$matchedKey]['ultima_prueba'] = $prueba;
            } else {
                $adicionalesCount++;
            }
        }

        $realizadosCount = 0;
        foreach ($planeadosMap as $key => &$planeado) {
            $tipoAlternativo = $planeado['tipo_prueba_planeado'];
            if ($tipoAlternativo !== null) {
                $tipoPendiente = empty($pruebasPorTipo[$key][$tipoAlternativo]) ? $tipoAlternativo : null;
                $completo = $tipoPendiente === null;
            } else {
                $preRutaCompleta = ! empty($pruebasPorTipo[$key]['pre_ruta']);
                $postRutaCompleta = ! empty($pruebasPorTipo[$key]['post_ruta']);
                $tipoPendiente = ! $preRutaCompleta
                    ? 'pre_ruta'
                    : (! $postRutaCompleta ? 'post_ruta' : null);
                $completo = $preRutaCompleta && $postRutaCompleta;
            }

            $planeado['tipo_pendiente'] = $tipoPendiente;
            $planeado['estado_cobertura'] = $completo ? 'realizada' : 'pendiente';
            $planeado['prueba'] = $planeado['ultima_prueba'] ?? null;
            unset($planeado['ultima_prueba']);
            if ($completo) {
                $realizadosCount++;
            }
        }
        unset($planeado);

        // Convertir a array indexado y ordenar por fecha DESC
        $planeadosArray = array_values($planeadosMap);
        usort($planeadosArray, function ($a, $b) {
            $cmpFecha = strcmp((string) $b['fecha'], (string) $a['fecha']);
            if ($cmpFecha !== 0) {
                return $cmpFecha;
            }
            return strcmp((string) $a['nombre_completo'], (string) $b['nombre_completo']);
        });

        if (! empty($colaboradorFiltro)) {
            $term = mb_strtolower(trim($colaboradorFiltro));
            $planeadosArray = array_values(array_filter($planeadosArray, function ($p) use ($term) {
                return str_contains(mb_strtolower((string) ($p['nombre_completo'] ?? '')), $term)
                    || str_contains(mb_strtolower((string) ($p['cedula'] ?? '')), $term);
            }));
        }

        $totalPlaneados = count($planeadosArray);
        $totalPendientes = max(0, $totalPlaneados - $realizadosCount);
        $coberturaPorcentaje = $totalPlaneados > 0 ? round(($realizadosCount / $totalPlaneados) * 100, 2) : 0.0;

        $resumenTexto = sprintf(
            '%d colaboradores planeados — %d realizados — %d pendientes — %d%% de cobertura',
            $totalPlaneados,
            $realizadosCount,
            $totalPendientes,
            (int) round($coberturaPorcentaje)
        );

        // 6. Construir resumen de planeaciones agrupadas por fecha (para la pestaña Planeación Completa)
        $groupedByFecha = [];
        foreach ($planeadosArray as $item) {
            $f = $item['fecha'];
            $groupedByFecha[$f][] = $item;
        }

        $planeacionesResumen = [];
        foreach ($groupedByFecha as $f => $itemsDelDia) {
            $total = count($itemsDelDia);
            $realizados = 0;
            $preCount = 0;
            $postCount = 0;
            $preRequired = 0;
            $postRequired = 0;

            foreach ($itemsDelDia as $item) {
                $pruebasColaborador = $pruebasPorTipo[$item['key']] ?? [];
                if ($item['estado_cobertura'] === 'realizada') {
                    $realizados++;
                }
                if ($item['tipo_prueba_planeado'] === null) {
                    $preRequired++;
                    $postRequired++;
                    if (! empty($pruebasColaborador['pre_ruta'])) {
                        $preCount++;
                    }
                    if (! empty($pruebasColaborador['post_ruta'])) {
                        $postCount++;
                    }
                }
            }

            $planeacionesResumen[] = [
                'fecha' => $f,
                'total_planeados' => $total,
                'total_realizados' => $realizados,
                'total_pendientes' => max(0, $total - $realizados),
                'pre_ruta_realizados' => $preCount,
                'pre_ruta_requeridos' => $preRequired,
                'pre_ruta_completa' => $preCount >= $preRequired,
                'post_ruta_realizados' => $postCount,
                'post_ruta_requeridos' => $postRequired,
                'post_ruta_completa' => $postCount >= $postRequired,
                'esta_completa' => $total > 0 && $realizados >= $total,
            ];
        }

        usort($planeacionesResumen, fn ($a, $b) => strcmp((string) $b['fecha'], (string) $a['fecha']));

        $pendientesList = array_values(array_filter($planeadosArray, fn ($item) => $item['estado_cobertura'] === 'pendiente'));
        $realizadosList = array_values(array_filter($planeadosArray, fn ($item) => $item['estado_cobertura'] === 'realizada'));
        $pendientesPreRuta = array_values(array_filter(
            $planeadosArray,
            fn (array $item) => $item['tipo_prueba_planeado'] === null && $item['tipo_pendiente'] === 'pre_ruta',
        ));
        $pendientesPostRuta = array_values(array_filter(
            $planeadosArray,
            fn (array $item) => $item['tipo_prueba_planeado'] === null && $item['tipo_pendiente'] === 'post_ruta',
        ));
        $pendientesOtras = array_values(array_filter(
            $planeadosArray,
            fn (array $item) => $item['tipo_prueba_planeado'] !== null && $item['tipo_pendiente'] !== null,
        ));

        return [
            'fecha' => $fechaDesde ?? date('Y-m-d'),
            'planeacion_existe' => ! empty($planeadosArray),
            'total_planeados' => $totalPlaneados,
            'total_realizados' => $realizadosCount,
            'total_pendientes' => $totalPendientes,
            'total_adicionales' => $adicionalesCount,
            'total_pruebas' => $pruebas->count(),
            'porcentaje_cobertura' => $coberturaPorcentaje,
            'resumen_texto' => $resumenTexto,
            'pendientes' => $pendientesList,
            'pendientes_pre_ruta' => $pendientesPreRuta,
            'pendientes_post_ruta' => $pendientesPostRuta,
            'pendientes_otras' => $pendientesOtras,
            'realizados' => $realizadosList,
            'todos_planeados' => $planeadosArray,
            'planeaciones' => $planeacionesResumen,
        ];
    }

    private function formatearRutaItem($item): string
    {
        $placa = $item->placa ? trim((string) $item->placa) : '';
        $ud = $item->ud ? trim((string) $item->ud) : '';

        if ($ud !== '' && $placa !== '') {
            return "{$ud} ({$placa})";
        }

        return $ud !== '' ? $ud : ($placa !== '' ? $placa : 'Ruta asignada');
    }

    private function formatearRutaMiembro($item, array $miembro): string
    {
        $cargo = ! empty($miembro['cargo']) ? $miembro['cargo'] : 'Tripulación';
        $base = $this->formatearRutaItem($item);

        return "{$base} - {$cargo}";
    }
}
