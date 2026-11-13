<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Hoja de Vida - {{ $colaborador->nombre_completo }}</title>
    <style>
        @page { margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 9.5px; color: #111; line-height: 1.5; padding: 30px 45px 35px 45px; }

        /* Encabezado */
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .header-table td { vertical-align: middle; }
        .td-logo { width: 85px; }
        .td-logo img { width: 75px; }
        .td-nombre { padding-left: 14px; border-left: 4px solid #059669; }
        .td-nombre .nombre { font-size: 14px; font-weight: bold; color: #064e3b; text-transform: uppercase; }
        .td-nombre .cargo { font-size: 9.5px; color: #047857; margin-top: 2px; }
        .td-nombre .cedula { font-size: 8.5px; color: #6b7280; margin-top: 1px; }
        .td-foto { width: 70px; }
        .td-foto img { width: 60px; height: 60px; border: 2px solid #d1fae5; }

        /* Separador */
        hr { border: none; border-top: 1.5px solid #d1fae5; margin: 8px 0; }

        /* Barra rapida */
        .bar-table { width: 100%; border-collapse: collapse; background: #f0fdf4; margin-bottom: 12px; }
        .bar-table td { padding: 5px 10px; border-right: 1px solid #d1fae5; border-top: 1px solid #d1fae5; border-bottom: 1px solid #d1fae5; vertical-align: top; }
        .bar-table td:first-child { border-left: 1px solid #d1fae5; }
        .bar-label { font-size: 7px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #059669; }
        .bar-value { font-size: 9px; font-weight: bold; color: #064e3b; }

        /* Titulo de seccion */
        .sec-title { font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.7px; color: #047857; border-left: 3px solid #10b981; padding-left: 6px; margin-bottom: 6px; margin-top: 12px; }

        /* Tabla de campos */
        .fields { width: 100%; border-collapse: collapse; margin-bottom: 2px; }
        .fields td { vertical-align: top; padding: 2px 10px 4px 0; width: 25%; }
        .fl { font-size: 7.5px; color: #6b7280; }
        .fv { font-size: 9px; font-weight: bold; color: #111; }

        /* Caja de hijo */
        .hijo { background: #f0fdf4; border: 1px solid #d1fae5; padding: 2px 6px; margin-bottom: 2px; font-size: 8.5px; }

        /* Layout 2 columnas usando tabla */
        .layout { width: 100%; border-collapse: collapse; }
        .col-main { width: 65%; vertical-align: top; padding-right: 14px; }
        .col-side { width: 35%; vertical-align: top; border-left: 1px solid #e5e7eb; padding-left: 14px; }

        /* Items de columna lateral */
        .side-item { font-size: 8.5px; color: #111; margin-bottom: 3px; padding-left: 10px; }
        .side-dot { font-weight: bold; color: #10b981; margin-right: 3px; }
        .side-lbl { font-weight: bold; }

        /* Emergencia */
        .emerg-nombre { font-size: 8.5px; font-weight: bold; margin-bottom: 1px; }
        .emerg-sub { font-size: 7.5px; color: #6b7280; }

        /* Pie */
        .footer { margin-top: 16px; border-top: 1px solid #d1fae5; padding-top: 5px; text-align: center; font-size: 7.5px; color: #9ca3af; }
    </style>
</head>
<body>

@php
    $logoPath = public_path('images/logo-adenar.png');
    $logo = file_exists($logoPath)
        ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath))
        : null;

    $fotoRel  = $colaborador->imagen;
    $fotoPath = $fotoRel
        ? (str_starts_with($fotoRel, '/')
            ? public_path(ltrim($fotoRel, '/'))
            : storage_path('app/public/' . $fotoRel))
        : null;
    $fotoExt  = $fotoPath ? (str_ends_with(strtolower($fotoPath), '.png') ? 'png' : 'jpeg') : null;
    $foto     = ($fotoPath && file_exists($fotoPath))
        ? 'data:image/' . $fotoExt . ';base64,' . base64_encode(file_get_contents($fotoPath))
        : null;

    $ap = fn($v) => match($v) { 'aplica' => 'Aplica', 'no_aplica' => 'No aplica', default => $v ?? '-' };
    $sn = fn($v) => match($v) { 'si' => 'Si', 'no' => 'No', default => $v ?? '-' };
    $sx = fn($v) => match($v) { 'femenino' => 'Femenino', 'masculino' => 'Masculino', default => $v ?? '-' };
    $fd = fn($v) => $v ? (is_string($v) ? $v : $v->format('d/m/Y')) : '-';
@endphp

{{-- ═══ ENCABEZADO ═══ --}}
<table class="header-table">
    <tr>
        <td class="td-foto">
            @if($foto)
                <img src="{{ $foto }}" alt="Foto">
            @endif
        </td>
        <td class="td-nombre">
            <div class="nombre">{{ $colaborador->nombre_completo }}</div>
            @if($colaborador->cargo)<div class="cargo">{{ $colaborador->cargo }}</div>@endif
            <div class="cedula">{{ $colaborador->tipo_documento ?? 'C.C.' }} {{ $colaborador->cedula }}</div>
        </td>
        <td class="td-logo">
            @if($logo)<img src="{{ $logo }}" alt="ADENAR">@endif
        </td>
    </tr>
</table>

<hr>

{{-- ═══ BARRA RAPIDA ═══ --}}
<table class="bar-table">
    <tr>
        @if($colaborador->area)
        <td><div class="bar-label">Area</div><div class="bar-value">{{ $colaborador->area }}</div></td>
        @endif
        @if($colaborador->centro_trabajo)
        <td><div class="bar-label">Centro</div><div class="bar-value">{{ $colaborador->centro_trabajo }}</div></td>
        @endif
        @if($colaborador->tipo_contrato)
        <td><div class="bar-label">Tipo contrato</div><div class="bar-value">{{ $colaborador->tipo_contrato }}</div></td>
        @endif
        @if($colaborador->fecha_ingreso_empresa)
        <td><div class="bar-label">Fecha ingreso</div><div class="bar-value">{{ $fd($colaborador->fecha_ingreso_empresa) }}</div></td>
        @endif
        <td><div class="bar-label">Estado</div><div class="bar-value">{{ $colaborador->tieneFinalizacionConfirmada() ? 'Finalizado' : ($colaborador->is_active ? 'Activo' : 'Inactivo') }}</div></td>
    </tr>
</table>

{{-- ═══ CUERPO 2 COLUMNAS ═══ --}}
<table class="layout">
<tr>

{{-- ══ COLUMNA PRINCIPAL ══ --}}
<td class="col-main">

    @if($colaborador->expedido_en || $colaborador->sexo || $colaborador->fecha_nacimiento)
    <div class="sec-title">Identificacion</div>
    <table class="fields">
        <tr>
            @if($colaborador->expedido_en)<td><div class="fl">Expedido en</div><div class="fv">{{ $colaborador->expedido_en }}</div></td>@endif
            @if($colaborador->sexo)<td><div class="fl">Sexo</div><div class="fv">{{ $sx($colaborador->sexo) }}</div></td>@endif
            @if($colaborador->fecha_nacimiento)<td><div class="fl">Nacimiento</div><div class="fv">{{ $fd($colaborador->fecha_nacimiento) }}</div></td>@endif
            @if($colaborador->fecha_nacimiento)<td><div class="fl">Edad</div><div class="fv">{{ \Carbon\Carbon::parse($colaborador->fecha_nacimiento)->age }} anos</div></td>@endif
        </tr>
    </table>
    @endif

    @if($colaborador->estado_civil || $colaborador->nombre_pareja)
    <div class="sec-title">Informacion personal</div>
    <table class="fields">
        <tr>
            @if($colaborador->estado_civil)
            <td><div class="fl">Estado civil</div><div class="fv">{{ $colaborador->estado_civil === 'Otro' ? ($colaborador->estado_civil_otro ?? 'Otro') : $colaborador->estado_civil }}</div></td>
            @endif
            @if($colaborador->nombre_pareja)
            <td colspan="3"><div class="fl">Conyuge / companero(a)</div><div class="fv">{{ $colaborador->nombre_pareja }}</div></td>
            @endif
        </tr>
    </table>
    @php
        $hijos = is_array($colaborador->hijos)
            ? $colaborador->hijos
            : (is_string($colaborador->hijos) ? json_decode($colaborador->hijos, true) : []);
        $hijos = $hijos ?? [];
    @endphp
    @if(count($hijos) > 0)
        <div style="font-size:7.5px; color:#6b7280; margin:4px 0 2px 0;">Hijos</div>
        @foreach($hijos as $hijo)
            @php $edadHijo = !empty($hijo['edad']) ? $hijo['edad'] : null; @endphp
            <div class="hijo">{{ $hijo['nombre'] ?? '-' }}{{ $edadHijo ? ' - ' . $edadHijo . ' anos' : '' }}</div>
        @endforeach
    @endif
    @endif

    @if($colaborador->discapacidad || $colaborador->victima_conflicto || $colaborador->libreta_militar || $colaborador->runt_aplica)
    <div class="sec-title">Condiciones particulares</div>
    <table class="fields">
        <tr>
            @if($colaborador->discapacidad)<td><div class="fl">Discapacidad</div><div class="fv">{{ $ap($colaborador->discapacidad) }}</div></td>@endif
            @if($colaborador->discapacidad === 'aplica' && $colaborador->discapacidad_tipo)<td><div class="fl">Tipo</div><div class="fv">{{ $colaborador->discapacidad_tipo }}</div></td>@endif
            @if($colaborador->victima_conflicto)<td><div class="fl">Victima conflicto</div><div class="fv">{{ $sn($colaborador->victima_conflicto) }}</div></td>@endif
            @if($colaborador->libreta_militar)<td><div class="fl">Libreta militar</div><div class="fv">{{ $ap($colaborador->libreta_militar) }}</div></td>@endif
        </tr>
    </table>
    @endif

    @if($colaborador->ha_trabajado_antes || $colaborador->cargo_anterior || $colaborador->fecha_ultima_laboral || $colaborador->motivo_retiro)
    <div class="sec-title">Antecedentes en la empresa</div>
    <table class="fields">
        <tr>
            @if($colaborador->ha_trabajado_antes)<td><div class="fl">Trabajo antes?</div><div class="fv">{{ $sn($colaborador->ha_trabajado_antes) }}</div></td>@endif
            @if($colaborador->cargo_anterior)<td><div class="fl">Cargo anterior</div><div class="fv">{{ $colaborador->cargo_anterior }}</div></td>@endif
            @if($colaborador->fecha_ultima_laboral)<td><div class="fl">Ultima laboral</div><div class="fv">{{ $fd($colaborador->fecha_ultima_laboral) }}</div></td>@endif
            @if($colaborador->motivo_retiro)<td><div class="fl">Motivo retiro</div><div class="fv">{{ $colaborador->motivo_retiro }}</div></td>@endif
        </tr>
    </table>
    @endif

    @if($colaborador->tiene_experiencia || $colaborador->area_experiencia || $colaborador->cargo_experiencia || $colaborador->anios_experiencia)
    <div class="sec-title">Experiencia</div>
    <table class="fields">
        <tr>
            @if($colaborador->tiene_experiencia)<td><div class="fl">Tiene experiencia?</div><div class="fv">{{ $sn($colaborador->tiene_experiencia) }}</div></td>@endif
            @if($colaborador->area_experiencia)<td><div class="fl">Area</div><div class="fv">{{ $colaborador->area_experiencia }}</div></td>@endif
            @if($colaborador->cargo_experiencia)<td><div class="fl">Cargo</div><div class="fv">{{ $colaborador->cargo_experiencia }}</div></td>@endif
            @if($colaborador->anios_experiencia)<td><div class="fl">Anos</div><div class="fv">{{ $colaborador->anios_experiencia }}</div></td>@endif
        </tr>
    </table>
    @endif

    @if($colaborador->manejo_defensivo_aplica || $colaborador->conduccion_carga_pesada_aplica || $colaborador->experiencia_terreno_plano || $colaborador->experiencia_terreno_montanoso)
    <div class="sec-title">Requisitos del cargo</div>
    <table class="fields">
        <tr>
            @if($colaborador->manejo_defensivo_aplica)<td><div class="fl">Manejo defensivo</div><div class="fv">{{ $ap($colaborador->manejo_defensivo_aplica) }}</div></td>@endif
            @if($colaborador->conduccion_carga_pesada_aplica)<td><div class="fl">Carga pesada</div><div class="fv">{{ $ap($colaborador->conduccion_carga_pesada_aplica) }}</div></td>@endif
            @if($colaborador->experiencia_terreno_plano)<td><div class="fl">Terreno plano</div><div class="fv">{{ $sn($colaborador->experiencia_terreno_plano) }}</div></td>@endif
            @if($colaborador->experiencia_terreno_montanoso)<td><div class="fl">Terreno montanoso</div><div class="fv">{{ $sn($colaborador->experiencia_terreno_montanoso) }}</div></td>@endif
        </tr>
    </table>
    @endif

    @php
        $cats = is_array($colaborador->licencia_conduccion_categorias)
            ? $colaborador->licencia_conduccion_categorias
            : (is_string($colaborador->licencia_conduccion_categorias) ? json_decode($colaborador->licencia_conduccion_categorias, true) : []);
        $cats = $cats ?? [];
    @endphp
    @if(count($cats) > 0 || $colaborador->fecha_licencia || $colaborador->fecha_vencimiento_licencia)
    <div class="sec-title">Licencia de conduccion</div>
    <table class="fields">
        <tr>
            @if($cats && count($cats) > 0)<td><div class="fl">Categorias</div><div class="fv">{{ implode(', ', $cats) }}</div></td>@endif
            @if($colaborador->fecha_licencia)<td><div class="fl">Fecha licencia</div><div class="fv">{{ $fd($colaborador->fecha_licencia) }}</div></td>@endif
            @if($colaborador->fecha_vencimiento_licencia)<td><div class="fl">Vencimiento</div><div class="fv">{{ $fd($colaborador->fecha_vencimiento_licencia) }}</div></td>@endif
            @if($colaborador->restricciones_licencia)<td><div class="fl">Restricciones</div><div class="fv">{{ $colaborador->restricciones_licencia }}</div></td>@endif
        </tr>
    </table>
    @endif

    @if($colaborador->sena_especialidad || $colaborador->sena_institucion)
    <div class="sec-title">Aprendiz SENA</div>
    <table class="fields">
        <tr>
            @if($colaborador->sena_especialidad)<td><div class="fl">Especialidad</div><div class="fv">{{ $colaborador->sena_especialidad }}</div></td>@endif
            @if($colaborador->sena_numero_grupo)<td><div class="fl">N. grupo</div><div class="fv">{{ $colaborador->sena_numero_grupo }}</div></td>@endif
            @if($colaborador->sena_institucion)<td><div class="fl">Institucion</div><div class="fv">{{ $colaborador->sena_institucion }}</div></td>@endif
            @if($colaborador->sena_centro_formacion)<td><div class="fl">Centro formacion</div><div class="fv">{{ $colaborador->sena_centro_formacion }}</div></td>@endif
        </tr>
    </table>
    @endif

</td>

{{-- ══ COLUMNA LATERAL ══ --}}
<td class="col-side">

    @if($colaborador->celular_1 || $colaborador->celular_2 || $colaborador->correo || $colaborador->ciudad_residencia || $colaborador->direccion)
    <div class="sec-title">Contacto</div>
    @if($colaborador->celular_1)<div class="side-item"><span class="side-dot">&#9679;</span>{{ $colaborador->celular_1 }}</div>@endif
    @if($colaborador->celular_2)<div class="side-item"><span class="side-dot">&#9679;</span>{{ $colaborador->celular_2 }}</div>@endif
    @if($colaborador->correo)<div class="side-item" style="word-break:break-all;"><span class="side-dot">&#9679;</span>{{ $colaborador->correo }}</div>@endif
    @if($colaborador->ciudad_residencia)<div class="side-item"><span class="side-dot">&#9679;</span>{{ $colaborador->ciudad_residencia }}</div>@endif
    @if($colaborador->estrato)<div class="side-item"><span class="side-dot">&#9679;</span>Estrato {{ $colaborador->estrato }}</div>@endif
    @if($colaborador->direccion)<div class="side-item"><span class="side-dot">&#9679;</span>{{ $colaborador->direccion }}</div>@endif
    @endif

    @if($colaborador->eps || $colaborador->afp || $colaborador->arl)
    <div class="sec-title" style="margin-top:14px;">Seguridad social</div>
    @if($colaborador->eps)<div class="side-item"><span class="side-dot">&#9679;</span><span class="side-lbl">EPS: </span>{{ $colaborador->eps === 'Otro' ? ($colaborador->eps_otro ?? 'Otro') : $colaborador->eps }}</div>@endif
    @if($colaborador->afp)<div class="side-item"><span class="side-dot">&#9679;</span><span class="side-lbl">AFP: </span>{{ $colaborador->afp === 'Otro' ? ($colaborador->afp_otro ?? 'Otro') : $colaborador->afp }}</div>@endif
    @if($colaborador->arl)<div class="side-item"><span class="side-dot">&#9679;</span><span class="side-lbl">ARL: </span>{{ $colaborador->arl === 'Otro' ? ($colaborador->arl_otro ?? 'Otro') : $colaborador->arl }}</div>@endif
    @endif

    @if($colaborador->emergencia_nombre_1 || $colaborador->emergencia_nombre_2)
    <div class="sec-title" style="margin-top:14px;">Emergencia</div>
    @if($colaborador->emergencia_nombre_1)
        <div style="margin-bottom:6px; padding-left:4px;">
            <div class="emerg-nombre">{{ $colaborador->emergencia_nombre_1 }}</div>
            @if($colaborador->emergencia_parentezco_1)<div class="emerg-sub">{{ $colaborador->emergencia_parentezco_1 }}</div>@endif
            @if($colaborador->emergencia_telefono_1)<div class="emerg-sub">{{ $colaborador->emergencia_telefono_1 }}</div>@endif
        </div>
    @endif
    @if($colaborador->emergencia_nombre_2)
        <div style="padding-left:4px;">
            <div class="emerg-nombre">{{ $colaborador->emergencia_nombre_2 }}</div>
            @if($colaborador->emergencia_parentezco_2)<div class="emerg-sub">{{ $colaborador->emergencia_parentezco_2 }}</div>@endif
            @if($colaborador->emergencia_telefono_2)<div class="emerg-sub">{{ $colaborador->emergencia_telefono_2 }}</div>@endif
        </div>
    @endif
    @endif

    @if($colaborador->codigo_qr_skap)
    <div class="sec-title" style="margin-top:14px;">Codigo QR SKAP</div>
    <div style="font-size:8px; color:#6b7280; padding-left:4px; margin-top:3px;">{{ $colaborador->codigo_qr_skap }}</div>
    @endif

</td>
</tr>
</table>

{{-- ═══ PIE ═══ --}}
<div class="footer">
    Generado el {{ now()->format('d/m/Y H:i') }} &nbsp;|&nbsp; ADENAR S.A.S
</div>

</body>
</html>
