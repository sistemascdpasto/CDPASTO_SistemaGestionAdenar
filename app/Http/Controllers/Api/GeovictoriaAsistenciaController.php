<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreGeovictoriaAsistenciasRequest;
use App\Models\GeovictoriaAsistencia;
use Illuminate\Http\JsonResponse;

class GeovictoriaAsistenciaController extends Controller
{
    /**
     * Recibe en lote los indicadores de asistencia ya calculados por la
     * automatizacion GeoVictoria que corre en la PC local (ver
     * procesar_datos.py / ejecutar_ciclo.py), y hace upsert por
     * (identificador, fecha) igual que su propia base de datos local.
     */
    public function store(StoreGeovictoriaAsistenciasRequest $request): JsonResponse
    {
        $registros = $request->validated()['registros'];
        $ahora = now();

        $filas = array_map(fn (array $registro) => [
            'identificador' => $registro['identificador'],
            'fecha' => $registro['fecha'],
            'apellidos' => $registro['apellidos'] ?? null,
            'nombres' => $registro['nombres'] ?? null,
            'cargo' => $registro['cargo'] ?? null,
            'grupo' => $registro['grupo'] ?? null,
            'permiso' => $registro['permiso'] ?? null,
            'turno' => $registro['turno'] ?? null,
            'entrada' => $registro['entrada'] ?? null,
            'salida_descanso' => $registro['salida_descanso'] ?? null,
            'ingreso_descanso' => $registro['ingreso_descanso'] ?? null,
            'salida' => $registro['salida'] ?? null,
            'horas_trabajadas' => $registro['horas_trabajadas'] ?? null,
            'hea' => $registro['hea'] ?? null,
            'hec' => $registro['hec'] ?? null,
            'hnt' => $registro['hnt'] ?? null,
            'exceso_jornada' => $registro['exceso_jornada'],
            'horas_descanso_previo' => $registro['horas_descanso_previo'] ?? null,
            'descanso_no_efectivo' => $registro['descanso_no_efectivo'],
            'hora_minima_entrada' => $registro['hora_minima_entrada'] ?? null,
            'created_at' => $ahora,
            'updated_at' => $ahora,
        ], $registros);

        GeovictoriaAsistencia::upsert(
            $filas,
            ['identificador', 'fecha'],
            [
                'apellidos', 'nombres', 'cargo', 'grupo', 'permiso', 'turno', 'entrada', 'salida_descanso',
                'ingreso_descanso', 'salida', 'horas_trabajadas', 'hea', 'hec', 'hnt', 'exceso_jornada',
                'horas_descanso_previo', 'descanso_no_efectivo', 'hora_minima_entrada', 'updated_at',
            ]
        );

        return response()->json(['procesados' => count($filas)], 201);
    }
}
