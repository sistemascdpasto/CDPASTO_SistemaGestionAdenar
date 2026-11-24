<?php

namespace App\Models\Flota;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExtintorInspeccion extends Model
{
    public const TIPO_INICIO    = 'inicio';
    public const TIPO_PERIODICA = 'periodica';

    protected $table = 'extintor_inspecciones';

    protected $fillable = [
        // Datos de la inspección
        'extintor_id',
        'tipo',
        'fecha_inspeccion',
        'responsable_inicio',
        'responsable_periodico',
        'observaciones_inspeccion',
        // Características técnicas
        'tipo_agente',
        'agente_impulsor',
        'capacidad_kg',
        'marca',
        // Estado e inspección visual
        'condicion',
        'parte_mantenimiento',
        'senalizacion',
        'demarcacion',
        'funcionamiento',
        'acceso',
        // Recarga
        'incluye_recarga',
        'fecha_recarga',
        'fecha_proxima_recarga',
        'observaciones_recarga',
        // Auditoría
        'firma_path',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'fecha_inspeccion'      => 'date:Y-m-d',
            'fecha_recarga'         => 'date:Y-m-d',
            'fecha_proxima_recarga' => 'date:Y-m-d',
            'incluye_recarga'       => 'boolean',
            'capacidad_kg'          => 'decimal:2',
        ];
    }

    // ── Relaciones 
    public function extintor(): BelongsTo
    {
        return $this->belongsTo(Extintor::class);
    }

    public function evidencias(): HasMany
    {
        return $this->hasMany(ExtintorInspeccionEvidencia::class, 'inspeccion_id')->orderBy('orden');
    }

    public function creador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // ── Scopes 
    public function scopeDeInicio(Builder $query): Builder
    {
        return $query->where('tipo', self::TIPO_INICIO);
    }

    public function scopePeriodicas(Builder $query): Builder
    {
        return $query->where('tipo', self::TIPO_PERIODICA);
    }

    // ── Accessors
    protected function tipoLabel(): Attribute
    {
        return Attribute::get(fn () => match ($this->tipo) {
            self::TIPO_INICIO    => 'Inspección de inicio',
            self::TIPO_PERIODICA => 'Inspección periódica',
            default              => $this->tipo,
        });
    }
}