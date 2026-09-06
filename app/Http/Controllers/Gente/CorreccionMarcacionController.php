<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\CorreccionMarcacion;
use App\Models\Seguridad\Colaborador;
use App\Services\Gente\CorreccionMarcacionImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class CorreccionMarcacionController extends Controller
{
    private function filterMultiSelect($query, string $column, $input, bool $like = false): void
    {
        if (empty($input)) return;
        $values = is_array($input) ? $input : explode(',', (string)$input);
        $values = array_values(array_filter(array_map('trim', $values), fn($v) => $v !== ''));
        if (empty($values)) return;
        if ($like) {
            $query->where(function ($q) use ($column, $values) {
                foreach ($values as $v) $q->orWhere($column, 'like', '%' . $v . '%');
            });
        } else {
            $query->whereIn($column, $values);
        }
    }

    private function applyFilters($query, Request $request): void
    {
        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha', '>=', $request->input('fecha_desde'));
        }
        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha', '<=', $request->input('fecha_hasta'));
        }
        if ($request->has('identificacion')) {
            $this->filterMultiSelect($query, 'identificacion', $request->input('identificacion'), true);
        }
        if ($request->has('nombre_completo')) {
            $this->filterMultiSelect($query, 'nombre_completo', $request->input('nombre_completo'), true);
        }
        if ($request->has('cargo')) {
            $this->filterMultiSelect($query, 'cargo', $request->input('cargo'));
        }
        if ($request->has('tipo')) {
            $this->filterMultiSelect($query, 'tipo', $request->input('tipo'));
        }
        if ($request->has('centro_costo')) {
            $this->filterMultiSelect($query, 'centro_costo', $request->input('centro_costo'));
        }
        if ($request->has('estado_validacion')) {
            $estado = $request->input('estado_validacion');
            if ($estado === 'encontrado')      $query->where('colaborador_encontrado', true);
            if ($estado === 'no_encontrado')   $query->where('colaborador_encontrado', false);
            if ($estado === 'con_error')       $query->whereNotNull('error_validacion');
        }
    }

    public function index(Request $request): Response
    {
        $query = CorreccionMarcacion::query();
        $this->applyFilters($query, $request);

        $totalRegistros = (clone $query)->count();
        $hayDatos = $totalRegistros > 0;

        $data = (clone $query)
            ->orderBy('fecha', 'desc')
            ->orderBy('identificacion', 'asc')
            ->orderBy('hora', 'asc')
            ->paginate(25)
            ->withQueryString();

        $baseQuery = clone $query;

        $indicadores = $hayDatos ? [
            'total_registros'       => $totalRegistros,
            'colaboradores_unicos'  => (clone $baseQuery)->distinct('identificacion')->whereNotNull('identificacion')->where('identificacion', '!=', '')->count('identificacion'),
            'encontrados_count'     => (clone $baseQuery)->where('colaborador_encontrado', true)->count(),
            'no_encontrados_count'  => (clone $baseQuery)->where('colaborador_encontrado', false)->count(),
            'con_errores_count'     => (clone $baseQuery)->whereNotNull('error_validacion')->count(),
            'tipos_unicos'          => (clone $baseQuery)->distinct('tipo')->whereNotNull('tipo')->where('tipo', '!=', '')->count('tipo'),
            'centros_unicos'        => (clone $baseQuery)->distinct('centro_costo')->whereNotNull('centro_costo')->where('centro_costo', '!=', '')->count('centro_costo'),
        ] : [
            'total_registros'       => 0,
            'colaboradores_unicos'  => 0,
            'encontrados_count'     => 0,
            'no_encontrados_count'  => 0,
            'con_errores_count'     => 0,
            'tipos_unicos'          => 0,
            'centros_unicos'        => 0,
        ];

        // Totales agrupados por tipo y fecha (para gráfica rápida)
        $totalesPorFecha = [];
        if ($hayDatos) {
            $porFecha = (clone $baseQuery)
                ->selectRaw('DATE(fecha) as fecha, COUNT(*) as total')
                ->groupByRaw('DATE(fecha)')
                ->orderBy('fecha', 'asc')
                ->get();
            foreach ($porFecha as $r) {
                $totalesPorFecha[] = [
                    'fecha' => $r->fecha,
                    'total' => (int)$r->total,
                ];
            }
        }

        $catalogos = [
            'identificaciones' => Colaborador::distinct()
                ->whereNotNull('cedula')
                ->where('cedula', '!=', '')
                ->pluck('cedula')
                ->filter(fn($v) => $v !== null && $v !== '')
                ->map(fn($v) => trim((string)$v))
                ->unique()
                ->sort()
                ->values()
                ->toArray(),
            'nombres' => $hayDatos
                ? CorreccionMarcacion::distinct()->whereNotNull('nombre_completo')->where('nombre_completo', '!=', '')->pluck('nombre_completo')->filter()->unique()->sort()->values()->toArray()
                : [],
            'cargos' => $hayDatos
                ? CorreccionMarcacion::distinct()->whereNotNull('cargo')->where('cargo', '!=', '')->pluck('cargo')->filter()->unique()->sort()->values()->toArray()
                : [],
            'tipos' => $hayDatos
                ? CorreccionMarcacion::distinct()->whereNotNull('tipo')->where('tipo', '!=', '')->pluck('tipo')->filter()->unique()->sort()->values()->toArray()
                : [],
            'centros_costo' => $hayDatos
                ? CorreccionMarcacion::distinct()->whereNotNull('centro_costo')->where('centro_costo', '!=', '')->pluck('centro_costo')->filter()->unique()->sort()->values()->toArray()
                : [],
        ];

        return Inertia::render('gente/correccion-marcaciones/index', [
            'data'              => $data,
            'indicadores'       => $indicadores,
            'totales_por_fecha' => $totalesPorFecha,
            'catalogos'         => $catalogos,
            'filters'           => $request->only([
                'fecha_desde', 'fecha_hasta',
                'identificacion', 'nombre_completo',
                'cargo', 'tipo', 'centro_costo',
                'estado_validacion',
            ]),
            'hay_datos'         => $hayDatos,
        ]);
    }

    /**
     * POST: sube el Excel temporal, valida y retorna un preview al frontend
     * (no guarda todavía en la tabla principal).
     */
    public function preview(Request $request, CorreccionMarcacionImportService $service): JsonResponse
    {
        try {
            $archivo = $request->file('archivo_excel');
            if (!$archivo || !$archivo->isValid()) {
                return response()->json([
                    'ok' => false,
                    'error' => 'Archivo Excel no válido o no cargado.',
                ], 422);
            }

            $ext = strtolower($archivo->getClientOriginalExtension());
            if (!in_array($ext, ['xlsx', 'xls', 'csv'], true)) {
                return response()->json([
                    'ok' => false,
                    'error' => 'Formato no permitido. Usa archivos .xlsx, .xls o .csv.',
                ], 422);
            }

            $tempPath = $archivo->getRealPath();
            Log::info('CorreccionMarcacion preview: procesando ' . $archivo->getClientOriginalName());
            $resultado = $service->preview($tempPath);

            // Guardar temporalmente en storage para la confirmación del usuario
            if (!empty($resultado['ok'])) {
                $stored = $archivo->storeAs(
                    'temp/correcciones-marcaciones',
                    uniqid('cm_', true) . '.' . $ext
                );
                $resultado['archivo_temporal'] = $stored;
            }

            return response()->json($resultado);
        } catch (Throwable $e) {
            Log::error('CorreccionMarcacion preview error: ' . $e->getMessage());
            return response()->json([
                'ok' => false,
                'error' => 'Error al procesar el archivo: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST: recibe la ruta del archivo temporal y confirma la importación a BD.
     */
    public function importar(Request $request, CorreccionMarcacionImportService $service): RedirectResponse
    {
        try {
            $archivoTemporal = $request->input('archivo_temporal');
            if (!$archivoTemporal) {
                return back()->with('status', [
                    'message' => 'No hay archivo temporal para importar. Sube y valida primero.',
                    'type'    => 'error',
                ]);
            }

            $rutaCompleta = Storage::disk('local')->path($archivoTemporal);
            if (!Storage::disk('local')->exists($archivoTemporal)) {
                return back()->with('status', [
                    'message' => 'Archivo temporal expirado o no encontrado. Vuelve a subir el Excel.',
                    'type'    => 'error',
                ]);
            }

            $usuarioId = auth()->check() ? auth()->id() : null;
            $resultado = $service->importarDesdeArchivo($rutaCompleta, $usuarioId);

            // Limpiar archivo temporal
            @unlink($rutaCompleta);

            if (!$resultado['ok']) {
                return back()->with('status', [
                    'message' => $resultado['error'] ?? 'Error en la importación.',
                    'type'    => 'error',
                ]);
            }

            $mensaje = "Importación completada: {$resultado['guardados']} registros guardados de {$resultado['total']} filas procesadas.";

            if (!empty($resultado['duplicados'])) {
                $mensaje .= " {$resultado['duplicados']} registro(s) omitido(s) por duplicado (misma identificación, fecha y hora ya existían).";
            }

            if (!empty($resultado['mensaje_no_encontradas'])) {
                $mensaje .= " {$resultado['mensaje_no_encontradas']}";
            }

            $tipo = (!empty($resultado['no_encontradas'])) ? 'warning' : 'success';

            return redirect()->route('gente.correccion-marcaciones.index')
                ->with('status', ['message' => $mensaje, 'type' => $tipo]);
        } catch (Throwable $e) {
            Log::error('CorreccionMarcacion importar error: ' . $e->getMessage());
            return back()->with('status', [
                'message' => 'Error al importar: ' . $e->getMessage(),
                'type'    => 'error',
            ]);
        }
    }

    public function destroy(int $id): RedirectResponse
    {
        $registro = CorreccionMarcacion::find($id);
        if (!$registro) {
            return back()->with('status', ['message' => 'Registro no encontrado.', 'type' => 'error']);
        }
        $registro->delete();
        return back()->with('status', ['message' => 'Registro eliminado correctamente.', 'type' => 'success']);
    }

    public function limpiar(): RedirectResponse
    {
        CorreccionMarcacion::truncate();
        return redirect()->route('gente.correccion-marcaciones.index')
            ->with('status', ['message' => 'Se limpiaron todos los registros de Corrección de Marcaciones.', 'type' => 'success']);
    }

    public function exportar(Request $request): StreamedResponse
    {
        $query = CorreccionMarcacion::query();
        $this->applyFilters($query, $request);

        $filename = 'correccion_marcaciones_' . date('Y-m-d_H-i') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($query) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));
            fputcsv($file, [
                'IDENTIFICACIÓN', 'NOMBRE COMPLETO', 'CARGO',
                'FECHA', 'HORA', 'TIPO',
                'CENTRO DE COSTO', 'COMENTARIO',
                'COLABORADOR ENCONTRADO', 'ERROR VALIDACIÓN',
                'CREADO EN',
            ]);
            $query->orderBy('fecha', 'desc')->orderBy('identificacion')->chunk(300, function ($rows) use ($file) {
                foreach ($rows as $r) {
                    fputcsv($file, [
                        $r->identificacion,
                        $r->nombre_completo,
                        $r->cargo,
                        $r->fecha instanceof \DateTimeInterface ? $r->fecha->format('Y-m-d') : $r->fecha,
                        $r->hora,
                        $r->tipo,
                        $r->centro_costo,
                        $r->comentario,
                        $r->colaborador_encontrado ? 'SI' : 'NO',
                        $r->error_validacion,
                        $r->created_at instanceof \DateTimeInterface ? $r->created_at->format('Y-m-d H:i:s') : $r->created_at,
                    ]);
                }
            });
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Plantilla de ejemplo descargable en CSV.
     */
    public function plantilla(): StreamedResponse
    {
        $filename = 'plantilla_correccion_marcaciones.csv';
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];
        $callback = function () {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));
            fputcsv($file, ['Identificacion', 'Fecha', 'Hora', 'Tipo', 'Centro de Costo', 'Comentario']);
            fputcsv($file, ['12345678', '2026-09-01', '07:30', 'Entrada', 'CD NORTE', 'Ajuste de marcación olvidada']);
            fputcsv($file, ['87654321', '2026-09-01', '12:00', 'Salida Almuerzo', 'CD SUR', '']);
            fputcsv($file, ['87654321', '2026-09-01', '13:00', 'Regreso Almuerzo', 'CD SUR', '']);
            fputcsv($file, ['12345678', '2026-09-01', '18:00', 'Salida', 'CD NORTE', '']);
            fclose($file);
        };
        return response()->stream($callback, 200, $headers);
    }
}
