<?php

namespace App\Services\Seguridad;

use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\EvaluacionOwd;
use App\Models\Seguridad\EvaluacionOwdImportacion;
use App\Models\Seguridad\EvaluacionOwdPregunta;
use App\Models\Seguridad\PlanAccionOwd;
use App\Models\User;
use App\Services\Seguridad\Concerns\NormalizaCatalogos;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Throwable;


class EvaluacionOwdImportService
{
    use NormalizaCatalogos;

    private const HEADER_MAP = [
        'BU' => 'bu',
        'PAIS' => 'pais',
        'REGION' => 'region',
        'UEN' => 'uen',
        'IDAGENCIA' => 'id_agencia',
        'AGENCIA' => 'agencia',
        'EVALUADOR' => 'evaluador',
        'POSICIONEVALUADOR' => 'posicion_evaluador',
        'QRSAFETYEVALUADOR' => 'qr_safety_evaluador',
        'SHARPEVALUADOR' => 'sharp_evaluador',
        'EVALUADO' => 'evaluado',
        'POSICION' => 'posicion',
        'QRSAFETY' => 'qr_safety',
        'SHARP' => 'sharp',
        'FECHAEVALUACION' => 'fecha_evaluacion',
        'TYPE' => 'type',
        'PILLAR' => 'pillar',
        'PROCESO' => 'proceso',
        'ACTIVIDAD' => 'actividad',
        'TAREA' => 'tarea',
        'DESCRIPCION' => 'descripcion',
        'PUNTUACION' => 'puntuacion',
        'PONDERACION' => 'ponderacion',
        'PLANDEACCION' => 'plan_accion',
        'VERSION' => 'version',
    ];

    
    private const CAMPOS_CABECERA = [
        'bu', 'pais', 'region', 'uen', 'id_agencia', 'agencia',
        'evaluador', 'posicion_evaluador', 'qr_safety_evaluador', 'sharp_evaluador',
        'evaluado', 'posicion', 'qr_safety', 'sharp',
        'fecha_evaluacion', 'type', 'pillar',
    ];

 
    public function importar(array $rutasArchivos, ?User $usuario = null): array
    {
        // Archivos con muchas filas pueden superar el límite por defecto de 60s.
        // Se amplía solo para este proceso de importación.
        set_time_limit(600);

        $resultado = [
            'archivos_procesados' => 0,
            'registros_leidos' => 0,
            'evaluaciones_identificadas' => 0,
            'nuevos' => 0,
            'duplicados' => 0,
            'sin_coincidencia_qr' => 0,
            'errores' => 0,
        ];

        foreach ($rutasArchivos as $rutaArchivo => $nombreOriginal) {
            $this->importarArchivo($rutaArchivo, $nombreOriginal, $usuario, $resultado);
        }

        return $resultado;
    }

