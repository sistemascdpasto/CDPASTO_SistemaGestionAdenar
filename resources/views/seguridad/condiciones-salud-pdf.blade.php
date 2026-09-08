<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Condiciones de Salud</title>
    <style>
        body { font-family: sans-serif; font-size: 9px; color: #111; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        p.subtitle { color: #555; margin-top: 0; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 3px 4px; text-align: left; vertical-align: top; }
        th { background-color: #f3f4f6; }
        .malo { color: #b91c1c; font-weight: bold; }
        .regular { color: #b45309; }
        .muted { color: #888; }
    </style>
</head>
@php
    $turnos = ['manana' => 'Mañana', 'tarde' => 'Tarde', 'noche' => 'Noche'];
    $estadoClase = fn (?string $estado) => match ($estado) {
        'Malo' => 'malo',
        'Regular' => 'regular',
        default => '',
    };
@endphp
<body>
    <h1>Historial de Condiciones de Salud</h1>
    <p class="subtitle">
        Generado el {{ now()->format('d/m/Y H:i') }} &mdash; {{ $filas->count() }} registro(s)
        &mdash; rango {{ $filtros['desde'] }} a {{ $filtros['hasta'] }}
        @if (($filtros['identificacion'] ?? '') !== '') &mdash; identificación &ldquo;{{ $filtros['identificacion'] }}&rdquo; @endif
        @if (($filtros['nombre'] ?? '') !== '') &mdash; nombre &ldquo;{{ $filtros['nombre'] }}&rdquo; @endif
    </p>

    <table>
        <thead>
            <tr>
                <th>Fecha</th>
                <th>Colaborador</th>
                <th>Cargo / Área</th>
                <th>Turno</th>
                <th>Ingreso</th>
                <th>Estado</th>
                <th>Observación ingreso</th>
                <th>Salida</th>
                <th>Estado</th>
                <th>Observación salida</th>
                <th>Firma colab.</th>
                <th>Firma superv.</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($filas as $fila)
                <tr>
                    <td>{{ $fila['fecha'] }}</td>
                    <td>
                        {{ trim(($fila['colaborador']['nombres'] ?? '') . ' ' . ($fila['colaborador']['apellidos'] ?? '')) }}
                        <br><span class="muted">{{ $fila['colaborador']['cedula'] ?? '' }}</span>
                    </td>
                    <td>{{ collect([$fila['colaborador']['cargo'] ?? null, $fila['colaborador']['area'] ?? null])->filter()->implode(' / ') ?: '—' }}</td>
                    <td>
                        @php($t = $fila['colaborador']['turno'] ?? null)
                        {{ $t ? ($turnos[$t] ?? $t) : '—' }}
                    </td>
                    <td>{{ $fila['hora_ingreso'] ?? '—' }}</td>
                    <td class="{{ $estadoClase($fila['estado_ingreso'] ?? null) }}">{{ $fila['estado_ingreso'] ?? '—' }}</td>
                    <td>{{ $fila['observacion_ingreso'] ?? '—' }}</td>
                    <td>{{ $fila['hora_salida'] ?? '—' }}</td>
                    <td class="{{ $estadoClase($fila['estado_salida'] ?? null) }}">{{ $fila['estado_salida'] ?? '—' }}</td>
                    <td>{{ $fila['observacion_salida'] ?? '—' }}</td>
                    <td>{{ $fila['firma_colaborador_url'] ? 'Sí' : 'No' }}</td>
                    <td>{{ $fila['firma_supervisor_url'] ? 'Sí' : 'No' }}</td>
                </tr>
            @empty
                <tr><td colspan="12" class="muted">No se encontraron registros en el rango seleccionado.</td></tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
