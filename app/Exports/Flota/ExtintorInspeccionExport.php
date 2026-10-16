<?php

namespace App\Exports\Flota;

use App\Models\Flota\Extintor;
use Illuminate\Support\Carbon;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

class ExtintorInspeccionExport implements FromArray, WithColumnWidths, WithEvents, WithTitle
{
    // Estructura de filas:
    // 1 → encabezado: vacío izq | "FIRMA DE QUIEN REALIZA LA INSPECCIÓN" centro | metadatos der
    // 2 → vacío izq              | metadatos der (Fecha)
    // 3 → título principal       | metadatos der (Versión)
    // 4 → número de serie grande | metadatos der (Página)
    // 5 → placa (opcional)
    // 6 → cabeceras nivel 1
    // 7 → cabeceras nivel 2
    // 8+ → filas de datos
    private const FILA_DATOS_INICIO = 8;

    // Columnas de datos (índice 0-based en array())
    // A(0)  Fecha inspección
    // B(1)  Condición Buena   C(2)  Condición Mala
    // D(3)  ABC               E(4)  Otro
    // F(5)  Directa           G(6)  Indirecta
    // H(7)  Mes recarga       I(8)  Año recarga
    // J(9)  Parte mantenimiento
    // K(10) Señal Buena       L(11) Señal Mala
    // M(12) Dem Buena         N(13) Dem Mala     O(14) Dem N/A
    // P(15) Func Bueno        Q(16) Func Malo
    // R(17) Acc Bueno         S(18) Acc Malo
    // T(19) Observaciones
    // U(20) Firma (imagen, AfterSheet)

    /** [número de fila Excel => ruta absoluta de firma] */
    private array $firmasPorFila = [];

    /** Rutas absolutas de imágenes de referencia (card de codificación) */
    private ?string $rutaRef1 = null;
    private ?string $rutaRef2 = null;

    private const PARTES = [
        '1'  => 'Asa Percutora',
        '2'  => 'Asa de Acarreo',
        '3'  => 'Manómetro',
        '4'  => 'Pasador de Seguridad',
        '5'  => 'Presinto de Seguridad',
        '6'  => 'Válvula de Seguridad',
        '7'  => 'Tapa del Cilindro',
        '8'  => 'Cartucho Impulsor',
        '9'  => 'Manguera',
        '10' => 'Pitón, Boquilla o Tobera',
        '11' => 'Válvula de descarga',
        '12' => 'Cuello del Cilindro',
        '13' => 'Cuerpo del cilindro',
        '14' => 'Válvula Reguladora de Presión',
        '15' => 'Falda o Base de Sustentación',
        '16' => 'Fondo del Cilindro',
        '17' => 'Soporte',
        '18' => 'Gancho de Sujeción del Extintor',
        '19' => 'Hombro del Cilindro',
        '20' => 'Mecanismo de Punzado',
        '21' => 'Ruedas o Neumáticos',
        '22' => 'Empacaduras',
        '23' => 'Soporte de la Manguera',
        '24' => 'Rotulación',
        '25' => 'Asa de Sujeción a la Pared',
        '26' => 'Número y/o Siglas del Equipo',
        '27' => 'Etiqueta con Fecha de Ultima Recarga',
    ];

    public function __construct(private readonly Extintor $extintor)
    {
        $dir = public_path('images/extintores');
        foreach ([1, 2] as $n) {
            $matches = glob("{$dir}/extintor-referencia-{$n}.*");
            if (!empty($matches)) {
                $this->{"rutaRef{$n}"} = $matches[0];
            }
        }
    }

    public function title(): string
    {
        return 'Inspecciones';
    }

    private function resolverPartes(?string $valor): ?string
    {
        if (blank($valor)) return null;
        $lineas = [];
        foreach (array_filter(array_map('trim', explode(',', $valor))) as $cod) {
            $desc     = self::PARTES[$cod] ?? null;
            $lineas[] = $desc ? "{$cod} - {$desc}" : $cod;
        }
        return implode("\n", $lineas) ?: null;
    }

    // ── array(): SOLO filas de datos. El encabezado lo escribe AfterSheet. ────

