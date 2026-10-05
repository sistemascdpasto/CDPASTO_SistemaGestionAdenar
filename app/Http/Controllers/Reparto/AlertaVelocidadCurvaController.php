<?php

namespace App\Http\Controllers\Reparto;

use App\Models\Reparto\AlertaVelocidadCurva;
use App\Models\Reparto\Modulacion;
use App\Models\Reparto\ModulacionItem;
use App\Models\Reparto\EventosTripulacion;
use App\Models\Flota\Vehiculo;
use App\Support\HojaCalculo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Carbon\Carbon;

class AlertaVelocidadCurvaController
{
    /**
     * Mostrar lista de alertas
     */
    public function index(Request $request): Response
    {
        $query = AlertaVelocidadCurva::query();

        // Filtro por rango de fechas
        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha', '>=', $request->input('fecha_desde'));
        }
        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha', '<=', $request->input('fecha_hasta'));
        }

        // Filtro por placa
        if ($request->filled('placa')) {
            $query->where('nombre', $request->input('placa'));
        }

        $alertas = $query->orderByDesc('fecha')->paginate(50);

        // Lista de placas únicas para el combobox
        $placas = AlertaVelocidadCurva::query()
            ->whereNotNull('nombre')
            ->distinct()
            ->orderBy('nombre')
            ->pluck('nombre');

        return Inertia::render('reparto/alertas-velocidad-curva/index', [
            'alertas' => $alertas,
            'placas'  => $placas,
            'filters' => [
                'fecha_desde' => $request->input('fecha_desde', ''),
                'fecha_hasta' => $request->input('fecha_hasta', ''),
                'placa'       => $request->input('placa', ''),
            ],
        ]);
    }

    /**
     * Procesar y subir archivo Excel con validaciones completas y detección de duplicados
     */
    public function store(Request $request)
    {
        // ── 1. Validar que el archivo exista y sea Excel/CSV ─────────────────
        $request->validate([
            'archivo' => 'required|file|mimes:xlsx,xls,csv',
        ]);

        try {
            $file        = $request->file('archivo');
            $spreadsheet = HojaCalculo::cargar($file->getPathname());
            $sheet       = $spreadsheet->getActiveSheet();

            $highestRow = $sheet->getHighestDataRow();
            $highestCol = $sheet->getHighestDataColumn();

            // ── 2. Leer encabezados (fila 1) ─────────────────────────────────
            $header   = [];
            $colIndex = 0;
            foreach ($sheet->getRowIterator(1, 1) as $row) {
                foreach ($row->getCellIterator('A', $highestCol) as $cell) {
                    $header[$colIndex] = trim((string) $cell->getValue());
                    $colIndex++;
                }
            }

            \Log::info('Headers importación: ' . json_encode($header));

            // ── 3. Validar columnas mínimas requeridas ────────────────────────
            $columnasRequeridas = ['Fecha', 'Placa', 'Alerta'];
            foreach ($columnasRequeridas as $col) {
                $encontrada = false;
                $colNorm    = strtolower(trim($col));
                foreach ($header as $h) {
                    $hNorm = strtolower(trim(preg_replace('/\s+/', ' ', $h)));
                    if ($hNorm === $colNorm || str_starts_with($hNorm, $colNorm)) {
                        $encontrada = true;
                        break;
                    }
                }
                if (!$encontrada) {
                    return back()->withErrors([
                        'archivo' => "El archivo no contiene la columna requerida: \"{$col}\". Revisa que el encabezado esté escrito correctamente.",
                    ]);
                }
            }

            // ── 4. Precargar placas válidas (1 sola query) ────────────────────
            $placasValidas = array_flip(Vehiculo::pluck('placa')->toArray());

            // ── 5. Precargar hashes existentes (detección de duplicados) ──────
            $hashesExistentes = array_flip(
                AlertaVelocidadCurva::whereNotNull('hash')->pluck('hash')->toArray()
            );

            // ── 6. Validar que haya al menos una fecha válida ─────────────────
            $hayFechaValida = false;
            for ($r = 2; $r <= min($highestRow, 10); $r++) {
                $celdaFecha = null;
                $ci = 0;
                foreach ($sheet->getRowIterator($r, $r) as $row) {
                    foreach ($row->getCellIterator('A', $highestCol) as $cell) {
                        $hNorm = strtolower(trim(preg_replace('/\s+/', ' ', $header[$ci] ?? '')));
                        if ($hNorm === 'fecha' || str_starts_with($hNorm, 'fecha')) {
                            $celdaFecha = $cell->getValue();
                            break 2;
                        }
                        $ci++;
                    }
                }
                if ($celdaFecha !== null && $celdaFecha !== '') {
                    $hayFechaValida = true;
                    break;
                }
            }

            if (!$hayFechaValida) {
                return back()->withErrors([
                    'archivo' => 'El archivo no contiene ninguna fecha válida en la columna "Fecha".',
                ]);
            }

            // ── 7. Procesar filas ─────────────────────────────────────────────
            $processed       = 0;
            $rejected        = 0;
            $duplicados      = 0;
            $fechaErrors     = [];
            $placasLeidas    = [];
            $placasEncontradas = [];
            $placasRechazadas  = [];
            $dataToInsert    = [];

            for ($rowNum = 2; $rowNum <= $highestRow; $rowNum++) {

                // Leer valores de la fila con detección correcta de hora vs fecha
                $rowValues = [];
                $ci        = 0;
                foreach ($sheet->getRowIterator($rowNum, $rowNum) as $row) {
                    foreach ($row->getCellIterator('A', $highestCol) as $cell) {
                        $rawValue = $cell->getValue();

                        if (\PhpOffice\PhpSpreadsheet\Shared\Date::isDateTime($cell) && $rawValue !== null) {
                            try {
                                $dt = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($rawValue);
                                if ((float) $rawValue < 1) {
                                    // Hora pura (fracción del día)
                                    $rowValues[$ci] = $dt->format('H:i:s');
                                } else {
                                    $horaStr = $dt->format('H:i:s');
                                    $rowValues[$ci] = $horaStr !== '00:00:00'
                                        ? $horaStr
                                        : $dt->format('d/m/Y');
                                }
                            } catch (\Exception $e) {
                                $rowValues[$ci] = $cell->getFormattedValue();
                            }
                        } else {
                            $rowValues[$ci] = ($rawValue !== null && $rawValue !== '') ? (string) $rawValue : null;
                        }

                        $ci++;
                    }
                }

                // Mapear columnas
                $fecha     = $this->detectAndGetValue($rowValues, $header, ['Fecha', 'fecha']);
                $horaRaw   = $this->detectAndGetValue($rowValues, $header, ['Hora', 'hora']);
                $regional  = $this->detectAndGetValue($rowValues, $header, ['Regional', 'regional']);
                $cd        = $this->detectAndGetValue($rowValues, $header, ['CD', 'cd']);
                $placa     = $this->detectAndGetValue($rowValues, $header, ['Placa', 'placa']);
                $alerta    = $this->detectAndGetValue($rowValues, $header, ['Alerta', 'alerta']);
                $velocidad = $this->detectAndGetValue($rowValues, $header, ['Velocidad', 'velocidad']);
                $coordenada= $this->detectAndGetValue($rowValues, $header, ['Coordenada', 'coordenada']);
                $cantidad  = $this->detectAndGetValue($rowValues, $header, ['Cantidad de Eventos', 'cantidad de eventos', 'Cantidad', 'cantidad']);
                $mes       = $this->detectAndGetValue($rowValues, $header, ['mes', 'Mes']);

                // Normalizar hora (soporta 24h, 12h AM/PM en español como "08:20:00 a. m.")
                $hora = null;
                if ($horaRaw) {
                    $strHora = trim((string) $horaRaw);
                    $isPm = (bool) preg_match('/p\.\s*m\.|pm/i', $strHora);
                    $isAm = (bool) preg_match('/a\.\s*m\.|am/i', $strHora);
                    $strHoraClean = trim(preg_replace('/\s*(a\.\s*m\.|p\.\s*m\.|am|pm)/i', '', $strHora));

                    if (preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/', $strHoraClean, $m)) {
                        $h = (int) $m[1];
                        $i = (int) $m[2];
                        $s = isset($m[3]) ? (int) $m[3] : 0;
                        if ($isPm && $h < 12) $h += 12;
                        if ($isAm && $h === 12) $h = 0;
                        $hora = sprintf('%02d:%02d:%02d', $h, $i, $s);
                    } elseif (preg_match('/\s+(\d{1,2}:\d{2}(:\d{2})?)$/', $strHoraClean, $m)) {
                        $hora = $m[1];
                    } elseif (!preg_match('/^\d{1,2}\/\d{1,2}\/\d{4}$/', $strHoraClean)) {
                        $hora = $strHoraClean !== '' ? $strHoraClean : null;
                    }
                }

                // Fila vacía
                if (!$placa && !$alerta) {
                    continue;
                }

                // ── Construir fecha con día de "Fecha" + mes de "Mes" + año de "Fecha" ──
                //
                // Regla fija:
                //   - El campo "Fecha" aporta el DÍA y el AÑO  (ej: "01/08/2026" → día=01, año=2026)
                //   - El campo "Mes"   aporta el MES             (ej: "Agosto"     → mes=8)
                //   - Resultado: 2026-08-01
                //
                // Esto evita cualquier ambigüedad d/m vs m/d: el mes siempre viene
                // explícito en la columna "Mes" y nunca se adivina.

                // Paso A: convertir el nombre/número del mes del Excel a entero 1-12
                $mesExcel = null;
                if ($mes !== null && $mes !== '') {
                    $mesStr = trim((string) $mes);
                    if (!str_starts_with($mesStr, '=')) {
                        $mesExcel = $this->parseMesTexto($mesStr);
                    }
                }

                // Paso B: extraer día y año del campo Fecha
                $fechaParsed = null;
                if ($fecha) {
                    $valFecha = trim((string) $fecha);

                    // Intentar extraer día y año del string
                    $dia = null;
                    $anio = null;

                    // Formato d/m/Y, d-m-Y, d.m.Y  → posición 0=día, 1=mes_ignorado, 2=año
                    if (preg_match('/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/', $valFecha, $p)) {
                        $dia  = (int) $p[1];
                        $anio = (int) $p[3];
                    }
                    // Formato Y-m-d, Y/m/d → posición 0=año, 1=mes_ignorado, 2=día
                    elseif (preg_match('/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/', $valFecha, $p)) {
                        $anio = (int) $p[1];
                        $dia  = (int) $p[3];
                    }
                    // Serial numérico de Excel
                    elseif (is_numeric($valFecha) && (float) $valFecha > 30000) {
                        try {
                            $dt   = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $valFecha);
                            $dia  = (int) $dt->format('d');
                            $anio = (int) $dt->format('Y');
                            // Si no hay mes del Excel, usar el del serial
                            if ($mesExcel === null) {
                                $mesExcel = (int) $dt->format('m');
                            }
                        } catch (\Exception $e) { /* se intentará parseFecha como fallback */ }
                    }

                    // Paso C: si tenemos día + mes del Excel + año → construir fecha final
                    if ($dia !== null && $anio !== null && $mesExcel !== null) {
                        // Validar que día y mes sean coherentes
                        if ($dia >= 1 && $dia <= 31 && $mesExcel >= 1 && $mesExcel <= 12) {
                            try {
                                $fechaParsed = Carbon::createFromDate($anio, $mesExcel, $dia)->format('Y-m-d');
                            } catch (\Exception $e) {
                                $fechaErrors[] = "Fila {$rowNum}: fecha inválida día={$dia} mes={$mesExcel} año={$anio}";
                            }
                        }
                    }
                    // Fallback: si no hay mes del Excel, parsear la fecha completa
                    elseif ($mesExcel === null) {
                        $fechaParsed = $this->parseFecha($valFecha);
                        if (!$fechaParsed) {
                            $fechaErrors[] = "Fila {$rowNum}: no se pudo parsear '{$fecha}'";
                        } else {
                            // Derivar mes de la fecha parseada
                            $mesExcel = (int) Carbon::createFromFormat('Y-m-d', $fechaParsed)->format('m');
                        }
                    } else {
                        $fechaErrors[] = "Fila {$rowNum}: no se pudo extraer día/año de '{$fecha}'";
                    }
                }

                // El mes que se guarda es siempre el del Excel (ya resuelto arriba)
                $mesGuardar = $mesExcel;

                // Validar placa en Flota
                if ($placa) {
                    $placaUpper    = strtoupper(trim($placa));
                    $placasLeidas[] = $placaUpper;

                    if (!isset($placasValidas[$placaUpper])) {
                        $rejected++;
                        $placasRechazadas[] = $placaUpper;
                        continue;
                    }

                    $placasEncontradas[] = $placaUpper;
                    $placa = $placaUpper;
                }

                // ── Generar hash y detectar duplicados ────────────────────────
                $hash = md5(
                    ($placa      ?? '') .
                    ($fechaParsed ?? '') .
                    ($hora        ?? '') .
                    ($alerta      ?? '') .
                    ($velocidad   ?? '')
                );

                if (isset($hashesExistentes[$hash])) {
                    $duplicados++;
                    continue;
                }

                // Marcar como visto para evitar duplicados dentro del mismo archivo
                $hashesExistentes[$hash] = true;

                $dataToInsert[] = [
                    'fecha'            => $fechaParsed,
                    'hora'             => $hora,
                    'regional'         => $regional,
                    'cd'               => $cd,
                    'nombre'           => $placa ?? $alerta,
                    'alerta'           => $alerta,
                    'velocidad'        => is_numeric($velocidad) ? (float) $velocidad : null,
                    'coordenada'       => $coordenada,
                    'cantidad_eventos' => is_numeric($cantidad) ? (int) $cantidad : null,
                    'mes'              => $mesGuardar !== null ? (int) $mesGuardar : null,
                    'hash'             => $hash,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ];

                $processed++;
            }

            // ── 8. Insertar en lotes de 500 ───────────────────────────────────
            foreach (array_chunk($dataToInsert, 500) as $chunk) {
                AlertaVelocidadCurva::insert($chunk);
            }

            // ── 9. Reporte final ──────────────────────────────────────────────
            $placasLeidasUnique      = array_unique($placasLeidas);
            $placasEncontradasUnique = array_unique($placasEncontradas);
            $placasRechazadasUnique  = array_unique($placasRechazadas);

            $message  = "📊 REPORTE DE IMPORTACIÓN\n";
            $message .= "• Placas leídas: "         . count($placasLeidasUnique)      . "\n";
            $message .= "• Placas en Flota (BD): "  . count($placasEncontradasUnique) . "\n";
            $message .= "• Placas rechazadas: "      . count($placasRechazadasUnique)  . "\n";
            $message .= "✅ Alertas guardadas: {$processed}\n";

            if ($duplicados > 0) {
                $message .= "⏭️ Duplicados omitidos: {$duplicados}\n";
            }
            if ($rejected > 0) {
                $message .= "⚠️ Filas rechazadas (placa inválida): {$rejected}\n";
                if (count($placasRechazadasUnique) <= 10) {
                    $message .= "Placas no válidas: " . implode(', ', $placasRechazadasUnique) . "\n";
                }
            }
            if (!empty($fechaErrors)) {
                $message .= "\n⚠️ Errores de fecha (" . count($fechaErrors) . "):\n";
                foreach (array_slice($fechaErrors, 0, 5) as $err) {
                    $message .= "  • {$err}\n";
                }
            }

            return redirect()->route('reparto.alertas-velocidad-curva.index')
                ->with('success', $message);

        } catch (\Exception $e) {
            \Log::error('Error en AlertaVelocidadCurva::store', ['error' => $e->getMessage()]);
            return back()->withErrors(['archivo' => 'Error al procesar el archivo: ' . $e->getMessage()]);
        }
    }

    /**
     * Crear alerta manualmente
     */
    public function storeManual(Request $request)
    {
        $validated = $request->validate([
            'fecha' => 'required|date',
            'nombre' => 'nullable|string|max:255',
            'alerta' => 'nullable|string|max:255',
            'velocidad' => 'nullable|numeric',
            'coordenada' => 'nullable|string|max:255',
            'cantidad_eventos' => 'nullable|integer|min:0',
            'mes' => 'nullable|integer|min:1|max:12',
        ]);

        try {
            $fecha = Carbon::parse($validated['fecha'])->format('Y-m-d');
            
            // Si no hay mes, calcularlo desde la fecha
            if (!$validated['mes']) {
                $validated['mes'] = Carbon::parse($fecha)->format('m');
            }

            AlertaVelocidadCurva::create([
                'fecha' => $fecha,
                'nombre' => $validated['nombre'],
                'alerta' => $validated['alerta'],
                'velocidad' => $validated['velocidad'],
                'coordenada' => $validated['coordenada'],
                'cantidad_eventos' => $validated['cantidad_eventos'],
                'mes' => $validated['mes'],
            ]);

            return redirect()->route('reparto.alertas-velocidad-curva.index')
                ->with('success', '✅ Alerta creada manualmente.');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Error al crear alerta: ' . $e->getMessage()]);
        }
    }

    /**
     * Actualizar alerta
     */
    public function updateAlerta(Request $request, $id)
    {
        $validated = $request->validate([
            'fecha' => 'required|date',
            'nombre' => 'nullable|string|max:255',
            'alerta' => 'nullable|string|max:255',
            'velocidad' => 'nullable|numeric',
            'coordenada' => 'nullable|string|max:255',
            'cantidad_eventos' => 'nullable|integer|min:0',
            'mes' => 'nullable|integer|min:1|max:12',
        ]);

        try {
            $alerta = AlertaVelocidadCurva::findOrFail($id);
            $fecha = Carbon::parse($validated['fecha'])->format('Y-m-d');
            
            if (!$validated['mes']) {
                $validated['mes'] = Carbon::parse($fecha)->format('m');
            }

            $alerta->update([
                'fecha' => $fecha,
                'nombre' => $validated['nombre'],
                'alerta' => $validated['alerta'],
                'velocidad' => $validated['velocidad'],
                'coordenada' => $validated['coordenada'],
                'cantidad_eventos' => $validated['cantidad_eventos'],
                'mes' => $validated['mes'],
            ]);

            return redirect()->route('reparto.alertas-velocidad-curva.index')
                ->with('success', '✅ Alerta actualizada.');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Error al actualizar alerta: ' . $e->getMessage()]);
        }
    }

    /**
     * Eliminar alerta
     */
    public function deleteAlerta($id)
    {
        try {
            $alerta = AlertaVelocidadCurva::findOrFail($id);
            
            // Si hay eventos de tripulación asociados, también eliminarlos
            EventosTripulacion::where('fecha', $alerta->fecha)
                ->where('placa', $alerta->nombre)
                ->delete();

            $alerta->delete();

            return redirect()->route('reparto.alertas-velocidad-curva.index')
                ->with('success', '✅ Alerta eliminada.');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Error al eliminar alerta: ' . $e->getMessage()]);
        }
    }

    /**
     * Descargar plantilla Excel
     */
    public function downloadTemplate()
    {
        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        $headers = ['Fecha', 'Nombre', 'Alerta', 'Velocidad', 'Coordenada', 'Cantidad de Eventos', 'mes'];
        foreach ($headers as $col => $header) {
            $sheet->setCellValueByColumnAndRow($col + 1, 1, $header);
        }

        $headerStyle = [
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'FF0000'],
            ],
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
            ],
        ];
        $sheet->getStyle('A1:G1')->applyFromArray($headerStyle);

        foreach ($headers as $col => $header) {
            $sheet->getColumnDimension($col + 1)->setAutoSize(true);
        }

        $writer = \PhpOffice\PhpSpreadsheet\Writer\Xlsx::class;
        $response = response()->streamDownload(function () use ($spreadsheet, $writer) {
            (new $writer($spreadsheet))->save('php://output');
        }, 'plantilla-alertas-velocidad-curva.xlsx');

        return $response;
    }

    /**
     * Detectar y obtener valor de una fila según opciones case-insensitive.
     * Soporta headers con basura extra al final (ej: "Fecha+J2A1:J2439").
     * Usa startsWith para tolerar caracteres extra pegados al nombre de columna.
     */
    private function detectAndGetValue(array $row, array $header, array $opciones): mixed
    {
        foreach ($opciones as $columnName) {
            $columnNorm = strtolower(trim(preg_replace('/\s+/', ' ', $columnName)));

            foreach ($header as $pos => $headerName) {
                // Normalizar header: lowercase + trim + colapsar espacios
                $headerNorm = strtolower(trim(preg_replace('/\s+/', ' ', $headerName)));

                // Coincidencia exacta o el header EMPIEZA con el nombre buscado
                // (cubre casos como "Fecha+J2A1:J2439" donde el header tiene basura extra)
                if ($headerNorm === $columnNorm || str_starts_with($headerNorm, $columnNorm)) {
                    $value = $row[$pos] ?? null;
                    return $value !== null && $value !== '' ? $value : null;
                }
            }
        }
        return null;
    }

    /**
     * Parsear fecha desde un valor de celda Excel.
     * - Si es serial numérico → Date::excelToDateTimeObject
     * - Si es string → Carbon con múltiples formatos (prioridad d/m/Y latinoamericano)
     */
    private function parseFecha($fechaValue): ?string
    {
        if ($fechaValue === null || $fechaValue === '') {
            return null;
        }

        $val = trim((string) $fechaValue);

        try {
            // 1. Serial numérico de Excel (ej: 46849)
            if (is_numeric($val) && (float) $val > 30000) {
                $dt = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $val);
                return Carbon::instance($dt)->format('Y-m-d');
            }

            // 2. d/m/Y — formato latinoamericano (prioridad máxima para este proyecto)
            if (preg_match('/^\d{1,2}\/\d{1,2}\/\d{4}$/', $val)) {
                return Carbon::createFromFormat('d/m/Y', $val)->format('Y-m-d');
            }

            // 3. Otros formatos conocidos
            $formatos = ['Y-m-d', 'd-m-Y', 'm/d/Y', 'Y/m/d', 'd.m.Y', 'Y.m.d', 'd/m/y', 'd-m-y'];
            foreach ($formatos as $fmt) {
                try {
                    return Carbon::createFromFormat($fmt, $val)->format('Y-m-d');
                } catch (\Exception $e) {
                    // probar siguiente
                }
            }

            // 4. Parse genérico como último recurso
            return Carbon::parse($val)->format('Y-m-d');

        } catch (\Exception $e) {
            \Log::warning("No se pudo parsear fecha: '{$val}' — " . $e->getMessage());
            return null;
        }
    }

    /**
     * Procesar eventos de tripulación desde alertas existentes
     * (Se ejecuta DESPUÉS de la importación para evitar búsquedas lentas)
     */
    private function processEventosTripulacion(): void
    {
        try {
            $alertas = AlertaVelocidadCurva::whereNotNull('fecha')
                ->whereNotNull('nombre')
                ->whereNotNull('cantidad_eventos')
                ->get();

            foreach ($alertas as $alerta) {
                $placa = strtoupper(trim($alerta->nombre));
                $fecha = $alerta->fecha;
                $totalEventos = $alerta->cantidad_eventos;

                try {
                    // Buscar modulación por fecha y placa
                    $modulacion = Modulacion::whereHas('items', function ($q) use ($placa) {
                        $q->where('placa', $placa);
                    })
                        ->whereDate('fecha', $fecha)
                        ->with('items')
                        ->first();

                    if (!$modulacion) continue;

                    // Obtener item de la ruta con esta placa
                    $item = $modulacion->items()->where('placa', $placa)->first();
                    if (!$item || !$item->tripulacion) continue;

                    // Crear o actualizar registro para cada persona en la tripulación
                    foreach ($item->tripulacion as $persona) {
                        $documento = $persona['cedula'] ?? $persona['documento'] ?? null;
                        $nombre = $persona['nombres'] ?? $persona['nombre'] ?? null;

                        if (!$nombre) continue;

                        EventosTripulacion::updateOrCreate(
                            [
                                'fecha' => $fecha,
                                'placa' => $placa,
                                'documento' => $documento,
                            ],
                            [
                                'nombre' => $nombre,
                                'cargo' => $persona['cargo'] ?? null,
                                'total_eventos' => $totalEventos,
                            ]
                        );
                    }
                } catch (\Exception $e) {
                    continue;
                }
            }
        } catch (\Exception $e) {
            \Log::error('Error procesando eventos de tripulación', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Convertir nombre de mes (español o inglés) a número 1-12.
     * Acepta: "Enero", "enero", "ENERO", "Jan", "january", números como "1", "01", etc.
     * Devuelve null si no se puede interpretar o está fuera de rango.
     */
    private function parseMesTexto(string $valor): ?int
    {
        $v = strtolower(trim($valor));

        // Si ya es numérico (ej: "8", "08") devolver directamente
        if (is_numeric($v)) {
            $n = (int) $v;
            return ($n >= 1 && $n <= 12) ? $n : null;
        }

        // Ignorar fórmulas Excel
        if (str_starts_with($v, '=')) {
            return null;
        }

        $meses = [
            // Español completo
            'enero'      => 1,  'febrero'   => 2,  'marzo'     => 3,
            'abril'      => 4,  'mayo'      => 5,  'junio'     => 6,
            'julio'      => 7,  'agosto'    => 8,  'septiembre'=> 9,
            'octubre'    => 10, 'noviembre' => 11, 'diciembre' => 12,
            // Español abreviado
            'ene' => 1, 'feb' => 2, 'mar' => 3,
            'abr' => 4, 'may' => 5, 'jun' => 6,
            'jul' => 7, 'ago' => 8, 'sep' => 9, 'set' => 9,
            'oct' => 10, 'nov' => 11, 'dic' => 12,
            // Inglés completo
            'january'   => 1,  'february' => 2,  'march'    => 3,
            'april'     => 4,  'may'      => 5,  'june'     => 6,
            'july'      => 7,  'august'   => 8,  'september'=> 9,
            'october'   => 10, 'november' => 11, 'december' => 12,
            // Inglés abreviado
            'jan' => 1, 'feb' => 2, 'mar' => 3,
            'apr' => 4,             'jun' => 6,
            'jul' => 7, 'aug' => 8, 'sep' => 9,
            'oct' => 10,'nov' => 11,'dec' => 12,
        ];

        return $meses[$v] ?? null;
    }
}