    /**
     * @param  array{archivos_procesados: int, registros_leidos: int, evaluaciones_identificadas: int, nuevos: int, duplicados: int, sin_coincidencia_qr: int, errores: int}  $resultado
     */
    private function importarArchivo(string $rutaArchivo, string $nombreOriginal, ?User $usuario, array &$resultado): void
    {
        $hoja = $this->buscarHojaOwd($rutaArchivo);

        if (! $hoja) {
            Log::warning("Importación de Evaluaciones OWD: el archivo {$rutaArchivo} está vacío o no se pudo leer.");
            $resultado['errores']++;

            return;
        }

        $resultado['archivos_procesados']++;

        $filas = $hoja->toArray(null, true, true, true);
        $encabezados = array_shift($filas) ?? [];
        $mapaColumnas = $this->resolverMapaColumnas($encabezados);
        $columnasNuevas = collect($mapaColumnas)->filter(fn ($info) => $info['campo'] === null)
            ->pluck('encabezado')->unique()->values()->all();

        // Pre-cargar colaboradores indexados por código QR SKAP para evitar
        // N+1 queries durante el procesamiento fila a fila.
        $colaboradoresPorQr = Colaborador::whereNotNull('codigo_qr_skap')
            ->select(['id', 'codigo_qr_skap', 'nombres', 'apellidos'])
            ->get()
            ->keyBy('codigo_qr_skap');

        $registro = [
            'leidos' => 0,
            'evaluaciones' => [],
            'nuevos' => 0,
            'duplicados' => 0,
            'sin_coincidencia_qr' => 0,
            'qrs_sin_coincidencia' => [],   // [{qr, evaluado}]
            'errores' => 0,
        ];

        $evaluacionesTocadas = [];

        DB::transaction(function () use ($filas, $mapaColumnas, &$registro, &$evaluacionesTocadas, $colaboradoresPorQr) {
            foreach ($filas as $numeroFila => $fila) {
                $this->procesarFila($fila, $mapaColumnas, $numeroFila, $registro, $evaluacionesTocadas, $colaboradoresPorQr);
            }
        });

        foreach ($evaluacionesTocadas as $evaluacionOwd) {
            $evaluacionOwd->recalcularContadores();
        }

        EvaluacionOwdImportacion::create([
            'nombre_archivo' => $nombreOriginal,
            'usuario_id' => $usuario?->id,
            'registros_leidos' => $registro['leidos'],
            'evaluaciones_identificadas' => count($registro['evaluaciones']),
            'registros_nuevos' => $registro['nuevos'],
            'registros_duplicados' => $registro['duplicados'],
            'registros_sin_coincidencia_qr' => $registro['sin_coincidencia_qr'],
            'registros_error' => $registro['errores'],
            'columnas_nuevas_detectadas' => $columnasNuevas !== [] ? $columnasNuevas : null,
            'qrs_sin_coincidencia' => $registro['qrs_sin_coincidencia'] !== [] ? $registro['qrs_sin_coincidencia'] : null,
        ]);

        $resultado['registros_leidos'] += $registro['leidos'];
        $resultado['evaluaciones_identificadas'] += count($registro['evaluaciones']);
        $resultado['nuevos'] += $registro['nuevos'];
        $resultado['duplicados'] += $registro['duplicados'];
        $resultado['sin_coincidencia_qr'] += $registro['sin_coincidencia_qr'];
        $resultado['errores'] += $registro['errores'];
    }

