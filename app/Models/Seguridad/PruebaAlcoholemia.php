<?php

namespace App\Models\Seguridad;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class PruebaAlcoholemia extends Model
{
    protected $table = 'pruebas_alcoholemia';

    protected $fillable = [
        'colaborador_id',
        'alcoholimetro_id',
        'tipo',
        'resultado',
        'consentimiento_aceptado',
        'consentimiento_en',
        'evidencia_path',
        'firma_path',
        'observaciones',
        'responsable_id',
        'fecha_hora',
        'programada_en',
        'recordatorio_enviado_at',
        'estado',
    ];

    protected function casts(): array
    {
        return [
            'resultado' => 'decimal:3',
            'es_positivo' => 'boolean',
            'consentimiento_aceptado' => 'boolean',
            'consentimiento_en' => 'datetime',
            'fecha_hora' => 'datetime',
            'programada_en' => 'datetime',
            'recordatorio_enviado_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (self $prueba) {
            $prueba->es_positivo = $prueba->resultado !== null
                && (float) $prueba->resultado > (float) config('seguridad.umbral_positivo');
        });

        static::creating(function (self $prueba) {
            $prueba->qr_token ??= Str::random(40);
        });
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function evidencias(): HasMany
    {
        return $this->hasMany(PruebaEvidencia::class);
    }

    public function alcoholimetro(): BelongsTo
    {
        return $this->belongsTo(Alcoholimetro::class);
    }

    public function responsable(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsable_id');
    }

    /**
     * HU029: impide dos pruebas del mismo tipo para el mismo colaborador
     * dentro de la ventana mínima configurada.
     */
    public static function existeConflictoDeIntervalo(int $colaboradorId, string $tipo, Carbon $fechaHora, ?int $ignorarId = null): bool
    {
        $horas = (int) config('seguridad.intervalo_minimo_horas');

        return static::query()
            ->where('colaborador_id', $colaboradorId)
            ->where('tipo', $tipo)
            ->where('estado', '!=', 'cancelada')
            ->when($ignorarId, fn ($query) => $query->whereKeyNot($ignorarId))
            ->whereBetween('fecha_hora', [$fechaHora->clone()->subHours($horas), $fechaHora->clone()->addHours($horas)])
            ->exists();
    }

    /**
     * La evidencia principal (foto) y las adicionales (PDF) se guardan juntas
     * en `evidencias`, distinguibles solo por tipo de archivo (la validación
     * exige imagen para la principal y PDF para las adicionales) — la
     * posición en la colección no es confiable porque depende del orden de
     * subida, así que se identifica por extensión.
     */
    public function evidenciaPrincipalPath(): ?string
    {
        if ($this->evidencia_path) {
            return $this->evidencia_path;
        }

        return $this->evidencias->first(fn ($evidencia) => ! str($evidencia->path)->lower()->endsWith('.pdf'))?->path;
    }

    public function tipoLabel(): string
    {
        return match ($this->tipo) {
            'pre_ruta' => 'Pre Ruta',
            'ruta' => 'Ruta',
            'post_ruta' => 'Post Ruta',
            'jl' => 'JL',
            'segundo_viaje' => 'Segundo viaje',
            default => ucfirst($this->tipo),
        };
    }

    /**
     * HU043: combina la condición de salud del colaborador ese día con el
     * resultado de la prueba para determinar Apto / Apto con Observaciones / No Apto.
     */
    public function evaluacion(): string
    {
        if ($this->es_positivo) {
            return 'No Apto';
        }

        $condicion = CondicionSalud::query()
            ->where('colaborador_id', $this->colaborador_id)
            ->whereDate('fecha_hora', $this->fecha_hora->toDateString())
            ->latest('fecha_hora')
            ->first();

        return match ($condicion?->estado) {
            'Malo' => 'No Apto',
            'Regular' => 'Apto con Observaciones',
            default => 'Apto',
        };
    }
}
