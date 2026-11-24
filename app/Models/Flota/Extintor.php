<?php

namespace App\Models\Flota;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

/**
 * Modelo principal del módulo de extintores.
 *
 * @property-read string|null $placa_actual
 * @property-read bool        $vencido
 * @property-read string|null $foto_url
 */
class Extintor extends Model
{
    use SoftDeletes;

    protected $table = 'extintores';

    protected $fillable = [
        // Identificación
        'numero_serie',
        'foto_path',
        'marca',

        // Características técnicas
        'tipo_agente',
        'agente_impulsor',
        'capacidad_kg',
        'fecha_fabricacion',
        'fecha_vencimiento',

        // Estado e inspección visual
        'condicion',
        'parte_mantenimiento',
        'senalizacion',
        'demarcacion',
        'funcionamiento',
        'acceso',
        'observaciones',

        // Auditoría
        'user_id',
    ];

    protected static function booted(): void
    {
        // El QR siempre refleja el número de serie.
        static::saving(fn (self $e) => $e->qr_token = $e->numero_serie);
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

    public function asignaciones(): HasMany
    {
        return $this->hasMany(ExtintorAsignacion::class)->orderByDesc('fecha_colocacion');
    }

    public function inspecciones(): HasMany
    {
        return $this->hasMany(ExtintorInspeccion::class)->orderByDesc('fecha_inspeccion');
    }

    public function asignacionActiva(): HasOne
    {
        return $this->hasOne(ExtintorAsignacion::class)->whereNull('fecha_retiro');
    }

    public function ultimaInspeccion(): HasOne
    {
        return $this->hasOne(ExtintorInspeccion::class)->latestOfMany('fecha_inspeccion');
    }

    public function creador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeVencidos(Builder $query): Builder
    {
        return $query->whereDate('fecha_vencimiento', '<', now());
    }

    public function scopePorVencer(Builder $query, int $dias = 30): Builder
    {
        return $query->whereBetween('fecha_vencimiento', [now(), now()->addDays($dias)]);
    }

    public function scopeEnDeposito(Builder $query): Builder
    {
        return $query->whereDoesntHave('asignacionActiva');
    }

    public function scopeMontados(Builder $query): Builder
    {
        return $query->whereHas('asignacionActiva');
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    protected function placaActual(): Attribute
    {
        return Attribute::get(fn () => $this->asignacionActiva?->placa);
    }

    protected function vencido(): Attribute
    {
        return Attribute::get(fn () => (bool) $this->fecha_vencimiento?->isPast());
    }

    protected function fotoUrl(): Attribute
    {
        return Attribute::get(
            fn () => $this->foto_path ? Storage::disk('public')->url($this->foto_path) : null
        );
    }
}