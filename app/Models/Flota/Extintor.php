<?php

namespace App\Models\Flota;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Entidad principal: el extintor físico.
 * Se identifica por su número de serie.
 * La placa del vehículo en que está montado NO es un campo del extintor;
 * se consulta a través de la asignación activa (fecha_retiro = NULL).
 */
class Extintor extends Model
{
    use SoftDeletes;

    protected $table = 'extintores';

    protected $fillable = [
        'numero_serie',
        'qr_token',
        'foto_path',
        'tipo_agente',
        'capacidad_kg',
        'marca',
        'fecha_fabricacion',
        'fecha_vencimiento',
        'observaciones',
        'condicion',
        'agente_impulsor',
        'parte_mantenimiento',
        'senalizacion',
        'demarcacion',
        'funcionamiento',
        'acceso',
        'user_id',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $extintor) {
            $extintor->qr_token = $extintor->numero_serie;
        });

        static::updating(function (self $extintor) {
            if ($extintor->isDirty('numero_serie')) {
                $extintor->qr_token = $extintor->numero_serie;
            }
        });
    }

    protected function casts(): array
    {
        return [
            'fecha_fabricacion' => 'date:Y-m-d',
            'fecha_vencimiento' => 'date:Y-m-d',
            'capacidad_kg'      => 'decimal:2',
        ];
    }

    // ── Relaciones ────────────────────────────────────────────────────────────

    /** Toda la trayectoria del extintor por los distintos vehículos. */
    public function asignaciones(): HasMany
    {
        return $this->hasMany(ExtintorAsignacion::class)->orderByDesc('fecha_colocacion');
    }

    /** Inspecciones realizadas al extintor (inicio y periódicas). */
    public function inspecciones(): HasMany
    {
        return $this->hasMany(ExtintorInspeccion::class)->orderByDesc('fecha_inspeccion');
    }

    /** La asignación activa (sin fecha de retiro) — puede ser null si está en depósito. */
    public function asignacionActiva(): HasOne
    {
        return $this->hasOne(ExtintorAsignacion::class)->whereNull('fecha_retiro');
    }

    public function creador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    /** Placa en la que está montado actualmente, o null si está en depósito. */
    public function getPlacaActualAttribute(): ?string
    {
        return $this->asignacionActiva?->placa;
    }

    public function getVencidoAttribute(): bool
    {
        return $this->fecha_vencimiento !== null
            && $this->fecha_vencimiento->isPast();
    }

    public function getFotoUrlAttribute(): ?string
    {
        if ($this->foto_path) {
            return Storage::disk('public')->url($this->foto_path);
        }

        // Fallback por archivo en storage/app/public/extintores/{id}/foto.*
        $matches = glob(storage_path("app/public/extintores/{$this->id}/foto.*"));
        if (!empty($matches)) {
            $file = $matches[0];
            $ext = pathinfo($file, PATHINFO_EXTENSION);
            return Storage::disk('public')->url("extintores/{$this->id}/foto.{$ext}") . '?v=' . filemtime($file);
        }

        return null;
    }
}
