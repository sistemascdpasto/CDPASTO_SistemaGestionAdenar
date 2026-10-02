<?php

namespace App\Http\Controllers\Reparto;

use App\Http\Controllers\Controller;
use App\Models\Reparto\Cliente;
use App\Services\Reparto\ModulacionUbicacionesService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use PhpOffice\PhpSpreadsheet\IOFactory;

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
        $spreadsheet = IOFactory::load($path);
        $sheet       = $spreadsheet->getActiveSheet();
        $rows        = $sheet->toArray(null, true, true, false);

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
                // Coordenadas: limpiar comas europeas y convertir a float
                if (in_array($campo, ['longitud', 'latitud'], true)) {
                    $limpio = str_replace(',', '.', (string) $valor);
                    $datos[$campo] = is_numeric($limpio) ? (float) $limpio : null;
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
