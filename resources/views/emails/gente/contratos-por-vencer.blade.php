<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestión preventiva de vencimientos contractuales</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            background-color: #f4f4f4;
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #333;
        }

        .wrapper {
            max-width: 620px;
            margin: 32px auto;
            background: #ffffff;
            border-radius: 6px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        /* ── Cabecera ── */
        .header {
            padding: 24px 28px 16px;
            border-bottom: 3px solid #1a6b4a;
        }
        .header .brand {
            font-size: 22px;
            font-weight: bold;
            color: #1a6b4a;
            letter-spacing: 1px;
        }
        .header .sub-brand {
            font-size: 10px;
            color: #888;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-top: 2px;
        }

        /* ── Cuerpo ── */
        .body {
            padding: 28px 28px 24px;
        }

        /* Etiqueta de módulo */
        .badge {
            display: inline-block;
            background-color: #fff3e0;
            color: #c0611a;
            font-size: 10px;
            font-weight: bold;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            padding: 4px 10px;
            border-radius: 20px;
            margin-bottom: 14px;
            border: 1px solid #f0c080;
        }

        .title {
            font-size: 20px;
            font-weight: bold;
            color: #1a1a1a;
            margin-bottom: 8px;
            line-height: 1.3;
        }

        .subtitle {
            font-size: 13px;
            color: #666;
            margin-bottom: 22px;
            line-height: 1.5;
        }

        /* ── Encabezado de tabla ── */
        .table-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .table-label {
            font-size: 13px;
            font-weight: bold;
            color: #1a1a1a;
        }
        .count-badge {
            background-color: #e8f4fd;
            color: #1a6b9a;
            font-size: 11px;
            font-weight: bold;
            padding: 3px 10px;
            border-radius: 20px;
        }

        /* ── Filas de colaboradores ── */
        .contrato-row {
            border-top: 1px solid #e8e8e8;
            padding: 14px 0;
        }
        .contrato-row:last-child {
            border-bottom: 1px solid #e8e8e8;
        }
        .contrato-nombre {
            font-size: 13px;
            font-weight: bold;
            color: #1a1a1a;
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        .contrato-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .contrato-label {
            font-size: 12px;
            color: #888;
        }
        .contrato-fecha {
            font-size: 13px;
            font-weight: bold;
            color: #333;
        }

        /* ── Botón ── */
        .btn-wrap {
            margin-top: 28px;
        }
        .btn {
            display: block;
            width: 100%;
            background-color: #1a6b4a;
            color: #ffffff !important;
            text-align: center;
            padding: 14px 20px;
            border-radius: 5px;
            text-decoration: none;
            font-size: 14px;
            font-weight: bold;
            letter-spacing: 0.3px;
        }

        /* ── Pie ── */
        .footer {
            background-color: #f9f9f9;
            border-top: 1px solid #e8e8e8;
            padding: 16px 28px;
            font-size: 11px;
            color: #aaa;
            text-align: center;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="wrapper">

        {{-- Cabecera --}}
        <div class="header">
            <div class="brand">ADENAR</div>
            <div class="sub-brand">Sistema Integral de Gestión</div>
        </div>

        {{-- Cuerpo --}}
        <div class="body">

            <div class="badge">Gestión de Contratos</div>

            <div class="title">Gestión preventiva de vencimientos contractuales</div>
            <div class="subtitle">
                Se relacionan los contratos que requieren seguimiento para gestionar
                oportunamente sus fechas de vencimiento.
            </div>

            {{-- Encabezado de tabla --}}
            <div class="table-header">
                <span class="table-label">Contratos identificados</span>
                <span class="count-badge">{{ $contratos->count() }} {{ $contratos->count() === 1 ? 'registro' : 'registros' }}</span>
            </div>

            {{-- Lista de colaboradores --}}
            @foreach($contratos as $contrato)
                <div class="contrato-row">
                    <div class="contrato-nombre">{{ mb_strtoupper($contrato['nombre_completo']) }}</div>
                    <div class="contrato-meta">
                        <span class="contrato-label">Vencimiento</span>
                        <span class="contrato-fecha">{{ \Carbon\Carbon::parse($contrato['fecha_vencimiento'])->format('d/m/Y') }}</span>
                    </div>
                </div>
            @endforeach

            {{-- Botón --}}
            <div class="btn-wrap">
                <a href="{{ route('gente.contratos.index') }}" class="btn">Consultar contratos</a>
            </div>

        </div>

        {{-- Pie --}}
        <div class="footer">
            Este es un mensaje automático del Sistema Integral de Gestión ADENAR S.A.S.<br>
            Por favor no responda este correo.
        </div>

    </div>
</body>
</html>
