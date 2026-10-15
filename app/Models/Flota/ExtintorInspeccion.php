<?php

namespace App\Models\Flota;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExtintorInspeccion extends Model
{
    protected $table = 'extintor_inspecciones';

    const TIPO_INICIO    = 'inicio';
    const TIPO_PERIODICA = 'periodica';

    protected $fillable = [
        'extintor_id',
        'tipo',
        'fecha_inspeccion',
        'responsable_inicio',
        'responsable_periodico',
        'condicion',
        'tipo_agente',
        'agente_impulsor',
        'capacidad_kg',
        'marca',
        'parte_mantenimiento',
        'senalizacion',
        'demarcacion',
        'funcionamiento',
        'acceso',
        'observaciones_inspeccion',
        'fecha_recarga',
        'fecha_proxima_recarga',
        'incluye_recarga',
        'observaciones_recarga',
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

    // ── Relaciones ────────────────────────────────────────────────────────────

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

    // ── Accessors ─────────────────────────────────────────────────────────────

    public function getTipoLabelAttribute(): string
    {
        return match ($this->tipo) {
            self::TIPO_INICIO    => 'Inspección de inicio',
            self::TIPO_PERIODICA => 'Inspección periódica',
            default              => $this->tipo,
        };
    }
}
