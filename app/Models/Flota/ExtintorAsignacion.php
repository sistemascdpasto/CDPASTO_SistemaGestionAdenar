<?php

namespace App\Models\Flota;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Estadía de un extintor en un vehículo (fecha_retiro NULL = sigue montado).
 * Los checklists se guardan como JSON: { "Presión (bar)": "12", "Sello OK": "Sí" }
 *
 * @property-read bool $activo
 */
class ExtintorAsignacion extends Model
{
    protected $table = 'extintor_asignaciones';

    protected $fillable = [
        'extintor_id',
        'placa',
        'fecha_colocacion',
        'fecha_retiro',
        'checklist_colocacion',
        'checklist_retiro',
        'responsable_colocacion',
        'responsable_retiro',
        'observaciones_colocacion',
        'observaciones_retiro',
        'user_coloco',
        'user_retiro',
    ];

    protected function casts(): array
    {
        return [
            'fecha_colocacion'     => 'date:Y-m-d',
            'fecha_retiro'         => 'date:Y-m-d',
            'checklist_colocacion' => 'array',
            'checklist_retiro'     => 'array',
        ];
    }

    // ── Relaciones ────────────────────────────────────────────────────────────

    public function extintor(): BelongsTo
    {
        return $this->belongsTo(Extintor::class);
    }

    public function usuarioColoco(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_coloco');
    }

    public function usuarioRetiro(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_retiro');
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActivas(Builder $query): Builder
    {
        return $query->whereNull('fecha_retiro');
    }

    public function scopeDePlaca(Builder $query, string $placa): Builder
    {
        return $query->where('placa', $placa);
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    protected function activo(): Attribute
    {
        return Attribute::get(fn () => $this->fecha_retiro === null);
    }
}