    /**
     * @param  array<string, mixed>  $fila
     * @param  array<string, array{campo: ?string, encabezado: string}>  $mapaColumnas
     * @param  array{leidos: int, evaluaciones: array<string, true>, nuevos: int, duplicados: int, sin_coincidencia_qr: int, errores: int}  $registro
     * @param  array<int, EvaluacionOwd>  $evaluacionesTocadas
     * @param  \Illuminate\Support\Collection<string, Colaborador>  $colaboradoresPorQr
     */
    private function procesarFila(array $fila, array $mapaColumnas, int|string $numeroFila, array &$registro, array &$evaluacionesTocadas, $colaboradoresPorQr): void
    {
        $valores = $this->extraerValoresPorCampo($fila, $mapaColumnas);

        $qrSafety = trim((string) ($valores['qr_safety'] ?? ''));

        if ($qrSafety === '' && trim((string) ($valores['evaluado'] ?? '')) === '') {
            return; // fila vacía al final de la hoja
        }

        $registro['leidos']++;

        $fechaEvaluacion = $this->parsearFechaHora((string) ($valores['fecha_evaluacion'] ?? ''));

        if ($qrSafety === '' || $fechaEvaluacion === null) {
            Log::warning("Importación de Evaluaciones OWD: fila {$numeroFila} sin QR Safety o fecha de evaluación válida, se omite.");
            $registro['errores']++;

            return;
        }

        try {
            $qrSafetyEvaluador = trim((string) ($valores['qr_safety_evaluador'] ?? ''));

            // Lookup por QR Safety exacto (en memoria, sin queries)
            $colaborador = $colaboradoresPorQr->get($qrSafety);

            // Si el QR del evaluado no existe en BD, se descarta la fila
            if (! $colaborador) {
                $registro['sin_coincidencia_qr']++;
                // Guardar qr + nombre del evaluado para reportarlo
                $evaluadoNombre = trim((string) ($valores['evaluado'] ?? ''));
                $registro['qrs_sin_coincidencia'][$qrSafety] = [
                    'qr'      => $qrSafety,
                    'evaluado' => $evaluadoNombre !== '' ? $evaluadoNombre : null,
                ];
                return;
            }

            // Evaluador: también solo por QR (puede ser null si no está en BD)
            $evaluadorColaborador = $qrSafetyEvaluador !== ''
                ? $colaboradoresPorQr->get($qrSafetyEvaluador)
                : null;

            $type = trim((string) ($valores['type'] ?? ''));

            $claveEvaluacion = "{$qrSafetyEvaluador}|{$qrSafety}|{$fechaEvaluacion}|{$type}";
            $registro['evaluaciones'][$claveEvaluacion] = true;

            $datosCabecera = $this->mapearCabecera($valores, $fechaEvaluacion);
            $datosCabecera['colaborador_id'] = $colaborador?->id;
            $datosCabecera['evaluador_colaborador_id'] = $evaluadorColaborador?->id;

            $evaluacionOwd = EvaluacionOwd::firstOrCreate([
                'qr_safety_evaluador' => $qrSafetyEvaluador !== '' ? $qrSafetyEvaluador : null,
                'qr_safety' => $qrSafety,
                'fecha_evaluacion' => $fechaEvaluacion,
                'type' => $type !== '' ? $type : null,
            ], $datosCabecera);

            $evaluacionesTocadas[$evaluacionOwd->id] = $evaluacionOwd;

            $datosPregunta = $this->mapearPregunta($valores);

            $existeDuplicada = EvaluacionOwdPregunta::where('evaluacion_owd_id', $evaluacionOwd->id)
                ->where('proceso', $datosPregunta['proceso'])
                ->where('actividad', $datosPregunta['actividad'])
                ->where('tarea', $datosPregunta['tarea'])
                ->where('puntuacion', $datosPregunta['puntuacion'])
                ->where('descripcion', $datosPregunta['descripcion'])
                ->where('version', $datosPregunta['version'])
                ->exists();

            if ($existeDuplicada) {
                $registro['duplicados']++;

                return;
            }

            $datosPregunta['evaluacion_owd_id'] = $evaluacionOwd->id;
            $pregunta = EvaluacionOwdPregunta::create($datosPregunta);
            $registro['nuevos']++;

            if ($pregunta->requiere_plan_accion) {
                PlanAccionOwd::firstOrCreate(
                    ['evaluacion_owd_pregunta_id' => $pregunta->id],
                    ['estado' => PlanAccionOwd::ESTADO_PENDIENTE],
                );
            }
        } catch (Throwable $e) {
            Log::warning("Importación de Evaluaciones OWD: error en fila {$numeroFila}: {$e->getMessage()}");
            $registro['errores']++;
        }
    }

