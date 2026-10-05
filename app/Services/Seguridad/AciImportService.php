<?php

namespace App\Services\Seguridad;

use App\Models\Seguridad\Aci;
use App\Models\Seguridad\Colaborador;
use App\Services\Seguridad\Concerns\NormalizaCatalogos;
use App\Support\HojaCalculo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Throwable;

/**
 * Carga masiva de reportes ACI desde el Excel exportado del programa SKAP,
 * hoja "SIOs". A diferencia del importador de colaboradores, las columnas se
 * resuelven por el texto del encabezado (no por letra fija) porque este
 * archivo trae encabezados limpios en una sola fila — así se tolera que las
 * columnas cambien de orden, y cualquier columna nueva que no reconozcamos
 * cae en `datos_adicionales` en vez de perderse (HU-023: "estructura
 * dinámica y escalable... detectar columnas nuevas sin eliminar las
 * existentes").
 */
class AciImportService
{
    use NormalizaCatalogos;

    /**
     * Encabezado normalizado (sin tildes/espacios/mayúsculas) => campo de `acis`.
     */
    private const HEADER_MAP = [
        'FOLIO' => 'folio',
        'FECHAQUESEALZO' => 'fecha_alzado',
        'HORAQUESEALZO' => 'hora_alzado',
        'FECHADELINCIDENTE' => 'fecha_incidente',
        'HORADELINCIDENTE' => 'hora_incidente',
        'UBICACION' => 'ubicacion',
        'DENTROOFUERADEUBICACION' => 'dentro_fuera_ubicacion',
        'ZONA' => 'zona',
        'SUBZONA' => 'subzona',
        'REPORTEDE' => 'reporte_de',
        'PERSONAQUELOCOMETIO' => 'persona_cometio',
        'REPORTADOPOR' => 'reportado_por',
        'QRDEQUIENREPORTO' => 'qr_reportante',
        'NUMERODEEMPLEADOQUEREPORTO' => 'numero_empleado_reporto',
        'PINDELQUEREPORTO' => 'pin_reporto',
        'DESCRIPCION' => 'descripcion',
        'POSIBLESOLUCION' => 'posible_solucion',
        'AREA' => 'area',
        'SUBAREA' => 'subarea',
        'DESCRIPCIONDELAUBICACION' => 'descripcion_ubicacion',
        'CLASIFICACION' => 'clasificacion',
        'TIPODERIESGO' => 'tipo_riesgo',
        'DESCRIPCIONDELTIPODERIESGO' => 'descripcion_tipo_riesgo',
        'CIUDADELEGIDA' => 'ciudad_elegida',
        'ESTADOELEGIDO' => 'estado_elegido',
        'NOMBREDELPUNTODEVENTA' => 'nombre_punto_venta',
        'DESCRIPCIONDELPUNTODEVENTA' => 'descripcion_punto_venta',
        'TIPODEACTOENRUTA' => 'tipo_acto_ruta',
        'FUEPOREXTERNO' => 'fue_por_externo',
        'SIF' => 'sif',
        'ESTATUSDEASIGNACION' => 'estatus_asignacion',
        'FECHAYHORADEASIGNACION' => 'fecha_hora_asignacion',
        'ASIGNADOPOR' => 'asignado_por',
        'QRDELASIGNADOR' => 'qr_asignador',
        'ASIGNADOA' => 'asignado_a',
        'QRDELASIGNADO' => 'qr_asignado',
        'CERRADOPOR' => 'cerrado_por',
        'FECHAYHORADECIERRE' => 'fecha_hora_cierre',
        'BU' => 'bu',
        'PERSONAQUELOCOMETIOPIN' => 'persona_cometio_pin',
        'PERSONAQUELOCOMETIONUMERODEEMPLEADO' => 'persona_cometio_numero_empleado',
        'FECHAPOSPUESTO' => 'fecha_pospuesto',
        'COMPANIA' => 'compania',
    ];

    private const CAMPOS_FECHA = ['fecha_alzado', 'fecha_incidente', 'fecha_pospuesto'];

    private const CAMPOS_FECHA_HORA = ['fecha_hora_asignacion', 'fecha_hora_cierre'];

    private const CAMPOS_BOOLEANOS = ['fue_por_externo', 'sif'];

    private const CAMPOS_CATALOGO_EXACTO = [
        'reporte_de' => 'seguridad.acis.reporte_de',
        'area' => 'seguridad.acis.areas',
        'clasificacion' => 'seguridad.acis.clasificaciones',
        'estatus_asignacion' => 'seguridad.acis.estatus_asignacion',
    ];

    private const CAMPOS_CATALOGO_PARCIAL = [
        'compania' => 'seguridad.acis.companias',
    ];

    /**
     * @param  array<int, string>  $rutasArchivos
     * @return array{creados: int, actualizados: int, omitidos_sin_colaborador: int, errores: int, archivos_procesados: int}
     */
    public function importar(array $rutasArchivos): array
    {
        $resultado = [
            'creados' => 0,
            'actualizados' => 0,
            'omitidos_sin_colaborador' => 0,
            'errores' => 0,
            'archivos_procesados' => 0,
        ];

        foreach ($rutasArchivos as $rutaArchivo) {
            $hoja = $this->buscarHojaSios($rutaArchivo);

            if (! $hoja) {
                Log::warning("Importación de ACIS: no se encontró la hoja \"SIOs\" en {$rutaArchivo}.");
                $resultado['errores']++;

                continue;
            }

            $resultado['archivos_procesados']++;

            $filas = HojaCalculo::filas($hoja, true, true);
            $encabezados = array_shift($filas) ?? [];
            $mapaColumnas = $this->resolverMapaColumnas($encabezados);

            foreach ($filas as $numeroFila => $fila) {
                $this->procesarFila($fila, $mapaColumnas, $numeroFila, $resultado);
            }
        }

        return $resultado;
    }

