<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Dotación y EPP — {{ $colaborador->nombre_completo }}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 9px; color: #111; padding: 18px; }

        /* Encabezado */
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; border-bottom: 2px solid #D4102A; padding-bottom: 8px; }
        .header h1 { font-size: 14px; color: #D4102A; }
        .header .subtitulo { font-size: 9px; color: #374151; margin-top: 2px; }
        .header .meta { text-align: right; font-size: 7.5px; color: #6b7280; }
        .header .meta strong { color: #374151; }

        /* Secciones */
        .seccion { margin-bottom: 12px; }
        .seccion-titulo { font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 7px; }

        /* Grid de datos */
        .grid { display: flex; flex-wrap: wrap; gap: 6px 16px; }
        .campo { width: 22%; min-width: 110px; }
        .campo-label { font-size: 7.5px; color: #9ca3af; margin-bottom: 1px; }
        .campo-valor { font-size: 9px; color: #111827; font-weight: 500; }

        /* Tabla de entregas */
        table { width: 100%; border-collapse: collapse; font-size: 7.5px; margin-top: 4px; }
        th { background: #fef2f2; color: #D4102A; font-weight: 700; border: 1px solid #fecaca; padding: 3px 4px; text-align: center; }
        th.col-fecha { text-align: left; }
        td { border: 1px solid #e5e7eb; padding: 3px 4px; vertical-align: middle; color: #374151; text-align: center; }
        td.col-fecha { text-align: left; }
        tr:nth-child(even) td { background: #f9fafb; }
        .marca-si { color: #15803d; font-weight: bold; }
        .marca-no { color: #d1d5db; }
        .firma-mini { max-height: 26px; max-width: 70px; }

        /* Firmas */
        .firmas-grid { display: flex; gap: 30px; }
        .firma-bloque { flex: 1; }
        .firma-nombre { font-size: 9px; font-weight: 600; color: #111827; margin-top: 4px; }
        .firma-detalle { font-size: 7.5px; color: #6b7280; }
        .firma-img { max-height: 60px; max-width: 200px; border: 1px solid #e5e7eb; background: #fff; margin-top: 4px; }
        .firma-vacia { width: 200px; height: 60px; border: 1px dashed #d1d5db; margin-top: 4px; }

        /* Compromiso */
        .compromiso-texto { font-size: 8px; color: #374151; line-height: 1.5; text-align: justify; }
        .compromiso-texto p { margin-bottom: 5px; }

        /* Footer */
        .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 6px; font-size: 7.5px; color: #9ca3af; display: flex; justify-content: space-between; }
    </style>
</head>

@php
    $imgUri = function (?string $path): ?string {
        if (! $path || ! \Illuminate\Support\Facades\Storage::disk('public')->exists($path)) {
            return null;
        }
        $mime = \Illuminate\Support\Facades\Storage::disk('public')->mimeType($path);
        $contents = \Illuminate\Support\Facades\Storage::disk('public')->get($path);
        return "data:{$mime};base64," . base64_encode($contents);
    };

    $items = \App\Models\Seguridad\EppEntrega::ITEMS;
    $compromisoFirmaUri = $imgUri($perfil?->compromiso_firma_path);
@endphp

<body>

    {{-- ── Encabezado ── --}}
    <div class="header">
        <div>
            <h1>Control de Entrega de Elementos de Protección Personal y Dotación</h1>
            <div class="subtitulo">{{ $colaborador->nombre_completo }} — C.C. {{ $colaborador->cedula }}</div>
        </div>
        <div class="meta">
            <div><strong>Código:</strong> PAS-BAV-SST-FR-005</div>
            <div><strong>Generado:</strong> {{ now()->format('d/m/Y H:i') }}</div>
        </div>
    </div>

    {{-- ── Datos del colaborador ── --}}
    <div class="seccion">
        <div class="seccion-titulo">Datos del Colaborador</div>
        <div class="grid">
            <div class="campo"><div class="campo-label">Nombre</div><div class="campo-valor">{{ $colaborador->nombre_completo }}</div></div>
            <div class="campo"><div class="campo-label">C.C.</div><div class="campo-valor">{{ $colaborador->cedula }}</div></div>
            <div class="campo"><div class="campo-label">Centro</div><div class="campo-valor">{{ $colaborador->centro ?? '—' }}</div></div>
            <div class="campo"><div class="campo-label">Área y cargo</div><div class="campo-valor">{{ collect([$colaborador->area, $colaborador->cargo])->filter()->implode(' · ') ?: '—' }}</div></div>
            <div class="campo"><div class="campo-label">Fecha ingreso</div><div class="campo-valor">{{ $colaborador->fecha_ingreso_empresa?->format('d/m/Y') ?? '—' }}</div></div>
        </div>
    </div>

    {{-- ── Tallas ── --}}
    <div class="seccion">
        <div class="seccion-titulo">Tallas</div>
        <div class="grid">
            <div class="campo"><div class="campo-label">Calzado</div><div class="campo-valor">{{ $perfil?->talla_calzado ?? '—' }}</div></div>
            <div class="campo"><div class="campo-label">Camisa</div><div class="campo-valor">{{ $perfil?->talla_camisa ?? '—' }}</div></div>
            <div class="campo"><div class="campo-label">Pantalón</div><div class="campo-valor">{{ $perfil?->talla_pantalon ?? '—' }}</div></div>
            <div class="campo"><div class="campo-label">Otros</div><div class="campo-valor">{{ $perfil?->talla_otros ?? '—' }}</div></div>
        </div>
    </div>

    {{-- ── Histórico de entregas ── --}}
    <div class="seccion">
        <div class="seccion-titulo">Histórico de Entregas ({{ $entregas->count() }})</div>
        @if($entregas->isEmpty())
            <p style="color:#9ca3af;">Sin entregas registradas.</p>
        @else
        <table>
            <thead>
                <tr>
                    <th class="col-fecha" style="width:10%">Fecha</th>
                    @foreach($items as $label)
                        <th>{{ $label }}</th>
                    @endforeach
                    <th style="width:10%">Firma</th>
                </tr>
            </thead>
            <tbody>
                @foreach($entregas as $entrega)
                <tr>
                    <td class="col-fecha">{{ $entrega->fecha_entrega->format('d/m/Y') }}</td>
                    @foreach(array_keys($items) as $campo)
                        <td>
                            @if($entrega->$campo)
                                <span class="marca-si">✓</span>
                                @if($campo === 'otros' && $entrega->otros_cual)
                                    <br><span style="font-size:6.5px;">{{ $entrega->otros_cual }}</span>
                                @endif
                            @else
                                <span class="marca-no">—</span>
                            @endif
                        </td>
                    @endforeach
                    <td>
                        @php $firmaUri = $imgUri($entrega->firma_path); @endphp
                        @if($firmaUri)
                            <img class="firma-mini" src="{{ $firmaUri }}" alt="Firma">
                        @else
                            —
                        @endif
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
        @endif
    </div>

    {{-- ── Compromiso ── --}}
    <div class="seccion">
        <div class="seccion-titulo">Compromiso del Trabajador</div>
        <div class="compromiso-texto">
            <p>Yo, {{ $colaborador->nombre_completo }}, identificado con C.C. {{ $colaborador->cedula }}, me comprometo a:</p>
            <p>* Utilizar de forma correcta la dotación entregada a mi cargo de acuerdo a las normas y políticas establecidas por la empresa.</p>
            <p>* En caso de terminación del contrato laboral, cambio de cargo o traslado, devolver la totalidad de las prendas que contengan el logo o el nombre de la empresa al departamento de talento humano.</p>
            <p>* Utilizar de manera correcta los elementos de protección personal durante la jornada laboral y áreas cuya obligatoriedad de uso esté establecido y mantenerlos en buen estado, dando cumplimiento a las normas de Seguridad y Salud en el Trabajo de la empresa.</p>
            <p>* Que a partir de la fecha de entrega, es de uso obligatorio portar el uniforme establecido por la empresa y los elementos de protección personal asignados a mis labores sin excepción alguna.</p>
            <p>* He comprendido que el incumplimiento de mi parte a los compromisos anteriores, genera llamados de atención, memorandos y sanciones de acuerdo a lo establecido en el reglamento interno de trabajo como una falta.</p>
        </div>
        <div class="firmas-grid" style="margin-top:8px;">
            <div class="firma-bloque">
                <div class="firma-nombre">{{ $colaborador->nombre_completo }}</div>
                <div class="firma-detalle">C.C. {{ $colaborador->cedula }}</div>
                @if($perfil?->compromiso_firmado_en)
                    <div class="firma-detalle">Firmado el {{ $perfil->compromiso_firmado_en->format('d/m/Y H:i') }}</div>
                @endif
                @if($compromisoFirmaUri)
                    <img class="firma-img" src="{{ $compromisoFirmaUri }}" alt="Firma del compromiso">
                @else
                    <div class="firma-vacia"></div>
                @endif
            </div>
        </div>
    </div>

    {{-- ── Footer ── --}}
    <div class="footer">
        <span>{{ $colaborador->nombre_completo }} — C.C. {{ $colaborador->cedula }}</span>
        <span>{{ now()->format('d/m/Y H:i') }}</span>
    </div>

</body>
</html>