    private function buscarHojaOwd(string $rutaArchivo): ?Worksheet
    {
        $spreadsheet = IOFactory::load($rutaArchivo);

        // Primero intentar encontrar la hoja por nombre canónico "Data OWD"
        foreach ($spreadsheet->getSheetNames() as $nombre) {
            if (str(trim($nombre))->upper()->value() === 'DATA OWD') {
                return $spreadsheet->getSheetByName($nombre);
            }
        }

        // Si no existe hoja "Data OWD", usar la primera hoja disponible
        // (útil cuando el archivo tiene una sola hoja o un nombre diferente)
        if ($spreadsheet->getSheetCount() > 0) {
            return $spreadsheet->getSheet(0);
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $encabezados
     * @return array<string, array{campo: ?string, encabezado: string}>
     */
    private function resolverMapaColumnas(array $encabezados): array
    {
        $mapa = [];

        foreach ($encabezados as $letra => $texto) {
            $texto = trim((string) $texto);

            if ($texto === '') {
                continue;
            }

            $mapa[$letra] = [
                'campo' => self::HEADER_MAP[$this->normalizar($texto)] ?? null,
                'encabezado' => $texto,
            ];
        }

        return $mapa;
    }

    /**
     * @param  array<string, mixed>  $fila
     * @param  array<string, array{campo: ?string, encabezado: string}>  $mapaColumnas
     * @return array<string, mixed>
     */
    private function extraerValoresPorCampo(array $fila, array $mapaColumnas): array
    {
        $valores = [];
        $adicionales = [];

        foreach ($mapaColumnas as $letra => $info) {
            $valorCrudo = trim((string) ($fila[$letra] ?? ''));

            if ($info['campo']) {
                $valores[$info['campo']] = $valorCrudo;
            } elseif ($valorCrudo !== '') {
                $adicionales[$info['encabezado']] = $valorCrudo;
            }
        }

        $valores['datos_adicionales'] = $adicionales !== [] ? $adicionales : null;

        return $valores;
    }

    /**
     * @param  array<string, mixed>  $valores
     * @return array<string, mixed>
     */
    private function mapearCabecera(array $valores, string $fechaEvaluacion): array
    {
        $datos = ['fecha_evaluacion' => $fechaEvaluacion];

        foreach (self::CAMPOS_CABECERA as $campo) {
            if ($campo === 'fecha_evaluacion') {
                continue;
            }

            $valor = trim((string) ($valores[$campo] ?? ''));
            $datos[$campo] = $valor !== '' ? $valor : null;
        }

        return $datos;
    }

    /**
     * @param  array<string, mixed>  $valores
     * @return array<string, mixed>
     */
    private function mapearPregunta(array $valores): array
    {
        return [
            'proceso' => $this->valorOTexto($valores['proceso'] ?? null),
            'actividad' => $this->valorOTexto($valores['actividad'] ?? null),
            'tarea' => $this->valorOTexto($valores['tarea'] ?? null),
            'descripcion' => $this->valorOTexto($valores['descripcion'] ?? null),
            'puntuacion' => $this->valorOTexto($valores['puntuacion'] ?? null),
            'ponderacion' => $this->parsearNumero((string) ($valores['ponderacion'] ?? '')),
            'requiere_plan_accion' => $this->parsearBooleano((string) ($valores['plan_accion'] ?? '')) ?? false,
            'version' => $this->valorOTexto($valores['version'] ?? null),
            'datos_adicionales' => $valores['datos_adicionales'] ?? null,
        ];
    }

    private function valorOTexto(mixed $valor): ?string
    {
        $valor = trim((string) $valor);

        return $valor !== '' ? $valor : null;
    }

    private function parsearNumero(string $valor): ?float
    {
        $valor = trim(str_replace(',', '.', $valor));

        return is_numeric($valor) ? (float) $valor : null;
    }

    private function parsearFechaHora(string $valor): ?string
    {
        $valor = trim($valor);

        if ($valor === '') {
            return null;
        }

        $valorNorm = preg_replace('/\s*a\.\s*m\.\s*/i', ' AM ', $valor);
        $valorNorm = preg_replace('/\s*p\.\s*m\.\s*/i', ' PM ', $valorNorm);
        $valorNorm = preg_replace('/\s*a\.\s*m\s*/i', ' AM ', $valorNorm);
        $valorNorm = preg_replace('/\s*p\.\s*m\s*/i', ' PM ', $valorNorm);
        $valorNorm = preg_replace('/\s+/', ' ', trim($valorNorm));

        foreach (['Y-m-d H:i:s', 'd/m/Y H:i:s', 'd/m/Y H:i', 'd/m/Y h:i:s A', 'd/m/Y g:i:s A'] as $formato) {
            try {
                return Carbon::createFromFormat($formato, $valorNorm)->toDateTimeString();
            } catch (Throwable) {
                continue;
            }
        }

        try {
            return Carbon::parse($valorNorm)->toDateTimeString();
        } catch (Throwable) {
            return null;
        }
    }

    private function parsearBooleano(string $valor): ?bool
    {
        return match ($this->normalizar($valor)) {
            'SI' => true,
            'NO' => false,
            default => null,
        };
    }
}
