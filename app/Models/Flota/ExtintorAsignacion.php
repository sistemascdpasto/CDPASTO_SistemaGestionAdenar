<?php

namespace App\Models\Flota;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Registra una estadía del extintor en un vehículo.
 * Una fila = "el extintor X estuvo en la placa Y desde el día A hasta el día B".
 * Si fecha_retiro es NULL el extintor sigue montado en ese vehículo.
 *
 * Los checklists (colocación y retiro) se guardan como JSON con la estructura:
 *   { "Presión (bar)": "12", "Sello OK": "Sí", ... }
 * Las claves son los nombres de ExtintorColumna en el momento del registro.
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
            'fecha_colocacion'    => 'date:Y-m-d',
            'fecha_retiro'        => 'date:Y-m-d',
            'checklist_colocacion' => 'array',
            'checklist_retiro'    => 'array',
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

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function getActivoAttribute(): bool
    {
        return $this->fecha_retiro === null;
    }
}