    /**
     * @param  array<string, mixed>  $fila
     * @param  array<string, array{campo: ?string, encabezado: string}>  $mapaColumnas
     * @param  array{creados: int, actualizados: int, omitidos_sin_colaborador: int, errores: int, archivos_procesados: int}  $resultado
     */
    private function procesarFila(array $fila, array $mapaColumnas, int|string $numeroFila, array &$resultado): void
    {
        $valores = $this->extraerValoresPorCampo($fila, $mapaColumnas);
        $folio = trim((string) ($valores['folio'] ?? ''));

        if ($folio === '') {
            return; // cola vacía de la hoja
        }

        try {
            // El Folio es la clave natural del reporte: si ya existe, se
            // actualiza con lo que traiga la fila (un ACI cambia de estado
            // con el tiempo — Pendiente -> Asignado -> Cerrado, se le agrega
            // fecha de cierre, etc. — así que re-importar el mismo archivo
            // más adelante debe reflejar esos cambios, no quedarse con la
            // primera versión que se cargó).
            $existente = Aci::where('folio', $folio)->first();

            $qrReportante = trim((string) ($valores['qr_reportante'] ?? ''));
            $colaborador = $qrReportante !== '' ? Colaborador::where('codigo_qr_skap', $qrReportante)->first() : null;

            if (! $colaborador) {
                $resultado['omitidos_sin_colaborador']++;

                return;
            }

            $datos = $this->mapearFila($valores, $folio);
            $datos['colaborador_id'] = $colaborador->id;
            $datos['asignador_colaborador_id'] = $this->resolverColaboradorPorQr((string) ($valores['qr_asignador'] ?? ''));
            $datos['asignado_colaborador_id'] = $this->resolverColaboradorPorQr((string) ($valores['qr_asignado'] ?? ''));

            if ($existente) {
                $existente->update($datos);
                $resultado['actualizados']++;
            } else {
                Aci::create($datos);
                $resultado['creados']++;
            }
        } catch (Throwable $e) {
            Log::warning("Importación de ACIS: error en fila {$numeroFila} (folio {$folio}): {$e->getMessage()}");
            $resultado['errores']++;
        }
    }

    private function resolverColaboradorPorQr(string $qr): ?int
    {
        $qr = trim($qr);

        return $qr !== '' ? Colaborador::where('codigo_qr_skap', $qr)->value('id') : null;
    }

    private function buscarHojaSios(string $rutaArchivo): ?Worksheet
    {
        $spreadsheet = HojaCalculo::cargar($rutaArchivo);

        foreach ($spreadsheet->getSheetNames() as $nombre) {
            if (str(trim($nombre))->upper()->value() === 'SIOS') {
                return $spreadsheet->getSheetByName($nombre);
            }
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
    private function mapearFila(array $valores, string $folio): array
    {
        $datos = ['folio' => $folio];

        foreach ($valores as $campo => $valor) {
            if (in_array($campo, ['folio', 'datos_adicionales'], true)) {
                continue;
            }

            $datos[$campo] = match (true) {
                in_array($campo, self::CAMPOS_FECHA, true) => $this->parsearFecha((string) $valor),
                in_array($campo, self::CAMPOS_FECHA_HORA, true) => $this->parsearFechaHora((string) $valor),
                in_array($campo, self::CAMPOS_BOOLEANOS, true) => $this->parsearBooleano((string) $valor),
                array_key_exists($campo, self::CAMPOS_CATALOGO_EXACTO) => $this->normalizarCatalogo(
                    (string) $valor, config(self::CAMPOS_CATALOGO_EXACTO[$campo]), exacto: true,
                ),
                array_key_exists($campo, self::CAMPOS_CATALOGO_PARCIAL) => $this->normalizarCatalogo(
                    (string) $valor, config(self::CAMPOS_CATALOGO_PARCIAL[$campo]), exacto: false,
                ),
                default => trim((string) $valor) !== '' ? trim((string) $valor) : null,
            };
        }

        $datos['datos_adicionales'] = $valores['datos_adicionales'] ?? null;

        return $datos;
    }

    /**
     * @param  array<int, string>  $catalogo
     */
    private function normalizarCatalogo(string $valor, array $catalogo, bool $exacto): ?string
    {
        $valor = trim($valor);

        if ($valor === '') {
            return null;
        }

        return $exacto ? $this->coincidirExacto($valor, $catalogo) : $this->coincidirParcial($valor, $catalogo);
    }

    private function parsearFecha(string $valor): ?string
    {
        $valor = trim($valor);

        if ($valor === '') {
            return null;
        }

        try {
            return Carbon::createFromFormat('d/m/Y', $valor)->toDateString();
        } catch (Throwable) {
            return null;
        }
    }

    private function parsearFechaHora(string $valor): ?string
    {
        $valor = trim($valor);

        if ($valor === '') {
            return null;
        }

        try {
            return Carbon::createFromFormat('d/m/Y H:i', $valor)->toDateTimeString();
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
