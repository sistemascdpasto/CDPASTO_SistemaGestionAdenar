<?php

namespace App\Services\Seguridad;

use App\Models\Seguridad\Colaborador;
use App\Services\Seguridad\Concerns\NormalizaCatalogos;
use App\Support\HojaCalculo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Throwable;

/**
 * Carga masiva de colaboradores desde el Excel de nómina ("BASE DE DATOS
 * COLABORADORES"), hoja "BASE ACTUALIZADA". El formato de columnas es fijo
 * (ver mapa en `mapearFila()`) porque así llega el archivo real de la
 * empresa — no usa fila de encabezados dinámica porque los encabezados
 * reales tienen espacios/saltos de línea inconsistentes.
 */
class ColaboradorImportService
{
    use NormalizaCatalogos;

    private const COLUMNA_CEDULA = 'B';

    private const COLUMNA_NOMBRE_COMPLETO = 'C';

    private const COLUMNA_AREA = 'D';

    private const COLUMNA_CARGO = 'E';

    private const COLUMNA_CENTRO = 'F';

    private const COLUMNA_TELEFONO = 'G';

    private const COLUMNA_SKAP = 'H';

    private const COLUMNA_CORREO = 'I';

    private const COLUMNA_DIRECCION = 'J';

    private const COLUMNA_CENTRO_TRABAJO = 'K';

    private const COLUMNA_EPS = 'L';

    private const COLUMNA_AFP = 'M';

    private const COLUMNA_ARL = 'N';

    private const COLUMNA_FECHA_INGRESO = 'O';

    public function __construct(private readonly ColaboradorAutoprovisionService $autoprovision)
    {
    }

    /**
     * @return array{creados: int, omitidos: int, errores: int}
     */
    public function importar(string $rutaArchivo): array
    {
        $hoja = $this->buscarHojaBaseActualizada($rutaArchivo);

        $resultado = ['creados' => 0, 'omitidos' => 0, 'errores' => 0];

        if (! $hoja) {
            Log::warning('Importación de colaboradores: no se encontró la hoja "BASE ACTUALIZADA" en el archivo.');
            $resultado['errores']++;

            return $resultado;
        }

        $filas = HojaCalculo::filas($hoja, true, true);
        array_shift($filas); // encabezado

        foreach ($filas as $numeroFila => $fila) {
            $cedula = trim((string) ($fila[self::COLUMNA_CEDULA] ?? ''));

            if ($cedula === '') {
                continue; // cola vacía de la hoja
            }

            try {
                if (Colaborador::where('cedula', $cedula)->exists()) {
                    $resultado['omitidos']++;

                    continue;
                }

                $datos = $this->mapearFila($fila, $cedula);

                if (! $datos) {
                    Log::warning("Importación de colaboradores: fila {$numeroFila} (cédula {$cedula}) sin nombre, se omite.");
                    $resultado['errores']++;

                    continue;
                }

                DB::transaction(function () use ($datos) {
                    $colaborador = Colaborador::create([
                        ...$datos,
                        'is_active' => true,
                        'estado_registro' => 'completo',
                        'wizard_step' => 4,
                    ]);

                    $usuario = $this->autoprovision->provisionar(
                        $colaborador->cedula,
                        $colaborador->nombres,
                        $colaborador->apellidos,
                        $colaborador->correo,
                    );

                    $colaborador->update(['user_id' => $usuario->id]);
                });

                $resultado['creados']++;
            } catch (Throwable $e) {
                Log::warning("Importación de colaboradores: error en fila {$numeroFila} (cédula {$cedula}): {$e->getMessage()}");
                $resultado['errores']++;
            }
        }

        return $resultado;
    }