    public function array(): array
    {
        // Filas 1-7 completamente vacías — AfterSheet las llenará
        $filas = [
            array_fill(0, 21, null), // fila 1
            array_fill(0, 21, null), // fila 2
            array_fill(0, 21, null), // fila 3
            array_fill(0, 21, null), // fila 4
            array_fill(0, 21, null), // fila 5
            array_fill(0, 21, null), // fila 6 cab nivel 1
            array_fill(0, 21, null), // fila 7 cab nivel 2
        ];

        $inspecciones = $this->extintor->inspecciones()->orderBy('fecha_inspeccion')->get();
        $filaActual   = self::FILA_DATOS_INICIO;

        foreach ($inspecciones as $ins) {
            $condicion      = strtolower($ins->condicion ?? '');
            $tipoAgente     = strtolower($ins->tipo_agente ?? '');
            $impulsor       = strtolower($ins->agente_impulsor ?? '');
            $senalizacion   = strtolower($ins->senalizacion ?? '');
            $demarcacion    = strtolower($ins->demarcacion ?? '');
            $funcionamiento = strtolower($ins->funcionamiento ?? '');
            $acceso         = strtolower($ins->acceso ?? '');

            $fechaRecarga = $ins->fecha_recarga ? $ins->fecha_recarga->format('d/m/Y') : null;

            if ($ins->firma_path) {
                $ruta = storage_path('app/public/'.$ins->firma_path);
                if (file_exists($ruta)) {
                    $this->firmasPorFila[$filaActual] = $ruta;
                }
            }

            $filas[] = [
                $ins->fecha_inspeccion?->format('d/m/Y'),
                $condicion === 'buena'    ? '✓' : null,
                $condicion === 'mala'     ? '✓' : null,
                str_contains($tipoAgente, 'abc') ? '✓' : null,
                (!empty($tipoAgente) && !str_contains($tipoAgente, 'abc')) ? '✓' : null,
                $impulsor === 'directa'   ? '✓' : null,
                $impulsor === 'indirecta' ? '✓' : null,
                $fechaRecarga,  // H — fecha completa dd/mm/yyyy
                null,           // I — vacía (fusionada con H en AfterSheet)
                $this->resolverPartes($ins->parte_mantenimiento),
                $senalizacion === 'buena' ? '✓' : null,
                $senalizacion === 'mala'  ? '✓' : null,
                $demarcacion === 'buena'  ? '✓' : null,
                $demarcacion === 'mala'   ? '✓' : null,
                $demarcacion === 'n/a'    ? '✓' : null,
                $funcionamiento === 'bueno' ? '✓' : null,
                $funcionamiento === 'malo'  ? '✓' : null,
                $acceso === 'bueno' ? '✓' : null,
                $acceso === 'malo'  ? '✓' : null,
                $ins->observaciones_inspeccion,
                null, // U — imagen de firma (AfterSheet)
            ];

            $filaActual++;
        }

        if ($inspecciones->isEmpty()) {
            $filas[] = array_fill(0, 21, null);
        }

        return $filas;
    }

