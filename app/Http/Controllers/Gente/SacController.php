<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\Sac;
use App\Models\Seguridad\Colaborador;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SacController extends Controller
{
    /**
     * Mapeo de variantes de encabezados a columnas de la base de datos.
     */
    private const COLUMN_MAP = [
        'año'                      => 'anio',
        'ano'                      => 'anio',
        'anio'                     => 'anio',
        'year'                     => 'anio',

        'numero de caso estandar'  => 'numero_caso_estandar',
        'numero caso estandar'     => 'numero_caso_estandar',
        'num caso estandar'        => 'numero_caso_estandar',
        'numero_caso_estandar'     => 'numero_caso_estandar',
        'caso estandar'            => 'numero_caso_estandar',
        'caso'                     => 'numero_caso_estandar',

        'nombre de la cuenta'      => 'nombre_cuenta',
        'nombre cuenta'            => 'nombre_cuenta',
        'nombre_cuenta'            => 'nombre_cuenta',
        'cuenta'                   => 'nombre_cuenta',

        'nombre del contacto'      => 'nombre_contacto',
        'nombre contacto'          => 'nombre_contacto',
        'nombre_contacto'          => 'nombre_contacto',
        'contacto'                 => 'nombre_contacto',

        'fecha'                    => 'fecha',

        'descripción'              => 'descripcion',
        'descripcion'              => 'descripcion',

        'fecha resuelto'           => 'fecha_resuelto',
        'fecha_resuelto'           => 'fecha_resuelto',

        'comentario'               => 'comentario',

        'aplica'                   => 'aplica',

        'mes'                      => 'mes',

        'subcategoria'             => 'subcategoria',
        'sub categoría'            => 'subcategoria',
        'sub_categoria'            => 'subcategoria',

        'motivo queja'             => 'motivo_queja',
        'motivo_queja'             => 'motivo_queja',

        'placa'                    => 'placa',

        'responsable'              => 'responsable',

        'documento de transporte'  => 'documento_transporte',
        'documento transporte'     => 'documento_transporte',
        'doc transporte'           => 'documento_transporte',
        'documento_transporte'     => 'documento_transporte',

        'plan de accion'           => 'plan_accion',
        'plan de acción'           => 'plan_accion',
        'plan_accion'              => 'plan_accion',

        'tiempo de cierre caso'    => 'tiempo_cierre_caso',
        'tiempo cierre caso'       => 'tiempo_cierre_caso',
        'tiempo_cierre_caso'       => 'tiempo_cierre_caso',

        '% si/no'                  => 'porcentaje_si_no',
        '% si / no'                => 'porcentaje_si_no',
        'porcentaje si/no'         => 'porcentaje_si_no',
        'porcentaje_si_no'         => 'porcentaje_si_no',

        'cumplimiento cierre'      => 'cumplimiento_cierre',
        'cumplimiento_cierre'      => 'cumplimiento_cierre',

        'ytd'                      => 'ytd',

        'hora'                     => 'hora',
    ];

    public function index(Request $request): Response
    {
        $search = trim($request->input('search', ''));
        $mes = trim($request->input('mes', ''));
        $anio = trim($request->input('anio', ''));
        $subcategoria = trim($request->input('subcategoria', ''));
        $responsable = trim($request->input('responsable', ''));

        $query = Sac::with('colaborador:id,nombres,apellidos,cedula,cargo');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('numero_caso_estandar', 'like', "%{$search}%")
                  ->orWhere('nombre_cuenta', 'like', "%{$search}%")
                  ->orWhere('nombre_contacto', 'like', "%{$search}%")
                  ->orWhere('descripcion', 'like', "%{$search}%")
                  ->orWhere('responsable', 'like', "%{$search}%")
                  ->orWhere('placa', 'like', "%{$search}%")
                  ->orWhere('motivo_queja', 'like', "%{$search}%");
            });
        }

        if ($mes !== '') {
            $query->where('mes', $mes);
        }

        if ($anio !== '') {
            $query->where('anio', $anio);
        }

        if ($subcategoria !== '') {
            $query->where('subcategoria', $subcategoria);
        }

        if ($responsable !== '') {
            $query->where('responsable', $responsable);
        }

        $registros = $query->orderBy('fecha', 'desc')
            ->orderBy('id', 'desc')
            ->paginate(15)
            ->withQueryString();

        // KPIs
        $totalCasos = Sac::count();
        $casosResueltos = Sac::whereNotNull('fecha_resuelto')->count();
        $casosAsociados = Sac::whereNotNull('colaborador_id')->count();
        $porcentajeAsociados = $totalCasos > 0 ? round(($casosAsociados / $totalCasos) * 100, 1) : 0;

        // Opciones para filtros
        $anios = Sac::whereNotNull('anio')->where('anio', '!=', '')->distinct()->pluck('anio')->sort()->values();
        $meses = Sac::whereNotNull('mes')->where('mes', '!=', '')->distinct()->pluck('mes')->filter()->values();
        $subcategorias = Sac::whereNotNull('subcategoria')->where('subcategoria', '!=', '')->distinct()->pluck('subcategoria')->filter()->values();
        $responsables = Sac::whereNotNull('responsable')->where('responsable', '!=', '')->distinct()->pluck('responsable')->filter()->values();

        return Inertia::render('gente/sac/index', [
            'registros' => $registros,
            'filters'   => [
                'search'       => $search,
                'mes'          => $mes,
                'anio'         => $anio,
                'subcategoria' => $subcategoria,
                'responsable'  => $responsable,
            ],
            'options'   => [
                'anios'         => $anios,
                'meses'         => $meses,
                'subcategorias' => $subcategorias,
                'responsables'  => $responsables,
            ],
            'kpis'      => [
                'total'                => $totalCasos,
                'resueltos'            => $casosResueltos,
                'asociados'            => $casosAsociados,
                'porcentaje_asociados' => $porcentajeAsociados,
            ],
        ]);
    }

    public function importar(Request $request): RedirectResponse
    {
        $request->validate([
            'archivo' => 'required|file|mimes:xlsx,xls,csv|max:20480',
        ], [
            'archivo.required' => 'Debe seleccionar un archivo Excel o CSV.',
            'archivo.mimes'    => 'El archivo debe tener formato .xlsx, .xls o .csv.',
            'archivo.max'      => 'El archivo no debe pesar más de 20MB.',
        ]);

        $file = $request->file('archivo');
        $path = $file->getRealPath();

        try {
            $spreadsheet = IOFactory::load($path);
            $worksheet = $spreadsheet->getActiveSheet();
            $rows = $worksheet->toArray(null, true, true, true);
        } catch (\Exception $e) {
            Log::error('Error cargando Excel SAC: ' . $e->getMessage());
            return redirect()->back()->withErrors(['archivo' => 'Error al leer el archivo Excel: ' . $e->getMessage()]);
        }

        if (empty($rows) || count($rows) < 2) {
            return redirect()->back()->withErrors(['archivo' => 'El archivo Excel está vacío o no contiene filas de datos.']);
        }

        // Fila 1: Encabezados
        $headerRow = array_shift($rows);
        $columnIndexMap = [];

        foreach ($headerRow as $colLetter => $headerName) {
            $normHeader = $this->normalizeHeader((string) $headerName);
            if (isset(self::COLUMN_MAP[$normHeader])) {
                $columnIndexMap[$colLetter] = self::COLUMN_MAP[$normHeader];
            } else {
                // Intento fuzzy match
                $fuzzy = $this->fuzzyMatchHeader($normHeader);
                if ($fuzzy) {
                    $columnIndexMap[$colLetter] = $fuzzy;
                }
            }
        }

        if (empty($columnIndexMap)) {
            return redirect()->back()->withErrors(['archivo' => 'No se reconocieron las columnas requeridas en el encabezado del archivo.']);
        }

        // Cargar colaboradores para mapeo por nombre
        $colaboradores = Colaborador::select('id', 'nombres', 'apellidos', 'cedula')->get();
        $colabMap = [];

        $normStr = function (?string $val): string {
            if (!$val) return '';
            $s = mb_strtoupper($val, 'UTF-8');
            $s = strtr($s, ['Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U','Ñ'=>'N','Ü'=>'U']);
            return trim(preg_replace('/[^A-Z0-9]/', '', $s));
        };

        foreach ($colaboradores as $c) {
            $n1 = $normStr($c->nombres . ' ' . $c->apellidos);
            $n2 = $normStr($c->apellidos . ' ' . $c->nombres);
            if ($n1 !== '') $colabMap[$n1] = $c->id;
            if ($n2 !== '') $colabMap[$n2] = $c->id;
            if ($c->cedula) {
                $colabMap[$normStr($c->cedula)] = $c->id;
            }
        }

        // Palabras clave que indican filas de totales/resumen de tabla dinámica — se ignoran
        $filasTotalesPatrones = [
            'etiquetas de fila', 'etiquetas de columna',
            'total general', 'gran total', 'subtotal',
            'total ', '(en blanco)',
        ];

        $nuevos = 0;
        $batchData = [];

        foreach ($rows as $rowIndex => $row) {
            // Verificar si la fila está completamente vacía
            $hasData = false;
            foreach ($row as $val) {
                if ($val !== null && trim((string)$val) !== '') {
                    $hasData = true;
                    break;
                }
            }
            if (!$hasData) continue;

            // Detectar y saltar filas de totales / resumen de tabla dinámica
            $primerValor = mb_strtolower(trim((string)(reset($row) ?? '')), 'UTF-8');
            $primerValor = strtr($primerValor, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ñ'=>'n']);
            $esFila_total = false;
            foreach ($filasTotalesPatrones as $patron) {
                if (str_starts_with($primerValor, $patron) || $primerValor === rtrim($patron)) {
                    $esFila_total = true;
                    break;
                }
            }
            if ($esFila_total) continue;

            // Si el valor que iría al campo 'anio' no parece un año (4 dígitos entre 2000-2099), saltar
            $anioColLetter = array_search('anio', $columnIndexMap);
            if ($anioColLetter !== false) {
                $anioVal = trim((string)($row[$anioColLetter] ?? ''));
                if ($anioVal !== '' && (!is_numeric($anioVal) || (int)$anioVal < 2000 || (int)$anioVal > 2099)) {
                    Log::debug("SAC import: fila {$rowIndex} omitida — valor de año inválido: '{$anioVal}'");
                    continue;
                }
            }

            $record = [];
            foreach ($columnIndexMap as $colLetter => $field) {
                $rawVal = $row[$colLetter] ?? null;
                $record[$field] = $this->castValue($field, $rawVal);
            }

            // Asociar responsable con colaborador
            $responsableRaw = $record['responsable'] ?? null;
            if ($responsableRaw) {
                $normResp = $normStr($responsableRaw);
                if (isset($colabMap[$normResp])) {
                    $record['colaborador_id'] = $colabMap[$normResp];
                } else {
                    // Intento de búsqueda parcial de nombre
                    $matchedId = null;
                    foreach ($colabMap as $normName => $colabId) {
                        if ($normName !== '' && (str_contains($normName, $normResp) || str_contains($normResp, $normName))) {
                            $matchedId = $colabId;
                            break;
                        }
                    }
                    $record['colaborador_id'] = $matchedId;
                }
            } else {
                $record['colaborador_id'] = null;
            }

            $record['created_at'] = now();
            $record['updated_at'] = now();

            $batchData[] = $record;
            $nuevos++;
        }

        if (!empty($batchData)) {
            DB::transaction(function () use ($batchData) {
                foreach (array_chunk($batchData, 200) as $chunk) {
                    Sac::insert($chunk);
                }
            });
        }

        return redirect()->back()->with('success', "Se importaron exitosamente {$nuevos} registros de SAC.");
    }

    public function plantilla(): StreamedResponse
    {
        $headers = [
            'AÑO',
            'NUMERO DE CASO ESTANDAR',
            'NOMBRE DE LA CUENTA',
            'NOMBRE DEL CONTACTO',
            'FECHA',
            'DESCRIPCIÓN',
            'FECHA RESUELTO',
            'COMENTARIO',
            'APLICA',
            'MES',
            'SUBCATEGORIA',
            'MOTIVO QUEJA',
            'PLACA',
            'RESPONSABLE',
            'DOCUMENTO DE TRANSPORTE',
            'PLAN DE ACCION',
            'TIEMPO DE CIERRE CASO',
            '% SI/NO',
            'CUMPLIMIENTO CIERRE',
            'YTD',
            'hora',
        ];

        return response()->streamDownload(function () use ($headers) {
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('SAC');

            // Set headers in row 1
            $colIndex = 1;
            foreach ($headers as $header) {
                $sheet->setCellValueByColumnAndRow($colIndex++, 1, $header);
            }

            // Fila de ejemplo
            $sampleRow = [
                '2026',
                'CAS-1001-A',
                'Distribuidora Ejemplo S.A.S.',
                'Juan Pérez',
                '2026-09-01',
                'Novedad en entrega de pedido',
                '2026-09-02',
                'Atendido oportunamente',
                'SI',
                'Septiembre',
                'Entrega Errónea',
                'Error en mercancía',
                'AAA123',
                'Carlos Rodríguez',
                'DOC-98765',
                'Reemplazo de producto',
                '24',
                '100%',
                'A TIEMPO',
                'SI',
                '14:30',
            ];

            $colIndex = 1;
            foreach ($sampleRow as $val) {
                $sheet->setCellValueByColumnAndRow($colIndex++, 2, $val);
            }

            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
        }, 'plantilla_sac.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    public function exportar(Request $request): StreamedResponse
    {
        $search = trim($request->input('search', ''));
        $mes = trim($request->input('mes', ''));
        $anio = trim($request->input('anio', ''));
        $subcategoria = trim($request->input('subcategoria', ''));
        $responsable = trim($request->input('responsable', ''));

        $query = Sac::with('colaborador:id,nombres,apellidos,cedula');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('numero_caso_estandar', 'like', "%{$search}%")
                  ->orWhere('nombre_cuenta', 'like', "%{$search}%")
                  ->orWhere('nombre_contacto', 'like', "%{$search}%")
                  ->orWhere('descripcion', 'like', "%{$search}%")
                  ->orWhere('responsable', 'like', "%{$search}%")
                  ->orWhere('placa', 'like', "%{$search}%")
                  ->orWhere('motivo_queja', 'like', "%{$search}%");
            });
        }

        if ($mes !== '') {
            $query->where('mes', $mes);
        }

        if ($anio !== '') {
            $query->where('anio', $anio);
        }

        if ($subcategoria !== '') {
            $query->where('subcategoria', $subcategoria);
        }

        if ($responsable !== '') {
            $query->where('responsable', $responsable);
        }

        $registros = $query->orderBy('fecha', 'desc')->get();

        return response()->streamDownload(function () use ($registros) {
            $out = fopen('php://output', 'w');
            fputs($out, "\xEF\xBB\xBF"); // UTF-8 BOM

            fputcsv($out, [
                'ID',
                'AÑO',
                'NUMERO DE CASO ESTANDAR',
                'NOMBRE DE LA CUENTA',
                'NOMBRE DEL CONTACTO',
                'FECHA',
                'DESCRIPCIÓN',
                'FECHA RESUELTO',
                'COMENTARIO',
                'APLICA',
                'MES',
                'SUBCATEGORIA',
                'MOTIVO QUEJA',
                'PLACA',
                'RESPONSABLE EXCEL',
                'COLABORADOR SISTEMA',
                'DOCUMENTO DE TRANSPORTE',
                'PLAN DE ACCION',
                'TIEMPO DE CIERRE CASO',
                '% SI/NO',
                'CUMPLIMIENTO CIERRE',
                'YTD',
                'HORA',
            ], ';');

            foreach ($registros as $r) {
                $colabNombre = $r->colaborador
                    ? "{$r->colaborador->nombres} {$r->colaborador->apellidos} ({$r->colaborador->cedula})"
                    : 'No Asociado';

                fputcsv($out, [
                    $r->id,
                    $r->anio,
                    $r->numero_caso_estandar,
                    $r->nombre_cuenta,
                    $r->nombre_contacto,
                    $r->fecha ? $r->fecha->format('Y-m-d') : '',
                    $r->descripcion,
                    $r->fecha_resuelto ? $r->fecha_resuelto->format('Y-m-d') : '',
                    $r->comentario,
                    $r->aplica,
                    $r->mes,
                    $r->subcategoria,
                    $r->motivo_queja,
                    $r->placa,
                    $r->responsable,
                    $colabNombre,
                    $r->documento_transporte,
                    $r->plan_accion,
                    $r->tiempo_cierre_caso,
                    $r->porcentaje_si_no,
                    $r->cumplimiento_cierre,
                    $r->ytd,
                    $r->hora,
                ], ';');
            }

            fclose($out);
        }, 'sac_export.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function limpiar(): RedirectResponse
    {
        Sac::truncate();
        return redirect()->back()->with('success', 'Todos los registros de SAC han sido eliminados.');
    }

    // =========================================================================
    // HELPERS DE NORMALIZACIÓN Y CASTEO
    // =========================================================================

    private function normalizeHeader(string $str): string
    {
        $str = mb_strtolower(trim($str), 'UTF-8');
        $str = strtr($str, ['á'=>'a', 'é'=>'e', 'í'=>'i', 'ó'=>'o', 'ú'=>'u', 'ñ'=>'n', 'ü'=>'u']);
        return preg_replace('/\s+/', ' ', $str);
    }

    private function fuzzyMatchHeader(string $normHeader): ?string
    {
        // Solo hacer fuzzy match si el encabezado normalizado es razonablemente corto
        // (evita que textos largos de datos coincidan con claves cortas)
        if (mb_strlen($normHeader) > 60) return null;

        foreach (self::COLUMN_MAP as $key => $field) {
            $normKey = $this->normalizeHeader($key);
            // Coincidencia exacta tiene prioridad
            if ($normKey === $normHeader) return $field;
            // Coincidencia parcial solo si la clave tiene más de 4 caracteres
            if (mb_strlen($normKey) > 4 && (str_contains($normHeader, $normKey) || str_contains($normKey, $normHeader))) {
                return $field;
            }
        }
        return null;
    }

    private function castValue(string $field, mixed $val): mixed
    {
        if ($val === null) return null;
        $valStr = trim((string) $val);
        if ($valStr === '') return null;

        if (in_array($field, ['fecha', 'fecha_resuelto'])) {
            if (is_numeric($val)) {
                try {
                    return ExcelDate::excelToDateTimeObject($val)->format('Y-m-d');
                } catch (\Exception $e) {
                    return null;
                }
            }
            try {
                return Carbon::parse($valStr)->format('Y-m-d');
            } catch (\Exception $e) {
                return null;
            }
        }

        return $valStr;
    }
}
