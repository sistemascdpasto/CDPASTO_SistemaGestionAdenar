<?php

namespace App\Services\Flota;

use App\Models\Flota\Extintor;
use App\Models\Flota\ExtintorAsignacion;
use App\Models\Flota\ExtintorInspeccion;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ExtintorService
{
    private const MAX_EXTINTORES_POR_PLACA = 2;

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

    /** Campos de la inspección que vienen del formulario (null si no llegan). */
    private const CAMPOS_INSPECCION = [
        'tipo', 'fecha_inspeccion', 'responsable_inicio', 'responsable_periodico',
        'condicion', 'tipo_agente', 'agente_impulsor', 'capacidad_kg', 'marca',
        'parte_mantenimiento', 'senalizacion', 'demarcacion', 'funcionamiento',
        'acceso', 'observaciones_inspeccion',
    ];

    /** Solo se guardan si la inspección incluye recarga. */
    private const CAMPOS_RECARGA = [
        'fecha_recarga', 'fecha_proxima_recarga', 'observaciones_recarga',
    ];

    /** Campos técnicos que se precargan desde el extintor. */
    private const CAMPOS_TECNICOS = [
        'condicion', 'tipo_agente', 'agente_impulsor', 'capacidad_kg', 'marca',
        'senalizacion', 'demarcacion', 'funcionamiento', 'acceso',
    ];

    /** Campos que se heredan de la inspección previa. */
    private const CAMPOS_HEREDABLES = [
        'condicion', 'tipo_agente', 'agente_impulsor', 'senalizacion',
        'demarcacion', 'funcionamiento', 'acceso', 'observaciones_inspeccion',
    ];

    // ── Serie ─────────────────────────────────────────────────────────────────

    /** Siguiente código de serie con formato EXT-{YEAR}-{NNN}. */
    public function siguienteSerie(): string
    {
        $prefix = 'EXT-' . now()->year . '-';

        $ultimo = Extintor::withTrashed()
            ->where('numero_serie', 'like', "{$prefix}%")
            ->pluck('numero_serie')
            ->map(fn (string $serie) => (int) substr($serie, strlen($prefix)))
            ->max() ?? 0;

        return $prefix . str_pad((string) ($ultimo + 1), 3, '0', STR_PAD_LEFT);
    }

    // ── Asignaciones ──────────────────────────────────────────────────────────

    /**
     * Asigna el extintor a una placa.
     *
     * @throws \RuntimeException si la placa está llena y no se autorizó desasociar.
     */
    public function asignar(Extintor $extintor, array $data, ?int $userId, bool $desasociarPrevios = false): void
    {
        DB::transaction(function () use ($extintor, $data, $userId, $desasociarPrevios) {
            $placa = $data['placa'];
            $fecha = $data['fecha_colocacion'];

            $this->cerrarActivas(
                ExtintorAsignacion::activas()->where('extintor_id', $extintor->id),
                $fecha,
                "Reasignado a la placa {$placa}",
                $userId
            );

            $ocupantes = ExtintorAsignacion::activas()
                ->dePlaca($placa)
                ->where('extintor_id', '!=', $extintor->id);

            throw_if(
                ! $desasociarPrevios && $ocupantes->count() >= self::MAX_EXTINTORES_POR_PLACA,
                \RuntimeException::class,
                "La placa {$placa} ya tiene " . self::MAX_EXTINTORES_POR_PLACA . ' extintores asociados.'
            );

            $ocupantes->when(
                $desasociarPrevios,
                fn (Builder $q) => $this->cerrarActivas($q, $fecha, "Desasociado para reasignación a {$placa}", $userId)
            );

            ExtintorAsignacion::create([
                'extintor_id'              => $extintor->id,
                'placa'                    => $placa,
                'fecha_colocacion'         => $fecha,
                'responsable_colocacion'   => $data['responsable_colocacion'] ?? null,
                'observaciones_colocacion' => $data['observaciones_colocacion'] ?? null,
                'checklist_colocacion'     => $data['checklist_colocacion'] ?? null,
                'user_coloco'              => $userId,
            ]);
        });
    }

    /** Cierra la asignación activa registrando el retiro. */
    public function retirar(ExtintorAsignacion $asignacion, array $data, ?int $userId): void
    {
        $asignacion->update([
            'fecha_retiro'         => $data['fecha_retiro'],
            'responsable_retiro'   => $data['responsable_retiro'] ?? null,
            'observaciones_retiro' => $data['observaciones_retiro'] ?? null,
            'checklist_retiro'     => $data['checklist_retiro'] ?? null,
            'user_retiro'          => $userId,
        ]);
    }

    /** Desasocia todos los extintores activos de una placa (sin eliminar registros). */
    public function desasociarPlaca(string $placa, string $fecha, ?int $userId, ?int $excluirExtintorId = null): void
    {
        $this->cerrarActivas(
            ExtintorAsignacion::activas()
                ->dePlaca($placa)
                ->when($excluirExtintorId, fn (Builder $q, int $id) => $q->where('extintor_id', '!=', $id)),
            $fecha,
            "Desasociado de la placa {$placa}",
            $userId
        );
    }

    // ── Inspecciones ──────────────────────────────────────────────────────────

    /**
     * Crea o actualiza una inspección con sus evidencias y firma.
     *
     * $context: editar (?ExtintorInspeccion), user_id (?int), firma (?UploadedFile),
     *           usar_firma_guardada (bool), evidencias (UploadedFile[])
     */
    public function guardarInspeccion(Extintor $extintor, array $validated, array $context): void
    {
        $editar            = $context['editar'] ?? null;
        $userId            = $context['user_id'] ?? null;
        $incluyeRecarga    = (bool) ($validated['incluye_recarga'] ?? false);
        $registraVehiculo  = (bool) ($validated['registra_vehiculo'] ?? false);
        $desasociarPrevios = (bool) ($validated['desasociar_previos_insp'] ?? false);
        $nuevaVigencia     = $incluyeRecarga ? ($validated['fecha_proxima_recarga'] ?? null) : null;

        $rutasNuevas = []; // archivos subidos en este request, para limpiar si falla

        try {
            DB::transaction(function () use (
                $extintor, $validated, $context, $editar, $userId, $incluyeRecarga,
                $registraVehiculo, $desasociarPrevios, $nuevaVigencia, &$rutasNuevas
            ) {
                $firmaPath = $this->resolverFirma(
                    $editar,
                    $context['firma'] ?? null,
                    (bool) ($context['usar_firma_guardada'] ?? false),
                    $userId,
                    $rutasNuevas
                );

                $inspeccion = $editar ?? new ExtintorInspeccion(['user_id' => $userId]);
                $inspeccion->fill(
                    $this->datosInspeccion($extintor, $validated, $incluyeRecarga) + ['firma_path' => $firmaPath]
                )->save();

                $this->reemplazarEvidencias($extintor, $inspeccion, $context['evidencias'] ?? [], $rutasNuevas);

                collect([$nuevaVigencia])->filter()
                    ->each(fn ($fecha) => $extintor->update(['fecha_vencimiento' => $fecha]));

                collect([$validated])->filter(fn () => $registraVehiculo)
                    ->each(fn (array $v) => $this->moverVehiculo($extintor, $v, $userId, $desasociarPrevios));
            });
        } catch (\Throwable $e) {
            $this->disco()->delete($rutasNuevas);
            throw $e;
        }
    }

    /** Elimina la inspección y sus archivos (firma + evidencias). */
    public function eliminarInspeccion(ExtintorInspeccion $inspeccion): void
    {
        $archivos = $inspeccion->evidencias->pluck('path')->push($inspeccion->firma_path)->filter()->all();

        DB::transaction(fn () => $inspeccion->delete());

        $this->disco()->delete($archivos);
    }

    /** Ruta de la última firma registrada por el usuario. */
    public function ultimaFirmaPath(?int $userId): ?string
    {
        return $userId
            ? ExtintorInspeccion::where('user_id', $userId)->whereNotNull('firma_path')->latest()->value('firma_path')
            : null;
    }

    // ── Lógica para la vista show ─────────────────────────────────────────────

    public function tipoSiguienteInspeccion(Extintor $extintor): string
    {
        return $extintor->inspecciones->contains('tipo', ExtintorInspeccion::TIPO_INICIO)
            ? ExtintorInspeccion::TIPO_PERIODICA
            : ExtintorInspeccion::TIPO_INICIO;
    }

    public function ultimaRecarga(Extintor $extintor): ?string
    {
        return $extintor->inspecciones
            ->where('incluye_recarga', true)
            ->max('fecha_recarga')
            ?->format('Y-m-d');
    }

    /** Valores por defecto del formulario; hereda checklist de la inspección previa. */
    public function defaultsInspeccion(array $datos, ?array $primeraInspeccion, string $tipo, string $usuario): array
    {
        $tecnicos = array_replace(
            array_fill_keys(self::CAMPOS_TECNICOS, ''),
            $this->sinNulos(Arr::only($datos, self::CAMPOS_TECNICOS))
        );

        $heredado = $this->sinNulos(Arr::only($primeraInspeccion ?? [], self::CAMPOS_HEREDABLES));

        return array_replace([
            'tipo'                     => $tipo,
            'fecha_inspeccion'         => now()->format('Y-m-d'),
            'responsable_inicio'       => $tipo === ExtintorInspeccion::TIPO_INICIO ? $usuario : '',
            'responsable_periodico'    => $tipo === ExtintorInspeccion::TIPO_PERIODICA ? $usuario : '',
            'parte_mantenimiento'      => [],
            'observaciones_inspeccion' => '',
            'incluye_recarga'          => false,
            'fecha_recarga'            => '',
            'fecha_proxima_recarga'    => '',
            'observaciones_recarga'    => '',
            'registra_vehiculo'        => false,
            'nueva_placa'              => '',
            'observaciones_vehiculo'   => '',
        ], $tecnicos, $heredado);
    }

    /** Catálogo de partes como [{value, label}]. */
    public function catalogoPartes(): array
    {
        return collect(self::PARTES)
            ->map(fn (string $label, $code) => ['value' => $code, 'label' => "{$code} — {$label}"])
            ->values()
            ->all();
    }

    /** "1,3,5" → [["code"=>"1","label"=>"Asa Percutora"], ...] */
    public function partesComoLista(?string $parteMantenimiento): array
    {
        return collect(explode(',', (string) $parteMantenimiento))
            ->map(fn (string $code) => trim($code))
            ->filter(fn (string $code) => $code !== '')
            ->map(fn (string $code) => ['code' => $code, 'label' => self::PARTES[$code] ?? $code])
            ->values()
            ->all();
    }

    /** Timeline de inspecciones ordenada de la más reciente a la más antigua. */
    public function historial(array $inspecciones): array
    {
        return collect($inspecciones)
            ->map(fn (array $ins) => [
                'id'                 => "ins-{$ins['id']}",
                'fecha'              => $ins['fecha_inspeccion'] ?? '—',
                'tipo'               => $ins['tipo'],
                'tipo_label'         => $ins['tipo_label'],
                'es_inspeccion'      => true,
                'inspeccionOriginal' => $ins,
            ])
            ->sortByDesc('fecha')
            ->values()
            ->all();
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    private function disco(): Filesystem
    {
        return Storage::disk('public');
    }

    private function sinNulos(array $datos): array
    {
        return array_filter($datos, fn ($v) => $v !== null);
    }

    /** UPDATE directo que cierra las asignaciones del query dado. */
    private function cerrarActivas(Builder $query, string $fecha, ?string $observaciones, ?int $userId): int
    {
        return $query->update([
            'fecha_retiro'         => $fecha,
            'observaciones_retiro' => $observaciones,
            'user_retiro'          => $userId,
        ]);
    }

    /** Datos de la inspección con null por defecto; la recarga solo si aplica. */
    private function datosInspeccion(Extintor $extintor, array $validated, bool $incluyeRecarga): array
    {
        return array_replace(
            ['extintor_id' => $extintor->id, 'incluye_recarga' => $incluyeRecarga],
            array_fill_keys([...self::CAMPOS_INSPECCION, ...self::CAMPOS_RECARGA], null),
            Arr::only($validated, self::CAMPOS_INSPECCION),
            $incluyeRecarga ? Arr::only($validated, self::CAMPOS_RECARGA) : []
        );
    }

    private function resolverFirma(
        ?ExtintorInspeccion $editar,
        mixed $archivo,
        bool $usarGuardada,
        ?int $userId,
        array &$rutasNuevas
    ): ?string {
        return match (true) {
            $archivo instanceof UploadedFile => $this->subirFirma($archivo, $editar, $rutasNuevas),
            $usarGuardada && ! $editar       => $this->copiarUltimaFirma($userId, $rutasNuevas),
            default                          => $editar?->firma_path,
        };
    }

    private function subirFirma(UploadedFile $archivo, ?ExtintorInspeccion $editar, array &$rutasNuevas): string
    {
        $this->disco()->delete(array_filter([$editar?->firma_path]));

        return $rutasNuevas[] = $archivo->store('extintores/firmas', 'public');
    }

    private function copiarUltimaFirma(?int $userId, array &$rutasNuevas): ?string
    {
        $ultima = $this->ultimaFirmaPath($userId);

        return $ultima && $this->disco()->exists($ultima)
            ? $rutasNuevas[] = $this->copiarArchivo($ultima)
            : null;
    }

    private function copiarArchivo(string $origen): string
    {
        $ext     = pathinfo($origen, PATHINFO_EXTENSION) ?: 'png';
        $destino = 'extintores/firmas/' . Str::random(40) . '.' . $ext;

        $this->disco()->copy($origen, $destino);

        return $destino;
    }

    /** Si llegan archivos nuevos, reemplaza las evidencias anteriores. */
    private function reemplazarEvidencias(Extintor $extintor, ExtintorInspeccion $inspeccion, array $archivos, array &$rutasNuevas): void
    {
        collect($archivos)
            ->filter(fn ($f) => $f instanceof UploadedFile)
            ->whenNotEmpty(function ($validos) use ($extintor, $inspeccion, &$rutasNuevas) {
                $this->disco()->delete($inspeccion->evidencias->pluck('path')->all());
                $inspeccion->evidencias()->delete();

                $validos->each(function (UploadedFile $file, $orden) use ($extintor, $inspeccion, &$rutasNuevas) {
                    $path = $file->store("extintores/{$extintor->id}/inspecciones/{$inspeccion->id}", 'public');
                    $rutasNuevas[] = $path;

                    $inspeccion->evidencias()->create([
                        'path'            => $path,
                        'nombre_original' => $file->getClientOriginalName(),
                        'tipo_mime'       => $file->getMimeType(),
                        'orden'           => (int) $orden,
                    ]);
                });
            });
    }

    /** Cierra la asignación actual y, si viene nueva placa, crea otra. */
    private function moverVehiculo(Extintor $extintor, array $validated, ?int $userId, bool $desasociarPrevios): void
    {
        $fecha         = $validated['fecha_inspeccion'];
        $observaciones = $validated['observaciones_vehiculo'] ?? null;

        $this->cerrarActivas(
            ExtintorAsignacion::activas()->where('extintor_id', $extintor->id),
            $fecha,
            $observaciones,
            $userId
        );

        collect($validated['nueva_placa'] ?? null)->filter()->each(
            function (string $placa) use ($extintor, $fecha, $observaciones, $userId, $desasociarPrevios) {
                ExtintorAsignacion::activas()
                    ->dePlaca($placa)
                    ->where('extintor_id', '!=', $extintor->id)
                    ->when(
                        $desasociarPrevios,
                        fn (Builder $q) => $this->cerrarActivas($q, $fecha, 'Desasociado para reasignación (inspección)', $userId)
                    );

                ExtintorAsignacion::create([
                    'extintor_id'              => $extintor->id,
                    'placa'                    => $placa,
                    'fecha_colocacion'         => $fecha,
                    'observaciones_colocacion' => $observaciones,
                    'user_coloco'              => $userId,
                ]);
            }
        );
    }
}