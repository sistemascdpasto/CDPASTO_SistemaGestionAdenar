<?php

namespace App\Exports\Gente;

use App\Models\Gente\ColaboradorContrato;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\ColaboradorCargo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithCustomStartCell;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Events\AfterSheet;
use Maatwebsite\Excel\Events\BeforeSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Exporta el listado completo de colaboradores.
 *
 * Estructura de la hoja:
 *   Fila 1 — grupos de columnas (con merge y color por grupo)
 *   Fila 2 — etiquetas de cada columna
 *   Fila 3+ — datos (startCell = A3)
 *
 * Se usa WithCustomStartCell + BeforeSheet para escribir las dos filas de
 * encabezado manualmente ANTES de que Maatwebsite coloque los datos.
 * NO se implementa WithHeadings para evitar duplicados.
 */
class ColaboradoresExport implements FromCollection, WithColumnWidths, WithCustomStartCell, WithEvents, WithMapping
{
    // ── Columnas fijas ────────────────────────────────────────────────────────
    private const FIJAS = [
        ['grupo' => 'IDENTIFICACIÓN',       'label' => 'CÉDULA',                     'width' => 16],
        ['grupo' => 'IDENTIFICACIÓN',       'label' => 'TIPO DOCUMENTO',             'width' => 20],
        ['grupo' => 'IDENTIFICACIÓN',       'label' => 'EXPEDIDO EN',                'width' => 26],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'NOMBRES',                    'width' => 22],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'APELLIDOS',                  'width' => 22],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'SEXO',                       'width' => 10],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'FECHA NACIMIENTO',           'width' => 18],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'EDAD',                       'width' => 8],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'ESTADO CIVIL',               'width' => 16],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'NOMBRE CÓNYUGE',            'width' => 26],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'HIJOS',                      'width' => 10],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'CIUDAD RESIDENCIA',          'width' => 22],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'DIRECCIÓN',                  'width' => 30],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'ESTRATO',                    'width' => 10],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'CELULAR 1',                  'width' => 16],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'CELULAR 2',                  'width' => 16],
        ['grupo' => 'DATOS PERSONALES',     'label' => 'CORREO',                     'width' => 30],
        ['grupo' => 'CONDICIONES',          'label' => 'DISCAPACIDAD',               'width' => 14],
        ['grupo' => 'CONDICIONES',          'label' => 'TIPO DISCAPACIDAD',          'width' => 24],
        ['grupo' => 'CONDICIONES',          'label' => 'VÍCTIMA CONFLICTO',          'width' => 18],
        ['grupo' => 'CONDICIONES',          'label' => 'LIBRETA MILITAR',            'width' => 16],
        ['grupo' => 'ANTECEDENTES',         'label' => 'HA TRABAJADO ANTES',         'width' => 20],
        ['grupo' => 'ANTECEDENTES',         'label' => 'CARGO ANTERIOR',             'width' => 26],
        ['grupo' => 'ANTECEDENTES',         'label' => 'FECHA ÚLTIMA LABORAL',       'width' => 20],
        ['grupo' => 'EXPERIENCIA PREVIA',   'label' => 'TIENE EXPERIENCIA PREVIA',   'width' => 22],
        ['grupo' => 'EXPERIENCIA PREVIA',   'label' => 'ÁREA EXPERIENCIA',           'width' => 20],
        ['grupo' => 'EXPERIENCIA PREVIA',   'label' => 'CARGO EXPERIENCIA',          'width' => 24],
        ['grupo' => 'EXPERIENCIA PREVIA',   'label' => 'AÑOS EXPERIENCIA',           'width' => 18],
        ['grupo' => 'EXPERIENCIA PREVIA',   'label' => 'EXP. TERRENO PLANO',         'width' => 20],
        ['grupo' => 'EXPERIENCIA PREVIA',   'label' => 'EXP. TERRENO MONTAÑOSO',     'width' => 22],
        ['grupo' => 'REQUISITOS CARGO',     'label' => 'MANEJO DEFENSIVO APLICA',    'width' => 22],
        ['grupo' => 'REQUISITOS CARGO',     'label' => 'CONDUCCIÓN CARGA PESADA',    'width' => 24],
        ['grupo' => 'INFORMACIÓN LABORAL',  'label' => 'CARGO ACTUAL',               'width' => 28],
        ['grupo' => 'INFORMACIÓN LABORAL',  'label' => 'ÁREA',                       'width' => 18],
        ['grupo' => 'INFORMACIÓN LABORAL',  'label' => 'CENTRO',                     'width' => 20],
        ['grupo' => 'INFORMACIÓN LABORAL',  'label' => 'CENTRO TRABAJO',             'width' => 22],
        ['grupo' => 'INFORMACIÓN LABORAL',  'label' => 'TURNO',                      'width' => 14],
        ['grupo' => 'INFORMACIÓN LABORAL',  'label' => 'FECHA INGRESO EMPRESA',      'width' => 22],
        ['grupo' => 'INFORMACIÓN LABORAL',  'label' => 'FECHA RETIRO EMPRESA',       'width' => 22],
        ['grupo' => 'INFORMACIÓN LABORAL',  'label' => 'MOTIVO RETIRO',              'width' => 24],
        ['grupo' => 'INFORMACIÓN LABORAL',  'label' => 'ESTADO',                     'width' => 12],
        ['grupo' => 'SEGURIDAD SOCIAL',     'label' => 'EPS',                        'width' => 24],
        ['grupo' => 'SEGURIDAD SOCIAL',     'label' => 'AFP',                        'width' => 24],
        ['grupo' => 'SEGURIDAD SOCIAL',     'label' => 'ARL',                        'width' => 24],
        ['grupo' => 'LIC. CONDUCCIÓN',      'label' => 'CATEGORÍAS LICENCIA',        'width' => 24],
        ['grupo' => 'LIC. CONDUCCIÓN',      'label' => 'FECHA EXPEDICIÓN',           'width' => 20],
        ['grupo' => 'LIC. CONDUCCIÓN',      'label' => 'FECHA VENCIMIENTO',          'width' => 20],
        ['grupo' => 'LIC. CONDUCCIÓN',      'label' => 'RESTRICCIONES',              'width' => 28],
        ['grupo' => 'APRENDIZ SENA',        'label' => 'ESPECIALIDAD',               'width' => 24],
        ['grupo' => 'APRENDIZ SENA',        'label' => 'N° GRUPO',                   'width' => 14],
        ['grupo' => 'APRENDIZ SENA',        'label' => 'INSTITUCIÓN',                'width' => 28],
        ['grupo' => 'APRENDIZ SENA',        'label' => 'NIT',                        'width' => 16],
        ['grupo' => 'APRENDIZ SENA',        'label' => 'CENTRO FORMACIÓN',           'width' => 26],
        ['grupo' => 'CONTACTOS EMERGENCIA', 'label' => 'PARENTESCO 1',               'width' => 20],
        ['grupo' => 'CONTACTOS EMERGENCIA', 'label' => 'NOMBRE 1',                   'width' => 26],
        ['grupo' => 'CONTACTOS EMERGENCIA', 'label' => 'TEL. 1',                     'width' => 16],
        ['grupo' => 'CONTACTOS EMERGENCIA', 'label' => 'PARENTESCO 2',               'width' => 20],
        ['grupo' => 'CONTACTOS EMERGENCIA', 'label' => 'NOMBRE 2',                   'width' => 26],
        ['grupo' => 'CONTACTOS EMERGENCIA', 'label' => 'TEL. 2',                     'width' => 16],
        ['grupo' => 'OTROS',                'label' => 'CÓDIGO QR SKAP',             'width' => 18],
    ];

    private const COLS_CONTRATO = [
        ['label' => 'TIPO',         'width' => 24],
        ['label' => 'CARGO',        'width' => 26],
        ['label' => 'FECHA INICIO', 'width' => 18],
        ['label' => 'FECHA FIN',    'width' => 18],
        ['label' => 'ESTADO',       'width' => 14],
    ];

    private const COLS_CARGO = [
        ['label' => 'CARGO',        'width' => 26],
        ['label' => 'ÁREA',         'width' => 18],
        ['label' => 'PERFIL',       'width' => 20],
        ['label' => 'FECHA INICIO', 'width' => 18],
        ['label' => 'FECHA FIN',    'width' => 18],
        ['label' => 'ESTADO',       'width' => 14],
    ];

    private int $maxContratos = 0;
    private int $maxCargos    = 0;

    // ── Datos ─────────────────────────────────────────────────────────────────
    public function collection(): Collection
    {
        $colaboradores = Colaborador::query()
            ->completos()
            ->with(['contratos', 'cargos'])
            ->orderBy('apellidos')
            ->orderBy('nombres')
            ->get();

        $this->maxContratos = (int) $colaboradores->max(fn ($c) => $c->contratos->count());
        $this->maxCargos    = (int) $colaboradores->max(fn ($c) => $c->cargos->count());

        return $colaboradores;
    }

    // Los datos empiezan en la fila 3 (filas 1-2 son encabezados manuales)
    public function startCell(): string
    {
        return 'A3';
    }

    // ── Mapeo de cada fila de datos ───────────────────────────────────────────
    public function map($c): array
    {
        $hijosArr = is_array($c->hijos)
            ? $c->hijos
            : (is_string($c->hijos) ? (json_decode($c->hijos, true) ?? []) : []);
        $hijos = count($hijosArr);

        $fila = [
            $c->cedula,
            $c->tipo_documento ?? '—',
            $c->expedido_en ?? '—',
            $c->nombres,
            $c->apellidos,
            $c->sexo ?? '—',
            $this->fecha($c->fecha_nacimiento),
            $c->fecha_nacimiento ? (int) Carbon::parse($c->fecha_nacimiento)->age : '—',
            $c->estado_civil ?? '—',
            $c->nombre_pareja ?? '—',
            $hijos > 0 ? $hijos : 'No',
            $c->ciudad_residencia ?? '—',
            $c->direccion ?? '—',
            $c->estrato ?? '—',
            $c->celular_1 ?? '—',
            $c->celular_2 ?? '—',
            $c->correo ?? '—',
            $c->discapacidad ? 'Sí' : 'No',
            $c->discapacidad_tipo ?? '—',
            $c->victima_conflicto ? 'Sí' : 'No',
            $c->libreta_militar ?? '—',
            $c->ha_trabajado_antes ? 'Sí' : 'No',
            $c->cargo_anterior ?? '—',
            $this->fecha($c->fecha_ultima_laboral),
            $c->tiene_experiencia ? 'Sí' : 'No',
            $c->area_experiencia ?? '—',
            $c->cargo_experiencia ?? '—',
            $c->anios_experiencia ?? '—',
            $c->experiencia_terreno_plano ?? '—',
            $c->experiencia_terreno_montanoso ?? '—',
            $c->manejo_defensivo_aplica ? 'Sí' : 'No',
            $c->conduccion_carga_pesada_aplica ? 'Sí' : 'No',
            $c->cargo ?? '—',
            $c->area ?? '—',
            $c->centro ?? '—',
            $c->centro_trabajo ?? '—',
            $c->turno ?? '—',
            $this->fecha($c->fecha_ingreso_empresa),
            $this->fecha($c->fecha_retiro_empresa),
            $c->motivo_retiro ?? '—',
            $c->is_active ? 'Activo' : 'Inactivo',
            $this->resolverOtro($c->eps, $c->eps_otro),
            $this->resolverOtro($c->afp, $c->afp_otro),
            $this->resolverOtro($c->arl, $c->arl_otro),
            is_array($c->licencia_conduccion_categorias)
                ? implode(', ', $c->licencia_conduccion_categorias)
                : ($c->licencia_conduccion_categorias ?? '—'),
            $this->fecha($c->fecha_licencia),
            $this->fecha($c->fecha_vencimiento_licencia),
            $c->restricciones_licencia ?? '—',
            $c->sena_especialidad ?? '—',
            $c->sena_numero_grupo ?? '—',
            $c->sena_institucion ?? '—',
            $c->sena_nit ?? '—',
            $c->sena_centro_formacion ?? '—',
            $c->emergencia_parentezco_1 ?? '—',
            $c->emergencia_nombre_1 ?? '—',
            $c->emergencia_telefono_1 ?? '—',
            $c->emergencia_parentezco_2 ?? '—',
            $c->emergencia_nombre_2 ?? '—',
            $c->emergencia_telefono_2 ?? '—',
            $c->codigo_qr_skap ?? '—',
        ];

        // Contratos dinámicos
        foreach ($c->contratos as $contrato) {
            $fila[] = $this->resolverOtro($contrato->tipo_contrato, $contrato->tipo_contrato_otro);
            $fila[] = $contrato->cargo ?? '—';
            $fila[] = $this->fecha($contrato->fecha_inicio);
            $fila[] = $this->fecha($contrato->fecha_fin);
            $fila[] = $contrato->estado ?? '—';
        }
        for ($i = 0; $i < ($this->maxContratos - $c->contratos->count()) * count(self::COLS_CONTRATO); $i++) {
            $fila[] = null;
        }

        // Cargos dinámicos
        foreach ($c->cargos as $cargo) {
            $fila[] = $cargo->cargo ?? '—';
            $fila[] = $cargo->area ?? '—';
            $fila[] = $cargo->perfil_nombre ?? '—';
            $fila[] = $this->fecha($cargo->fecha_inicio);
            $fila[] = $this->fecha($cargo->fecha_fin);
            $fila[] = $cargo->estado ?? '—';
        }
        for ($i = 0; $i < ($this->maxCargos - $c->cargos->count()) * count(self::COLS_CARGO); $i++) {
            $fila[] = null;
        }

        return $fila;
    }

    // ── Anchos de columna ─────────────────────────────────────────────────────
    public function columnWidths(): array
    {
        $widths = [];
        $col    = 1;

        foreach (self::FIJAS as $dato) {
            $widths[Coordinate::stringFromColumnIndex($col++)] = $dato['width'];
        }
        for ($i = 0; $i < $this->maxContratos; $i++) {
            foreach (self::COLS_CONTRATO as $dato) {
                $widths[Coordinate::stringFromColumnIndex($col++)] = $dato['width'];
            }
        }
        for ($i = 0; $i < $this->maxCargos; $i++) {
            foreach (self::COLS_CARGO as $dato) {
                $widths[Coordinate::stringFromColumnIndex($col++)] = $dato['width'];
            }
        }

        return $widths;
    }

    // ── Eventos ───────────────────────────────────────────────────────────────
    public function registerEvents(): array
    {
        return [
            // BeforeSheet: solo reserva el espacio (fila 1 vacía, fila 2 vacía).
            // Las etiquetas y grupos se escriben en AfterSheet, donde maxContratos
            // y maxCargos ya están calculados por collection().
            BeforeSheet::class => function (BeforeSheet $event): void {
                // Nada que hacer aquí — AfterSheet maneja ambas filas de encabezado.
            },

            AfterSheet::class => function (AfterSheet $event): void {
                $sheet     = $event->sheet->getDelegate();
                $totalCols = count(self::FIJAS)
                    + $this->maxContratos * count(self::COLS_CONTRATO)
                    + $this->maxCargos    * count(self::COLS_CARGO);
                $lastCol   = Coordinate::stringFromColumnIndex($totalCols);
                $lastRow   = $sheet->getHighestRow();

                // Fila 1: grupos con merge y colores
                $this->estilizarFila1($sheet, $totalCols);

                // Fila 2: escribir etiquetas y aplicar estilo
                $labels = array_column(self::FIJAS, 'label');
                for ($i = 1; $i <= $this->maxContratos; $i++) {
                    foreach (self::COLS_CONTRATO as $col) {
                        $labels[] = $col['label'];
                    }
                }
                for ($i = 1; $i <= $this->maxCargos; $i++) {
                    foreach (self::COLS_CARGO as $col) {
                        $labels[] = $col['label'];
                    }
                }
                $sheet->fromArray([$labels], null, 'A2');

                // Fila 2: etiquetas
                $sheet->getStyle("A2:{$lastCol}2")->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF1F2937']],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD1FAE5']],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
                    'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF6EE7B7']]],
                ]);
                $sheet->getRowDimension(2)->setRowHeight(28);

                // Filas de datos
                if ($lastRow >= 3) {
                    $sheet->getStyle("A3:{$lastCol}{$lastRow}")->applyFromArray([
                        'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_HAIR, 'color' => ['argb' => 'FFCCCCCC']]],
                        'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
                    ]);
                    for ($row = 3; $row <= $lastRow; $row++) {
                        if ($row % 2 === 0) {
                            $sheet->getStyle("A{$row}:{$lastCol}{$row}")
                                ->getFill()->setFillType(Fill::FILL_SOLID)
                                ->getStartColor()->setARGB('FFF0FDF4');
                        }
                    }
                }

                $sheet->freezePane('A3');
            },
        ];
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    private function estilizarFila1($sheet, int $totalCols): void
    {
        // Paleta de verdes para todos los grupos (fijos y dinámicos)
        $paleta = [
            ['fondo' => 'FF064E3B', 'texto' => 'FFFFFFFF'],
            ['fondo' => 'FF065F46', 'texto' => 'FFFFFFFF'],
            ['fondo' => 'FF047857', 'texto' => 'FFFFFFFF'],
            ['fondo' => 'FF059669', 'texto' => 'FFFFFFFF'],
            ['fondo' => 'FF10B981', 'texto' => 'FF064E3B'],
            ['fondo' => 'FF34D399', 'texto' => 'FF064E3B'],
            ['fondo' => 'FF6EE7B7', 'texto' => 'FF064E3B'],
            ['fondo' => 'FFA7F3D0', 'texto' => 'FF064E3B'],
        ];

        // Reconstruir lista de grupos en el mismo orden que los datos
        $grupos = array_column(self::FIJAS, 'grupo');
        for ($i = 1; $i <= $this->maxContratos; $i++) {
            foreach (self::COLS_CONTRATO as $_) {
                $grupos[] = "CONTRATO {$i}";
            }
        }
        for ($i = 1; $i <= $this->maxCargos; $i++) {
            foreach (self::COLS_CARGO as $_) {
                $grupos[] = "CARGO {$i}";
            }
        }

        // Calcular bloques consecutivos del mismo grupo
        $bloques = [];
        $grupoActual = $grupos[0];
        $desdeCol    = 1;

        foreach ($grupos as $colIdx => $nombre) {
            $col1Based = $colIdx + 1;
            if ($nombre !== $grupoActual) {
                $bloques[] = ['nombre' => $grupoActual, 'desde' => $desdeCol, 'hasta' => $col1Based - 1];
                $grupoActual = $nombre;
                $desdeCol    = $col1Based;
            }
        }
        $bloques[] = ['nombre' => $grupoActual, 'desde' => $desdeCol, 'hasta' => count($grupos)];

        // Asignar color de la paleta a cada nombre de grupo único (en orden de aparición)
        $coloresPorGrupo = [];
        $paletaIdx       = 0;
        foreach ($bloques as $bloque) {
            $nombre = $bloque['nombre'];
            if (! isset($coloresPorGrupo[$nombre])) {
                $coloresPorGrupo[$nombre] = $paleta[$paletaIdx % count($paleta)];
                $paletaIdx++;
            }
        }

        // Aplicar merge + estilo + texto a cada bloque
        foreach ($bloques as $bloque) {
            $celdaIni = Coordinate::stringFromColumnIndex($bloque['desde']).'1';
            $celdaFin = Coordinate::stringFromColumnIndex($bloque['hasta']).'1';

            // Escribir el título del grupo en la primera celda del bloque
            $sheet->setCellValue($celdaIni, $bloque['nombre']);

            if ($bloque['desde'] !== $bloque['hasta']) {
                $sheet->mergeCells("{$celdaIni}:{$celdaFin}");
            }

            $color = $coloresPorGrupo[$bloque['nombre']];
            $sheet->getStyle("{$celdaIni}:{$celdaFin}")->applyFromArray([
                'font'      => ['bold' => true, 'size' => 10, 'color' => ['argb' => $color['texto']]],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => $color['fondo']]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFFFFFFF']]],
            ]);
        }

        $sheet->getRowDimension(1)->setRowHeight(22);
    }

    private function fecha(mixed $valor): ?string
    {
        return $valor ? Carbon::parse($valor)->format('d/m/Y') : null;
    }

    private function resolverOtro(?string $valor, ?string $otro): string
    {
        if (! $valor) {
            return '—';
        }

        return $valor === 'Otro' ? ($otro ?? 'Otro') : $valor;
    }
}
