<?php

namespace App\Models\Seguridad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ColaboradorCargo extends Model
{
    protected $table = 'colaborador_cargos';

    protected $fillable = [
        'colaborador_id',
        'cargo',
        'area',
        'perfil_nombre',
        'perfil',
        'fecha_inicio',
        'fecha_fin',
        'estado',
    ];

    protected function casts(): array
    {
        return [
            'fecha_inicio' => 'date:Y-m-d',
            'fecha_fin' => 'date:Y-m-d',
        ];
    }

    /** El cargo siempre se guarda en MAYÚSCULAS. */
    protected function setCargoAttribute(?string $value): void
    {
        $this->attributes['cargo'] = $value !== null && $value !== ''
            ? mb_strtoupper(trim($value), 'UTF-8')
            : $value;
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }
}
