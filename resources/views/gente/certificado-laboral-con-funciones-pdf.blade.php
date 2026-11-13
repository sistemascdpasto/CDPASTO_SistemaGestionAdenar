<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Certificado Laboral con Funciones — {{ $colaborador->nombre_completo }}</title>
    <style>
        @page { margin: 2.54cm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            color: #000;
            line-height: 1.5;
            text-align: justify;
            padding: 2.54cm;
        }

        p { margin-bottom: 20pt; }

        /* ── Encabezado ── */
        .cabecera { width: 100%; border-collapse: collapse; margin-bottom: 0; }
        .cabecera td { padding: 0; }
        .col-empresa { text-align: left; vertical-align: middle; }
        .col-empresa .razon-social { font-size: 11pt; font-weight: bold; color: #888; line-height: 1.6; }
        .col-empresa .nit          { font-size: 11pt; color: #888; line-height: 1.6; }
        .col-empresa .fecha-emision { font-size: 12pt; margin-top: 12pt; }
        .col-logo { text-align: right; vertical-align: middle; width: 155pt; }
        .col-logo img { height: 50pt; display: block; margin-left: auto; }

        /* ── Título Certifica ── */
        .titulo-certifica {
            text-align: center;
            font-weight: bold;
            font-size: 18pt;
            margin-top: 28pt;
            margin-bottom: 20pt;
        }

        /* ── Bloque de cargo con funciones ── */
        .cargo-bloque { margin-bottom: 16pt; }

        .cargo-encabezado {
            font-weight: bold;
            font-size: 12pt;
            margin-bottom: 6pt;
        }

        .cargo-encabezado .cargo-fechas {
            font-weight: normal;
            font-size: 9pt;
            color: #333;
        }

        .funciones-lista {
            margin-left: 20pt;
            margin-top: 4pt;
        }

        .funciones-lista li {
            margin-bottom: 4pt;
            font-size: 12pt;
        }

        /* ── Firma ── */
        .firma-wrap {
            margin-top: 70pt;
            text-align: center;
            line-height: 1.8;
        }
        .firma-linea {
            width: 200pt;
            border-top: 1px solid #000;
            margin: 0 auto 6pt auto;
        }
        .firma-nombre { font-weight: bold; }

        /* ── Pie ── */
        .pie {
            margin-top: 28pt;
            text-align: center;
            font-size: 9pt;
            border-top: 1px solid #000;
            padding-top: 7pt;
            line-height: 1.5;
        }
    </style>
</head>
<body>

    @php
        $logoPath = public_path('images/adenarLogo.jpg');
        $logo = file_exists($logoPath)
            ? 'data:image/jpeg;base64,' . base64_encode(file_get_contents($logoPath))
            : null;
    @endphp

    {{-- Encabezado --}}
    <table class="cabecera">
        <tr>
            <td class="col-empresa">
                <div class="razon-social">ALIANZA DISTRIBUIDORA DE NARIÑO SAS</div>
                <div class="nit">NIT 900.445.467</div>
                <div class="fecha-emision">San Juan de Pasto, {{ $fechaEmision }}.</div>
            </td>
            <td class="col-logo">
                @if($logo)
                    <img src="{{ $logo }}" alt="ADENAR S.A.S.">
                @endif
            </td>
        </tr>
    </table>

    {{-- Párrafo introductorio --}}
    <p style="margin-top: 30pt;">
        La empresa <strong>ALIANZA DISTRIBUIDORA DE NARIÑO S.A.S</strong>, en uso de sus
        facultades legales, constitucionales y reglamentarias:
    </p>

    {{-- Certifica --}}
    <div class="titulo-certifica">Certifica:</div>

    {{-- Cuerpo principal --}}
    <p>
        Que el señor(a) <strong>{{ mb_strtoupper($colaborador->nombre_completo) }}</strong>,
        identificado(a) con C.C. N.º {{ $colaborador->cedula }}, laboró para la empresa
        <strong>ALIANZA DISTRIBUIDORA DE NARIÑO S.A.S</strong> identificada con
        NIT: 900.445.467-0, con domicilio comercial CALLE 17 No. 15-20 Barrio Fátima
        Pasto-Nariño, en su calidad de <strong>{{ $colaborador->cargo }}</strong>
        desde <strong>{{ $fechaInicio }}</strong> hasta el <strong>{{ $fechaFin }}</strong>,
        relación laboral que estuvo regida por contrato de trabajo, a término fijo;
        donde se desempeñó con aptitud y buen comportamiento. En las siguientes funciones:
    </p>

    {{-- Funciones por cargo --}}
    @php
        $cargosConPerfil = $cargos->filter(fn($c) => !empty($c['perfil']));
    @endphp

    @if($cargosConPerfil->isNotEmpty())
        @foreach($cargosConPerfil as $cargoItem)
            @php
                $lineas = array_values(array_filter(
                    array_map('trim', preg_split('/\r\n|\r|\n/', $cargoItem['perfil'])),
                    fn($l) => $l !== ''
                ));

                // Construir etiqueta de fechas
                $fechasCargo = '';
                if (!empty($cargoItem['fecha_inicio']) || !empty($cargoItem['fecha_fin'])) {
                    $fechasCargo = '(' . ($cargoItem['fecha_inicio'] ?? '—');
                    if (!empty($cargoItem['fecha_fin'])) {
                        $fechasCargo .= ' — ' . $cargoItem['fecha_fin'];
                    }
                    $fechasCargo .= '.)';
                }
            @endphp

            <div class="cargo-bloque">
                <div class="cargo-encabezado">
                    {{ mb_strtoupper($cargoItem['cargo']) }}
                    @if(!empty($cargoItem['area']))
                        &mdash; {{ $cargoItem['area'] }}
                    @endif
                    @if($fechasCargo)
                        <span class="cargo-fechas">&nbsp;&nbsp;{{ $fechasCargo }}</span>
                    @endif
                </div>

                @if(count($lineas) > 1)
                    <ul class="funciones-lista">
                        @foreach($lineas as $linea)
                            <li>{{ $linea }}</li>
                        @endforeach
                    </ul>
                @elseif(count($lineas) === 1)
                    <p style="margin-bottom: 0; margin-top: 4pt;">{{ $lineas[0] }}</p>
                @endif
            </div>
        @endforeach
    @else
        <p><em>No se registraron funciones para los cargos desempeñados.</em></p>
    @endif

    <p style="margin-top: 20pt;">
        Para constancia se firma a los ({{ $diaFirma }}) días del mes de {{ $mesFirma }}
        de {{ $anioFirma }}, a petición del interesado.
    </p>

    {{-- Firma --}}
    <div class="firma-wrap">
        <div class="firma-linea"></div>
        <div class="firma-nombre">Blanca Maribel Botina Ruiz</div>
        <div>Recursos Humanos</div>
    </div>

    {{-- Pie --}}
    <div class="pie">
        Calle 17 15-20 Fátima &nbsp;|&nbsp; Celular 3216853520 &nbsp;|&nbsp;
        Teléfono 6027364754 &nbsp;|&nbsp; correo: 2025.asisconta@gmail.com
    </div>

</body>
</html>
