<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Models\Reparto\Cliente;
use App\Services\Reparto\ModulacionUbicacionesService;
use App\Support\HojaCalculo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ClienteController extends Controller
{
    // Mapa de encabezados del Excel → campo del modelo
    private const COLUMN_MAP = [
        'codigocliente'     => 'codigo_cliente',
        'codigo_cliente'    => 'codigo_cliente',
        'codigo cliente'    => 'codigo_cliente',
        'cliente'           => 'cliente',
        'propietario'       => 'propietario',
        'identificacion'    => 'identificacion',
        'identificación'    => 'identificacion',
        'longitud'          => 'longitud',
        'latitud'           => 'latitud',
        'barrio'            => 'barrio',
        'direccion'         => 'direccion',
        'dirección'         => 'direccion',
        'departamento'      => 'departamento',
        'municipio'         => 'municipio',
        'actividadeconomica'=> 'actividad_economica',
        'actividad_economica'=> 'actividad_economica',
        'actividad economica'=> 'actividad_economica',
        'actividad económica'=> 'actividad_economica',
        'telefonos'         => 'telefonos',
        'teléfonos'         => 'telefonos',
        'correoelectronico' => 'correo_electronico',
        'correo_electronico'=> 'correo_electronico',
        'correo electronico'=> 'correo_electronico',
        'correo electrónico'=> 'correo_electronico',
        'email'             => 'correo_electronico',
    ];

    public function index(Request $request): Response
    {
        // Si la tabla aún no existe (migración pendiente) mostrar vista vacía
        if (! \Illuminate\Support\Facades\Schema::hasTable('reparto_clientes')) {
            return Inertia::render('reparto/clientes/index', [
                'clientes'   => ['data' => [], 'links' => [], 'total' => 0],
                'municipios' => [],
                'barrios'    => [],
                'filters'    => ['search' => '', 'municipio' => '', 'barrio' => ''],
                'total'      => 0,
            ]);
        }

        $search    = $request->string('search')->trim()->toString();
        $municipio = $request->string('municipio')->trim()->toString();
        $barrio    = $request->string('barrio')->trim()->toString();

        $clientes = Cliente::query()
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($q2) use ($search) {
                    $q2->where('codigo_cliente', 'like', "%{$search}%")
                        ->orWhere('cliente', 'like', "%{$search}%")
                        ->orWhere('propietario', 'like', "%{$search}%")
                        ->orWhere('identificacion', 'like', "%{$search}%");
                });
            })
            ->when($municipio !== '', fn ($q) => $q->where('municipio', 'like', "%{$municipio}%"))
            ->when($barrio !== '', fn ($q) => $q->where('barrio', 'like', "%{$barrio}%"))
            ->orderBy('municipio')
            ->orderBy('barrio')
            ->orderBy('cliente')
            ->paginate(50)
            ->withQueryString();

        $municipios = Cliente::selectRaw('DISTINCT municipio')
            ->whereNotNull('municipio')
            ->orderBy('municipio')
            ->pluck('municipio');

        $barrios = Cliente::selectRaw('DISTINCT barrio')
            ->whereNotNull('barrio')
            ->when($municipio !== '', fn ($q) => $q->where('municipio', 'like', "%{$municipio}%"))
            ->orderBy('barrio')
            ->pluck('barrio');

        return Inertia::render('reparto/clientes/index', [
            'clientes'   => $clientes,
            'municipios' => $municipios,
            'barrios'    => $barrios,
            'filters'    => ['search' => $search, 'municipio' => $municipio, 'barrio' => $barrio],
            'total'      => Cliente::count(),
        ]);
    }

    public function importar(Request $request, ModulacionUbicacionesService $ubicaciones): RedirectResponse
    {
        $request->validate([
            'archivo' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
        ]);

        $path        = $request->file('archivo')->getRealPath();
        $spreadsheet = HojaCalculo::cargar($path);
        $sheet       = $spreadsheet->getActiveSheet();
        $rows        = HojaCalculo::filas($sheet, true, false);

        if (count($rows) < 2) {
            return back()->with('error', 'El archivo no contiene datos.');
        }

        // Detectar encabezados en la primera fila
        $headers = array_map(
            fn ($v) => strtolower(trim(preg_replace('/\s+/', ' ', (string) ($v ?? '')))),
            $rows[0]
        );

        $colMap = [];
        foreach ($headers as $idx => $header) {
            $mapped = self::COLUMN_MAP[$header] ?? null;
            if ($mapped && ! isset($colMap[$mapped])) {
                $colMap[$mapped] = $idx;
            }
        }

        if (! isset($colMap['codigo_cliente'])) {
            return back()->with('error', 'No se encontró la columna CodigoCliente en el archivo.');
        }

        $insertados  = 0;
        $actualizados = 0;
        $errores     = 0;

        foreach (array_slice($rows, 1) as $row) {
            $codigoRaw = $row[$colMap['codigo_cliente']] ?? null;
            if ($codigoRaw === null || trim((string) $codigoRaw) === '') {
                continue;
            }

            $codigo = trim((string) $codigoRaw);
            // Si viene como float (ej: 10420443.0) lo convertimos a entero string
            if (is_float($codigoRaw)) {
                $codigo = (string) (int) $codigoRaw;
            }

            $datos = ['codigo_cliente' => $codigo];

            foreach ($colMap as $campo => $idx) {
                if ($campo === 'codigo_cliente') continue;
                $valor = $row[$idx] ?? null;
                if ($valor === null || trim((string) $valor) === '') {
                    $datos[$campo] = null;
                    continue;
                }
                // Coordenadas: normalizar y convertir a float
                // Casos comunes en archivos Excel colombianos/europeos:
                //   "1,234567"   → separador decimal con coma → "1.234567"
                //   "1.234,567"  → miles con punto, decimal con coma → "1234.567"
                //   "1,234.567"  → miles con coma, decimal con punto → "1234.567"
                //   "1234567"    → entero sin decimales → válido directo
                if (in_array($campo, ['longitud', 'latitud'], true)) {
                    $raw = trim((string) $valor);
                    // Quitar espacios y símbolo de grado si alguien lo pone
                    $raw = str_replace(['°', ' '], '', $raw);
                    // Notación científica (ej: PhpSpreadsheet con formato aplicado)
                    if (preg_match('/^-?\d+\.?\d*[eE][+\-]?\d+$/', $raw)) {
                        $datos[$campo] = (float) $raw;
                        continue;
                    }

                    $tienePunto   = str_contains($raw, '.');
                    $tieneComa    = str_contains($raw, ',');
                    $cantComas    = substr_count($raw, ',');
                    $cantPuntos   = substr_count($raw, '.');

                    if ($tienePunto && $tieneComa) {
                        // Ambos separadores presentes: el que aparece último es el decimal
                        $posUltimoPunto = strrpos($raw, '.');
                        $posUltimaComa  = strrpos($raw, ',');
                        if ($posUltimaComa > $posUltimoPunto) {
                            // Europeo: -77.080.293,456 → quitar puntos, coma→punto
                            $raw = str_replace(['.', ','], ['', '.'], $raw);
                        } else {
                            // Americano: -77,080,293.456 → quitar comas
                            $raw = str_replace(',', '', $raw);
                        }
                    } elseif ($tieneComa) {
                        if ($cantComas > 1) {
                            // Múltiples comas → todas son separadores de miles: -77,080,293
                            // La última porción tiene exactamente 3 dígitos en cada grupo
                            $raw = str_replace(',', '', $raw);
                        } else {
                            // Una sola coma: decimal europeo si parte decimal ≠ 3 dígitos,
                            // separador de miles si son exactamente 3 dígitos
                            $partes = explode(',', $raw);
                            $decimales = end($partes);
                            if (strlen(ltrim($decimales, '-')) !== 3) {
                                $raw = str_replace(',', '.', $raw);
                            } else {
                                $raw = str_replace(',', '', $raw);
                            }
                        }
                    } elseif ($tienePunto && $cantPuntos > 1) {
                        // Múltiples puntos → todos son separadores de miles: -77.080.293
                        $raw = str_replace('.', '', $raw);
                    }
                    // Si solo tiene un punto → ya es formato estándar float

                    $datos[$campo] = is_numeric($raw) ? (float) $raw : null;

                    // Sanity check para coordenadas colombianas:
                    // Si el valor resultante es un entero de magnitud irreal (>360 en abs),
                    // probablemente el Excel tiene el punto decimal implícito (ej: -77080293 → -77.080293)
                    if ($datos[$campo] !== null && abs($datos[$campo]) > 360) {
                        $negativo = $datos[$campo] < 0;
                        $digits   = ltrim((string) (int) abs($datos[$campo]), '0') ?: '0';
                        // Coordenadas colombianas: lon [-79,-66], lat [-4,13]
                        // Probar insertar el punto después de 1, 2 y 3 dígitos y elegir el primero válido
                        $reconstruido = null;
                        foreach ([1, 2, 3] as $enteraDigitos) {
                            if (strlen($digits) <= $enteraDigitos) continue;
                            $candidato = ($negativo ? '-' : '')
                                . substr($digits, 0, $enteraDigitos)
                                . '.'
                                . substr($digits, $enteraDigitos);
                            $f = (float) $candidato;
                            // Rango válido global de coordenadas
                            if ($f >= -180 && $f <= 180) {
                                $reconstruido = $f;
                                break;
                            }
                        }
                        $datos[$campo] = $reconstruido;
                    }
                } else {
                    $datos[$campo] = trim((string) $valor);
                }
            }

            try {
                $existe = Cliente::where('codigo_cliente', $codigo)->first();
                if ($existe) {
                    $existe->update($datos);
                    $actualizados++;
                } else {
                    Cliente::create($datos);
                    $insertados++;
                }
            } catch (\Throwable) {
                $errores++;
            }
        }

        $msg = "Importación completada: {$insertados} nuevos, {$actualizados} actualizados.";
        if ($errores > 0) {
            $msg .= " {$errores} filas con error.";
        }

        // Sincronizar municipios y barrios al catálogo de ubicaciones de planeación
        $this->sincronizarUbicaciones($colMap, array_slice($rows, 1), $ubicaciones);

        return back()->with('status', $msg);
    }

    /**
     * Registra cada par municipio+barrio del Excel en modulacion_municipios / modulacion_barrios.
     * Usa registrarMunicipio() y registrarBarrio() del servicio para respetar la lógica
     * de normalización y deduplicación ya establecida.
     */
    private function sincronizarUbicaciones(array $colMap, array $rows, ModulacionUbicacionesService $ubicaciones): void
    {
        $colMunicipio = $colMap['municipio'] ?? null;
        $colBarrio    = $colMap['barrio'] ?? null;

        if ($colMunicipio === null) {
            return;
        }

        foreach ($rows as $row) {
            $nombreMunicipio = trim((string) ($row[$colMunicipio] ?? ''));
            if ($nombreMunicipio === '') {
                continue;
            }

            try {
                $municipio = $ubicaciones->registrarMunicipio($nombreMunicipio);

                if ($colBarrio !== null) {
                    $nombreBarrio = trim((string) ($row[$colBarrio] ?? ''));
                    if ($nombreBarrio !== '') {
                        $ubicaciones->registrarBarrio($municipio['id'], $nombreBarrio);
                    }
                }
            } catch (\Throwable) {
                // No interrumpir la importación si falla la sincronización de una fila
            }
        }
    }

    public function destroy(Cliente $cliente): RedirectResponse
    {
        $cliente->delete();

        return back()->with('status', 'Cliente eliminado correctamente.');
    }

    public function destroyAll(): RedirectResponse
    {
        Cliente::truncate();

        return back()->with('status', 'Todos los clientes han sido eliminados.');
    }
}