    private function buscarHojaBaseActualizada(string $rutaArchivo): ?Worksheet
    {
        $spreadsheet = HojaCalculo::cargar($rutaArchivo);

        foreach ($spreadsheet->getSheetNames() as $nombre) {
            if (str(trim($nombre))->upper()->value() === 'BASE ACTUALIZADA') {
                return $spreadsheet->getSheetByName($nombre);
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $fila
     * @return array<string, mixed>|null null si no hay nombre para la fila.
     */
    private function mapearFila(array $fila, string $cedula): ?array
    {
        [$nombres, $apellidos] = $this->dividirNombreCompleto((string) ($fila[self::COLUMNA_NOMBRE_COMPLETO] ?? ''));

        if ($nombres === '' && $apellidos === '') {
            return null;
        }

        $telefono = preg_replace('/\D/', '', (string) ($fila[self::COLUMNA_TELEFONO] ?? ''));
        $skap = trim((string) ($fila[self::COLUMNA_SKAP] ?? ''));
        $correo = strtolower(trim((string) ($fila[self::COLUMNA_CORREO] ?? '')));

        return [
            'cedula' => $cedula,
            'nombres' => $nombres,
            'apellidos' => $apellidos,
            'area' => $this->normalizarArea((string) ($fila[self::COLUMNA_AREA] ?? '')),
            'cargo' => $this->coincidirExacto((string) ($fila[self::COLUMNA_CARGO] ?? ''), config('seguridad.colaboradores.cargos')),
            'centro' => $this->coincidirExacto((string) ($fila[self::COLUMNA_CENTRO] ?? ''), config('seguridad.colaboradores.centros')),
            'centro_trabajo' => $this->coincidirExacto((string) ($fila[self::COLUMNA_CENTRO_TRABAJO] ?? ''), config('seguridad.colaboradores.centros_trabajo')),
            'celular_1' => $telefono !== '' ? substr($telefono, 0, 10) : null,
            'codigo_qr_skap' => ($skap === '' || strtoupper($skap) === 'N/A') ? null : $skap,
            'correo' => str_contains($correo, '@') ? $correo : null,
            'direccion' => trim((string) ($fila[self::COLUMNA_DIRECCION] ?? '')) ?: null,
            'eps' => $this->coincidirParcial((string) ($fila[self::COLUMNA_EPS] ?? ''), config('seguridad.colaboradores.eps_opciones')),
            'afp' => $this->coincidirParcial((string) ($fila[self::COLUMNA_AFP] ?? ''), config('seguridad.colaboradores.afp_opciones')),
            'arl' => $this->coincidirParcial((string) ($fila[self::COLUMNA_ARL] ?? ''), config('seguridad.colaboradores.arl_opciones')),
            'fecha_ingreso_empresa' => $this->parsearFecha((string) ($fila[self::COLUMNA_FECHA_INGRESO] ?? '')),
        ];
    }

    /**
     * Convención colombiana para un campo de "nombre completo": los primeros
     * dos tokens son los apellidos (paterno + materno) y el resto son los
     * nombres. Se ajusta si el nombre trae menos de 3 tokens.
     *
     * @return array{0: string, 1: string} [nombres, apellidos]
     */
    private function dividirNombreCompleto(string $nombreCompleto): array
    {
        $tokens = array_values(array_filter(preg_split('/\s+/', trim($nombreCompleto)) ?: [], fn ($t) => $t !== ''));
        $total = count($tokens);

        return match (true) {
            $total >= 4 => [implode(' ', array_slice($tokens, 2)), implode(' ', array_slice($tokens, 0, 2))],
            $total === 3 => [$tokens[2], implode(' ', array_slice($tokens, 0, 2))],
            $total === 2 => [$tokens[1], $tokens[0]],
            $total === 1 => [$tokens[0], ''],
            default => ['', ''],
        };
    }

    private function normalizarArea(string $valor): string
    {
        return match (strtoupper(trim($valor))) {
            'ADMINISTRATIVA' => 'Administrativa',
            'OPERATIVA' => 'Operativa',
            default => trim($valor),
        };
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
}
