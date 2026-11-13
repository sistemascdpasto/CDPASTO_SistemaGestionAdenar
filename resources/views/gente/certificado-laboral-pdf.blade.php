<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Certificado Laboral — {{ $colaborador->nombre_completo }}</title>
    <style>
        @page { margin: 2.54cm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12pt; color: #000; line-height: 1.5; text-align: justify; padding: 2.54cm; }

        p { margin-bottom: 20pt; }

        

        /* ── Encabezado: empresa+NIT izquierda (gris), logo derecha ── */
        .cabecera { width: 100%; border-collapse: collapse; margin-bottom: 0; margin-top: 20pt; }
        .cabecera td { padding: 0; }
        .col-empresa { text-align: left; vertical-align: bottom; }
        .col-empresa .razon-social { font-size: 12pt; font-weight: bold; color: #999; line-height: 1.6; }
        .col-empresa .nit { font-size: 12pt; color: #999; line-height: 1.6; }
        .col-logo-fecha { text-align: right; vertical-align: bottom; width: 160pt; padding-top: 60pt; }
        .col-logo-fecha img { height: 45pt; display: block; margin-left: auto; }

        /* Título CERTIFICA */
        .titulo-certifica { text-align: center; font-weight: bold; font-size: 18pt; margin-bottom: 24pt; margin-top: 36pt; }

        /* Firma centrada */
        .firma-wrap { margin-top: 80pt; text-align: center; line-height: 1.6; }
        .firma-linea { width: 200pt; border-top: 1px solid #000; margin: 0 auto 6pt auto; }
        .firma-nombre { font-weight: bold; }

        /* Pie */
        .pie { margin-top: 30pt; text-align: center; font-size: 9pt; border-top: 1px solid #000; padding-top: 8pt; line-height: 1.5; }
    </style>
</head>
<body>

    {{-- Encabezado: empresa+NIT en gris a la izquierda, logo+fecha a la derecha --}}
    @php
        $logoPath = public_path('images/adenarLogo.jpg');
        $logo = file_exists($logoPath)
            ? 'data:image/jpeg;base64,' . base64_encode(file_get_contents($logoPath))
            : null;
    @endphp
    <table class="cabecera">
        <tr>
            <td class="col-empresa" style="vertical-align: middle;">
                <div class="razon-social">ALIANZA DISTRIBUIDORA DE NARIÑO SAS</div>
                <div class="nit">NIT 900.445.467</div>
                <div style="margin-top: 10pt; font-size: 12pt; font-family: Arial, sans-serif;">
                    San Juan de Pasto, {{ $fechaEmision }}.
                </div>
            </td>
            <td class="col-logo-fecha">
                @if($logo)
                    <img src="{{ $logo }}" alt="ADENAR S.A.S.">
                @endif
            </td>
        </tr>
    </table>

    {{-- Párrafo introductorio ANTES de Certifica --}}
    <p style="margin-top: 90pt;">
        La empresa <strong>ALIANZA DISTRIBUIDORA DE NARIÑO S.A.S</strong>, en uso de sus
        facultades legales, constitucionales y reglamentarias:
    </p>

    {{-- Certifica --}}
    <div class="titulo-certifica">Certifica:</div>

    {{-- Cuerpo --}}
    <p>
        Que el señor(a) <strong>{{ mb_strtoupper($colaborador->nombre_completo) }}</strong>,
        identificado(a) con C.C. N.º {{ $colaborador->cedula }}, laboró para la empresa
        <strong>ALIANZA DISTRIBUIDORA DE NARIÑO S.A.S</strong> identificada con
        NIT: 900.445.467-0, con domicilio comercial CALLE 17 No. 15-20 Barrio Fátima
        Pasto-Nariño, en su calidad de <strong>{{ $colaborador->cargo }}</strong>
        desde <strong>{{ $fechaInicio }}</strong> hasta el <strong>{{ $fechaFin }}</strong>,
        relación laboral que estuvo regida por contrato de trabajo, a término fijo.
    </p>

    <p>
        Para constancia se firma a los ({{ $diaFirma }}) días del mes de {{ $mesFirma }}
        de {{ $anioFirma }}, a petición del interesado.
    </p>

    {{-- Firma centrada --}}
    <div class="firma-wrap">
        <div class="firma-linea"></div>
        <div class="firma-nombre">Blanca Maribel Botina Ruiz</div>
        <div>Recursos Humanos</div>
    </div>

    {{-- Pie de página --}}
    <div class="pie">
        Calle 17 15-20 Fátima &nbsp;|&nbsp; Celular 3216853520 &nbsp;|&nbsp;
        Teléfono 6027364754 &nbsp;|&nbsp; correo: 2025.asisconta@gmail.com
    </div>

</body>
</html>
