<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Pruebas de Alcoholemia</title>
    <style>
        body { font-family: sans-serif; font-size: 9px; color: #111; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        p.subtitle { color: #555; margin-top: 0; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 3px 4px; text-align: left; }
        th { background-color: #f3f4f6; }
        .positivo { color: #b91c1c; font-weight: bold; }
        .thumb { max-width: 55px; max-height: 26px; margin: 1px; }
    </style>
</head>
@php
    $fotoDataUri = function (?string $path) {
        if (! $path || ! \Illuminate\Support\Facades\Storage::disk('public')->exists($path)) {
            return null;
        }

        $mime = \Illuminate\Support\Facades\Storage::disk('public')->mimeType($path);
        $contenido = \Illuminate\Support\Facades\Storage::disk('public')->get($path);

        return "data:{$mime};base64,".base64_encode($contenido);
    };
@endphp
<body>
    <h1>Reporte de Pruebas de Alcoholemia</h1>
    <p class="subtitle">Generado el {{ now()->format('d/m/Y H:i') }} &mdash; {{ $pruebas->count() }} registro(s)</p>

    <table>
        <thead>
            <tr>
                <th>Fecha</th>
                <th>Colaborador</th>
                <th>Cédula</th>
                <th>Tipo</th>
                <th>Origen</th>
                <th>Ruta Asignada</th>
                <th>Dispositivo</th>
                <th>Resultado</th>
                <th>Evaluación</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th>Firma</th>
                <th>Evidencia principal</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($pruebas as $prueba)
                @php
                    $firma = $fotoDataUri($prueba->firma_path);
                    $evidenciaPrincipal = $fotoDataUri($prueba->evidenciaPrincipalPath());
                @endphp
                <tr>
                    <td>{{ $prueba->fecha_hora->format('d/m/Y H:i') }}</td>
                    <td>{{ $prueba->colaborador?->nombre_completo }}</td>
                    <td>{{ $prueba->colaborador?->cedula }}</td>
                    <td>{{ $prueba->tipoLabel() }}</td>
                    <td>{{ $prueba->pertenece_planeacion ? 'Realizada (Planeada)' : 'Adicional' }}</td>
                    <td>{{ $prueba->ruta_asignada ?? '—' }}</td>
                    <td>{{ $prueba->alcoholimetro?->codigo }}</td>
                    <td class="{{ $prueba->es_positivo ? 'positivo' : '' }}">{{ $prueba->resultado ?? '—' }}</td>
                    <td>{{ $prueba->estado === 'programada' ? '—' : $prueba->evaluacion() }}</td>
                    <td>{{ ucfirst($prueba->estado) }}</td>
                    <td>{{ $prueba->responsable?->name }}</td>
                    <td>
                        @if ($firma)
                            <img class="thumb" src="{{ $firma }}" alt="Firma">
                        @else
                            —
                        @endif
                    </td>
                    <td>
                        @if ($evidenciaPrincipal)
                            <img class="thumb" src="{{ $evidenciaPrincipal }}" alt="Evidencia principal">
                        @else
                            —
                        @endif
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
