<?php

namespace App\Services\Seguridad;

use App\Models\Reparto\Modulacion;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\PruebaAlcoholemia;

class CoberturaPlaneacionService
{
    /**
     * Resuelve la relación de planeación de ruta para un colaborador y una fecha específica.
     * Devuelve el snapshot histórico de planeación.
     */
    public function resolverPlaneacionRuta(Colaborador|int $colaborador, string $fecha): array
    {
        $colaboradorObj = $colaborador instanceof Colaborador ? $colaborador : Colaborador::find($colaborador);
        if (! $colaboradorObj) {
            return [
                'pertenece_planeacion' => false,
                'modulacion_id' => null,
                'ruta_asignada' => null,
            ];
        }

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

        $colId = (int) $colaboradorObj->id;
        $cedula = trim((string) $colaboradorObj->cedula);

        // 1. Buscar en ítems (conductores / asignados principales)
        foreach ($modulacion->items as $item) {
            $itemColId = $item->colaborador_id ? (int) $item->colaborador_id : null;
            $itemCedula = $item->cedula ? trim((string) $item->cedula) : null;

            if (($itemColId && $itemColId === $colId) || ($itemCedula && $cedula !== '' && $itemCedula === $cedula)) {
                return [
                    'pertenece_planeacion' => true,
                    'modulacion_id' => $modulacion->id,
                    'ruta_asignada' => $this->formatearRutaItem($item),
                ];
            }

            // 2. Buscar en tripulación
            if (is_array($item->tripulacion)) {
                foreach ($item->tripulacion as $miembro) {
                    $mColId = ! empty($miembro['colaborador_id']) ? (int) $miembro['colaborador_id'] : null;
                    $mCedula = ! empty($miembro['cedula']) ? trim((string) $miembro['cedula']) : null;

                    if (($mColId && $mColId === $colId) || ($mCedula && $cedula !== '' && $mCedula === $cedula)) {
                        return [
                            'pertenece_planeacion' => true,
                            'modulacion_id' => $modulacion->id,
                            'ruta_asignada' => $this->formatearRutaMiembro($item, $miembro),
                        ];
                    }
                }
            }
        }

        // 3. Buscar en novedades (personal fijo activo)
        foreach ($modulacion->novedades as $nov) {
            $novColId = $nov->colaborador_id ? (int) $nov->colaborador_id : null;
            $novCedula = $nov->cedula ? trim((string) $nov->cedula) : null;

            if (($novColId && $novColId === $colId) || ($novCedula && $cedula !== '' && $novCedula === $cedula)) {
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
     * Obtiene el resumen de cobertura de planeación para una fecha.
     */
    public function obtenerResumenCobertura(string $fecha): array
    {
        $modulacion = Modulacion::with(['items', 'novedades'])
            ->whereDate('fecha', $fecha)
            ->first();

        $planeadosMap = [];

        if ($modulacion) {
            // 1. Ítems principales y tripulación
            foreach ($modulacion->items as $item) {
                // Conductor/Principal
                if ($item->colaborador_id || $item->cedula) {
                    $key = $item->colaborador_id ? 'id_' . $item->colaborador_id : 'ced_' . trim((string) $item->cedula);
                    $planeadosMap[$key] = [
                        'key' => $key,
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
                            $key = $mColId ? 'id_' . $mColId : 'ced_' . $mCedula;
                            if (! isset($planeadosMap[$key])) {
                                $planeadosMap[$key] = [
                                    'key' => $key,
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

            // 2. Personal fijo activo en novedades
            foreach ($modulacion->novedades as $nov) {
                $esFijo = ! empty($nov->fijo) || ! empty($nov->fijo_rescate) || ! empty($nov->fijo_taller);
                $ausente = ! empty($nov->permiso) || ! empty($nov->incapacidad) || ! empty($nov->vacaciones);

                if ($esFijo && ! $ausente) {
                    $novColId = $nov->colaborador_id ? (int) $nov->colaborador_id : null;
                    $novCedula = $nov->cedula ? trim((string) $nov->cedula) : null;

                    if ($novColId || $novCedula) {
                        $key = $novColId ? 'id_' . $novColId : 'ced_' . $novCedula;
                        if (! isset($planeadosMap[$key])) {
                            $role = $nov->fijo_rescate ? 'Personal Fijo - Rescate' : ($nov->fijo_taller ? 'Personal Fijo - Taller' : 'Personal Fijo');
                            $planeadosMap[$key] = [
                                'key' => $key,
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

        // Cargar modelos de Colaborador para enriquecer los datos
        $ids = array_filter(array_column($planeadosMap, 'colaborador_id'));
        $cedulas = array_filter(array_column($planeadosMap, 'cedula'));

        $colaboradores = Colaborador::query()
            ->whereIn('id', $ids)
            ->orWhereIn('cedula', $cedulas)
            ->get()
            ->keyBy('id');

        $colaboradoresPorCedula = $colaboradores->keyBy('cedula');

        foreach ($planeadosMap as $k => &$p) {
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

        // Consultar pruebas registradas para la fecha
        $pruebasDelDia = PruebaAlcoholemia::with(['colaborador:id,nombres,apellidos,cedula,cargo', 'alcoholimetro:id,codigo', 'responsable:id,name'])
            ->whereDate('fecha_hora', $fecha)
            ->where('estado', '!=', 'cancelada')
            ->get();

        $realizadosCount = 0;
        $adicionalesCount = 0;

        foreach ($pruebasDelDia as $prueba) {
            $matchedKey = null;
            if ($prueba->colaborador_id && isset($planeadosMap['id_' . $prueba->colaborador_id])) {
                $matchedKey = 'id_' . $prueba->colaborador_id;
            } elseif ($prueba->colaborador?->cedula && isset($planeadosMap['ced_' . trim((string) $prueba->colaborador->cedula)])) {
                $matchedKey = 'ced_' . trim((string) $prueba->colaborador->cedula);
            }

            if ($matchedKey && isset($planeadosMap[$matchedKey])) {
                if ($planeadosMap[$matchedKey]['estado_cobertura'] === 'pendiente') {
                    $planeadosMap[$matchedKey]['estado_cobertura'] = 'realizada';
                    $planeadosMap[$matchedKey]['prueba'] = $prueba;
                    $realizadosCount++;
                }
            } else {
                $adicionalesCount++;
            }
        }

        $totalPlaneados = count($planeadosMap);
        $totalPendientes = max(0, $totalPlaneados - $realizadosCount);
        $coberturaPorcentaje = $totalPlaneados > 0 ? round(($realizadosCount / $totalPlaneados) * 100, 2) : 0.0;

        $resumenTexto = sprintf(
            '%d colaboradores planeados — %d realizados — %d pendientes — %s%% de cobertura',
            $totalPlaneados,
            $realizadosCount,
            $totalPendientes,
            number_format($coberturaPorcentaje, 2, ',', '.')
        );

        $pendientesList = array_values(array_filter($planeadosMap, fn ($item) => $item['estado_cobertura'] === 'pendiente'));
        $realizadosList = array_values(array_filter($planeadosMap, fn ($item) => $item['estado_cobertura'] === 'realizada'));

        return [
            'fecha' => $fecha,
            'planeacion_existe' => (bool) $modulacion,
            'total_planeados' => $totalPlaneados,
            'total_realizados' => $realizadosCount,
            'total_pendientes' => $totalPendientes,
            'total_adicionales' => $adicionalesCount,
            'total_pruebas' => $pruebasDelDia->count(),
            'porcentaje_cobertura' => $coberturaPorcentaje,
            'resumen_texto' => $resumenTexto,
            'pendientes' => $pendientesList,
            'realizados' => $realizadosList,
            'todos_planeados' => array_values($planeadosMap),
        ];
    }

    private function formatearRutaItem($item): string
    {
        $parts = [];
        if (! empty($item->placa)) {
            $parts[] = "Placa: {$item->placa}";
        }
        if (! empty($item->ud)) {
            $parts[] = "UD: {$item->ud}";
        }
        if (! empty($item->cargo)) {
            $parts[] = "Cargo: {$item->cargo}";
        }

        return implode(' | ', $parts) ?: 'Ruta asignada';
    }

    private function formatearRutaMiembro($item, array $miembro): string
    {
        $parts = [];
        if (! empty($item->placa)) {
            $parts[] = "Placa: {$item->placa}";
        }
        if (! empty($item->ud)) {
            $parts[] = "UD: {$item->ud}";
        }
        $cargo = $miembro['cargo'] ?? $item->cargo;
        if (! empty($cargo)) {
            $parts[] = "Cargo: {$cargo}";
        }

        return implode(' | ', $parts) ?: 'Tripulación de ruta';
    }
}
