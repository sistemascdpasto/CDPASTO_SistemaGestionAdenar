<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Preaviso — {{ $colaborador->nombre_completo }}</title>
    <style>
        @page { margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 9.5px; color: #000; line-height: 1.45; padding: 40px 60px 45px 60px; }

        p { margin-bottom: 14px; text-align: justify; }

        /* Logo */
        .logo-wrap { text-align: right; height: 70px; }
        .logo-wrap img { height: 62px; }

        /* Fecha y destinatario */
        .fecha { margin-top: 10px; margin-bottom: 14px; }
        .destinatario { margin-bottom: 18px; }

        /* Referente */
        .referente { text-align: right; margin-bottom: 18px; padding-right: 0; }
        .referente span { display: inline-block; width: 78%; text-align: left; }

        /* Bloque inferior: firma + recibido */
        .tabla-pie { width: 100%; border-collapse: collapse; margin-top: 6px; }
        .tabla-pie td { vertical-align: top; }
        .col-izq { width: 52%; }
        .col-der { width: 48%; }

        .firma-nombre { font-weight: bold; margin-top: 22px; }

        /* Cuadro RECIBIDO */
        .recibido { width: 100%; border-collapse: collapse; }
        .recibido td { border: 1px solid #000; padding: 3px 5px; }
        .recibido .titulo { text-align: center; font-size: 9px; }
        .recibido .espacio { height: 48px; }
        .recibido .nombre { text-align: center; font-weight: bold; font-size: 8px; }
        .recibido .dma { width: 33.33%; font-size: 9px; }

        /* Dirección al pie */
        .direccion { margin-top: 55px; text-align: center; font-family: "DejaVu Serif", serif; font-weight: bold; font-size: 9.5px; }
    </style>
</head>
<body>

    {{-- Logo --}}
    <div class="logo-wrap">
        @php
            $logoPath = public_path('images/logo-adenar.png');
            $logo = file_exists($logoPath)
                ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath))
                : null;
        @endphp
        @if($logo)
            <img src="{{ $logo }}" alt="ADENAR S.A.S.">
        @endif
    </div>

    {{-- Fecha --}}
    <div class="fecha">San Juan de Pasto, {{ $fechaEmision }}.</div>

    {{-- Destinatario --}}
    <div class="destinatario">
        Señor<br>
        <strong>{{ mb_strtoupper($colaborador->nombre_completo) }}</strong><br>
        Trabajador ADENAR S.A.S
    </div>

    {{-- Referente --}}
    <div style="margin-left: 32%; margin-bottom: 18px;">
    Referente: Preaviso-Terminación de la relación laboral
</div>

    {{-- Cuerpo --}}
    <p>
        {{ mb_strtoupper($representante['nombre'] ?? 'FRANCISCO JAVIER MADROÑERO PORTILLA') }},
        identificado con cedula de ciudadanía No. {{ $representante['cedula'] ?? '87.533.067' }},
        en mi calidad de Gerente General y Representante legal de la empresa
        {{ $empresa['razon_social'] ?? 'ALIANZA DISTRIBUIDORA DE NARIÑO' }},
        identificada con NIT No. {{ $empresa['nit'] ?? '900445467-0' }},
        por medio del presente escrito me permito informar la decisión de
        <strong>NO PRORROGAR</strong> el término del contrato de trabajo firmado el
        {{ $colaborador->fecha_ingreso_empresa?->translatedFormat('j \d\e F \d\e Y') ?? '—' }}; con prórroga {{ isset($fechaProrroga) ? 'del '.$fechaProrroga.' ' : '' }}entre usted y la
        sociedad que represento y cuya fecha de terminación obedece el día
        {{ $nuevaFechaFinalizacion }}.
    </p>

    <p>
        La anterior determinación se sustenta en el literal C, del artículo 61 del código
        sustantivo del trabajo, modificado por el decreto 2351 de 1965 artículo 6 modificado
        por la ley 50 de 1990 artículo 5, fundamento en el cual el contrato suscrito entre la
        empresa y el mencionado está próximo a expirar el plazo fijo pactado.
    </p>

    <p>
        Por lo anterior, le serán canceladas sus prestaciones sociales y demás acreencias
        laborales de las cuales es usted benefactor, la empresa ADENAR S.A.S, expedirá la
        orden para la realización del examen médico de retiro como lo prevé la norma en
        comento y se informará con anticipación de la práctica de la misma.
    </p>

    <p>
        Solo nos queda agradecer el servicio prestado a nuestra entidad, deseándole los
        mejores éxitos en sus nuevas labores que desempeñe.
    </p>

    {{-- Pie: copia / firma + RECIBIDO --}}
    <table class="tabla-pie">
        <tr>
            <td class="col-izq">
                <div>Copia a la Hoja de Vida</div>
                <div style="margin-top: 14px;">No siendo otro el objeto de la presente.</div>
            </td>
            <td class="col-der">
                <table class="recibido">
                    <tr><td class="titulo" colspan="3">RECIBIDO</td></tr>
                    <tr><td class="espacio" colspan="3"></td></tr>
                    <tr><td class="nombre" colspan="3">{{ mb_strtoupper($colaborador->nombre_completo) }}</td></tr>
                    <tr>
                        <td class="dma">DIA</td>
                        <td class="dma">MES</td>
                        <td class="dma">AÑO</td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td colspan="2">
                <div class="firma-nombre">{{ mb_strtoupper($representante['nombre'] ?? 'FRANCISCO JAVIER MADROÑERO PORTILLA') }}</div>
                <div>C.C. {{ $representante['cedula'] ?? '87.533.067' }}</div>
                <div>Gerente General y Representante Legal</div>
                <div>ADENAR S.A.S</div>
            </td>
        </tr>
    </table>

    {{-- Dirección --}}
    <div class="direccion">
        CALLE 17 No. 15-20 Barrio Fátima de la ciudad de Pasto-Nariño
    </div>

</body>
</html>