    public function columnWidths(): array
    {
        return [
            'A' => 16,
            'B' => 8,  'C' => 8,
            'D' => 8,  'E' => 8,
            'F' => 10, 'G' => 12,
            'H' => 8,  'I' => 8,
            'J' => 24,
            'K' => 8,  'L' => 8,
            'M' => 8,  'N' => 8, 'O' => 8,
            'P' => 9,  'Q' => 9,
            'R' => 9,  'S' => 9,
            'T' => 22,
            'U' => 28,
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet      = $event->sheet->getDelegate();
                $totalInsp  = $this->extintor->inspecciones()->count();
                $ultimaFila = self::FILA_DATOS_INICIO + max($totalInsp - 1, 0);
                $hoy        = Carbon::now()->translatedFormat('d-M-y');

                // ── FILA 1 ────────────────────────────────────────────────────
                // Centro: "Tipo de Documento: FORMATO" (A1:P1)
                // Derecha: metadatos Código (Q1:R1 label | S1:U1 valor)
                $sheet->mergeCells('A1:P1');
                $sheet->setCellValue('A1', 'Tipo de Documento: FORMATO');
                $sheet->getStyle('A1')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 9],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                ]);

                $sheet->mergeCells('Q1:R1');
                $sheet->setCellValue('Q1', 'Código');
                $sheet->getStyle('Q1')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 9],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_RIGHT, 'vertical' => Alignment::VERTICAL_CENTER],
                ]);
                $sheet->mergeCells('S1:U1');
                $sheet->setCellValue('S1', '1');
                $sheet->getStyle('S1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // ── FILA 2 ────────────────────────────────────────────────────
                $sheet->mergeCells('A2:P2');
                $sheet->mergeCells('Q2:R2');
                $sheet->setCellValue('Q2', 'Fecha');
                $sheet->getStyle('Q2')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 9],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_RIGHT],
                ]);
                $sheet->mergeCells('S2:U2');
                $sheet->setCellValue('S2', $hoy);
                $sheet->getStyle('S2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // ── FILA 3: título principal ──────────────────────────────────
                $sheet->mergeCells('A3:P3');
                $sheet->setCellValue('A3', 'INSPECCIÓN AL SISTEMA DE EXTINCIÓN PORTÁTIL CONTRA INCENDIOS   "EXTINTORES"');
                $sheet->getStyle('A3')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 11],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                ]);
                $sheet->mergeCells('Q3:R3');
                $sheet->setCellValue('Q3', 'Versión');
                $sheet->getStyle('Q3')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 9],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_RIGHT],
                ]);
                $sheet->mergeCells('S3:U3');
                $sheet->setCellValue('S3', '2');
                $sheet->getStyle('S3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // ── FILA 4: número de serie grande ────────────────────────────
                $sheet->mergeCells('A4:P4');
                $sheet->setCellValue('A4', $this->extintor->numero_serie);
                $sheet->getStyle('A4')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 24],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                ]);
                $sheet->getRowDimension(4)->setRowHeight(36);
                $sheet->mergeCells('Q4:R4');
                $sheet->setCellValue('Q4', 'Página');
                $sheet->getStyle('Q4')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 9],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_RIGHT],
                ]);
                $sheet->mergeCells('S4:U4');
                $sheet->setCellValue('S4', '1  De 1');
                $sheet->getStyle('S4')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // Bordes metadatos der (Q1:U4)
                $sheet->getStyle('Q1:U4')
                    ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

                // ── FILA 5: placa ─────────────────────────────────────────────
                $sheet->mergeCells('A5:U5');
                if ($this->extintor->placa_actual) {
                    $sheet->setCellValue('A5', 'Placa: '.$this->extintor->placa_actual);
                    $sheet->getStyle('A5')->getFont()->setBold(true)->setSize(10);
                }
                $sheet->getRowDimension(5)->setRowHeight(14);

                // ── CABECERAS (filas 6-7) ─────────────────────────────────────
                $sheet->mergeCells('A6:A7');
                $sheet->mergeCells('B6:C6');
                $sheet->mergeCells('D6:E6');
                $sheet->mergeCells('F6:G6');
                $sheet->mergeCells('H6:I6'); // nivel 1: "Fecha última recarga"
                $sheet->mergeCells('J6:J7');
                $sheet->mergeCells('K6:L6');
                $sheet->mergeCells('M6:O6');
                $sheet->mergeCells('P6:Q6');
                $sheet->mergeCells('R6:S6');
                $sheet->mergeCells('T6:T7');
                $sheet->mergeCells('U6:U7');

                $sheet->setCellValue('A6', 'FECHA DE INSPECCIÓN');
                $sheet->setCellValue('B6', 'Condiciones');
                $sheet->setCellValue('D6', 'Agente Extinguidor');
                $sheet->setCellValue('F6', 'Agente Impulsor');
                $sheet->setCellValue('H6', 'Fecha última recarga');
                $sheet->setCellValue('J6', 'Parte del Extintor que requiere Mantenimiento');
                $sheet->setCellValue('K6', 'Señalización');
                $sheet->setCellValue('M6', 'Demarcación');
                $sheet->setCellValue('P6', 'Funcionamiento del Extintor');
                $sheet->setCellValue('R6', 'Acceso al Extintor');
                $sheet->setCellValue('T6', 'Observaciones');
                $sheet->setCellValue('U6', 'Firma');

                $sheet->setCellValue('B7', 'Buena');    $sheet->setCellValue('C7', 'Mala');
                $sheet->setCellValue('D7', 'ABC');      $sheet->setCellValue('E7', 'Otro');
                $sheet->setCellValue('F7', 'Directa');  $sheet->setCellValue('G7', 'Indirecta');
                $sheet->mergeCells('H7:I7');
                $sheet->setCellValue('H7', 'Día / Mes / Año');
                $sheet->setCellValue('J7', 'Coloque el número de Codificación');
                $sheet->setCellValue('K7', 'Buena');    $sheet->setCellValue('L7', 'Mala');
                $sheet->setCellValue('M7', 'Buena');    $sheet->setCellValue('N7', 'Mala');
                $sheet->setCellValue('O7', 'N/A');
                $sheet->setCellValue('P7', 'Bueno');    $sheet->setCellValue('Q7', 'Malo');
                $sheet->setCellValue('R7', 'Bueno');    $sheet->setCellValue('S7', 'Malo');

                $colorAzul = 'BDD7EE';
                $colorGris = 'D9D9D9';

                $sheet->getStyle('A6:U6')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 9],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $colorAzul]],
                    'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
                ]);
                $sheet->getRowDimension(6)->setRowHeight(36);

                $sheet->getStyle('A7:U7')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 9],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $colorGris]],
                    'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
                ]);
                $sheet->getRowDimension(7)->setRowHeight(30);

                // ── FILAS DE DATOS ────────────────────────────────────────────
                if ($ultimaFila >= self::FILA_DATOS_INICIO) {
                    $sheet->getStyle('A'.self::FILA_DATOS_INICIO.':U'.$ultimaFila)->applyFromArray([
                        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
                        'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
                        'font'      => ['size' => 9],
                    ]);

                    foreach (['A', 'J', 'T'] as $col) {
                        $sheet->getStyle($col.self::FILA_DATOS_INICIO.':'.$col.$ultimaFila)
                            ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
                    }

                    for ($r = self::FILA_DATOS_INICIO; $r <= $ultimaFila; $r++) {
                        $sheet->mergeCells('H'.$r.':I'.$r); // fecha completa ocupa H e I
                        $sheet->getRowDimension($r)->setRowHeight(50);
                    }
                }

                // ── IMÁGENES DE FIRMA ─────────────────────────────────────────
                foreach ($this->firmasPorFila as $fila => $rutaFirma) {
                    try {
                        $drawing = new Drawing();
                        $drawing->setPath($rutaFirma);
                        $drawing->setCoordinates('U'.$fila);
                        $drawing->setOffsetX(4);
                        $drawing->setOffsetY(4);
                        $drawing->setWidth(100);
                        $drawing->setHeight(42);
                        $drawing->setWorksheet($sheet);
                    } catch (\Throwable) {
                        // Imagen no soportada — se omite silenciosamente
                    }
                }

                // ── BORDE EXTERIOR ────────────────────────────────────────────
                if ($ultimaFila >= self::FILA_DATOS_INICIO) {
                    $sheet->getStyle('A1:U'.$ultimaFila)
                        ->getBorders()->getOutline()->setBorderStyle(Border::BORDER_MEDIUM);
                }

                $sheet->freezePane('A'.self::FILA_DATOS_INICIO);

                $sheet->getPageSetup()
                    ->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE)
                    ->setFitToPage(true)
                    ->setFitToWidth(1)
                    ->setFitToHeight(0);

                // ── SECCIÓN INFERIOR: imágenes de referencia + lista de partes ─
                $filaSeccion = $ultimaFila + 2;

                // Título de sección
                $sheet->mergeCells('A'.$filaSeccion.':U'.$filaSeccion);
                $sheet->setCellValue('A'.$filaSeccion, 'A — Codificación de partes inspeccionadas que requieren mantenimiento');
                $sheet->getStyle('A'.$filaSeccion)->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 9],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'D9D9D9']],
                    'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
                ]);
                $sheet->getRowDimension($filaSeccion)->setRowHeight(16);

                $filaImg  = $filaSeccion + 1;
                // Cada fila = 9pt ≈ 12px reales; 16 filas = ~192px
                $alturaImg = 192;
                $filasImg  = 16;

                // ── Imagen 1 (A-E) ────────────────────────────────────────────
                if ($this->rutaRef1) {
                    $sheet->mergeCells('A'.$filaImg.':E'.($filaImg + $filasImg - 1));
                    [$w1, $h1] = @getimagesize($this->rutaRef1) ?: [1, 1];
                    $drawH1 = $alturaImg - 8; // margen 4px arriba y abajo
                    $drawW1 = (int) round($drawH1 * $w1 / max($h1, 1));
                    // Ancho máximo disponible aprox (5 cols × ~55px)
                    $maxW1  = 380;
                    if ($drawW1 > $maxW1) { $drawW1 = $maxW1; $drawH1 = (int) round($drawW1 * $h1 / max($w1, 1)); }
                    $offsetX1 = (int) round(($maxW1 - $drawW1) / 2);
                    $offsetY1 = (int) round(($alturaImg - $drawH1) / 2);
                    $drawing1 = new Drawing();
                    $drawing1->setPath($this->rutaRef1);
                    $drawing1->setCoordinates('A'.$filaImg);
                    $drawing1->setOffsetX($offsetX1);
                    $drawing1->setOffsetY($offsetY1);
                    $drawing1->setWidth($drawW1);
                    $drawing1->setHeight($drawH1);
                    $drawing1->setWorksheet($sheet);
                }

                // ── Imagen 2 (F-J) ────────────────────────────────────────────
                if ($this->rutaRef2) {
                    $sheet->mergeCells('F'.$filaImg.':J'.($filaImg + $filasImg - 1));
                    [$w2, $h2] = @getimagesize($this->rutaRef2) ?: [1, 1];
                    $drawH2 = $alturaImg - 8;
                    $drawW2 = (int) round($drawH2 * $w2 / max($h2, 1));
                    $maxW2  = 300;
                    if ($drawW2 > $maxW2) { $drawW2 = $maxW2; $drawH2 = (int) round($drawW2 * $h2 / max($w2, 1)); }
                    $offsetX2 = (int) round(($maxW2 - $drawW2) / 2);
                    $offsetY2 = (int) round(($alturaImg - $drawH2) / 2);
                    $drawing2 = new Drawing();
                    $drawing2->setPath($this->rutaRef2);
                    $drawing2->setCoordinates('F'.$filaImg);
                    $drawing2->setOffsetX($offsetX2);
                    $drawing2->setOffsetY($offsetY2);
                    $drawing2->setWidth($drawW2);
                    $drawing2->setHeight($drawH2);
                    $drawing2->setWorksheet($sheet);
                }

                // Altura uniforme para las filas del bloque de imágenes
                for ($r = $filaImg; $r < $filaImg + $filasImg; $r++) {
                    $sheet->getRowDimension($r)->setRowHeight(9);
                }

                // ── Lista de partes en 2 columnas (K-P | Q-U) ────────────────
                // Col 1: partes 1-15  →  K(cod) + L:P(desc)
                // Col 2: partes 16-27 →  Q(cod) + R:U(desc), misma fila que col 1
                $filaLista = $filaImg;
                $partes    = self::PARTES;
                $partesArr = array_keys($partes); // ['1','2',...,'27']

                // Cabeceras
                $sheet->setCellValue('K'.$filaLista, 'Cod.');
                $sheet->mergeCells('L'.$filaLista.':P'.$filaLista);
                $sheet->setCellValue('L'.$filaLista, 'Descripción');
                $sheet->setCellValue('Q'.$filaLista, 'Cod.');
                $sheet->mergeCells('R'.$filaLista.':U'.$filaLista);
                $sheet->setCellValue('R'.$filaLista, 'Descripción');
                $sheet->getStyle('K'.$filaLista.':U'.$filaLista)->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 8],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'BDD7EE']],
                    'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                ]);
                $filaLista++;

                $col1 = array_slice($partesArr, 0, 15);  // 1-15
                $col2 = array_slice($partesArr, 15);     // 16-27

                $maxFilas = max(count($col1), count($col2));
                for ($i = 0; $i < $maxFilas; $i++) {
                    // Columna 1
                    if (isset($col1[$i])) {
                        $cod1  = $col1[$i];
                        $desc1 = $partes[$cod1];
                        $sheet->setCellValue('K'.$filaLista, $cod1);
                        $sheet->mergeCells('L'.$filaLista.':P'.$filaLista);
                        $sheet->setCellValue('L'.$filaLista, $desc1);
                        $sheet->getStyle('K'.$filaLista.':P'.$filaLista)->applyFromArray([
                            'font'      => ['size' => 8],
                            'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
                            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
                        ]);
                        $sheet->getStyle('K'.$filaLista)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    }

                    // Columna 2
                    if (isset($col2[$i])) {
                        $cod2  = $col2[$i];
                        $desc2 = $partes[$cod2];
                        $sheet->setCellValue('Q'.$filaLista, $cod2);
                        $sheet->mergeCells('R'.$filaLista.':U'.$filaLista);
                        $sheet->setCellValue('R'.$filaLista, $desc2);
                        $sheet->getStyle('Q'.$filaLista.':U'.$filaLista)->applyFromArray([
                            'font'      => ['size' => 8],
                            'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
                            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
                        ]);
                        $sheet->getStyle('Q'.$filaLista)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    }

                    $sheet->getRowDimension($filaLista)->setRowHeight(9);
                    $filaLista++;
                }
            },
        ];
    }
}
