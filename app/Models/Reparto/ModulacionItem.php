<?php

namespace App\Models\Reparto;

use App\Models\Seguridad\Colaborador;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ModulacionItem extends Model
{
    protected $table = 'modulacion_items';

    protected $fillable = [
        'modulacion_id',
        'placa',
        'placa_adicional',
        'doc_tras',
        'ud',
        'cargo',
        'colaborador_id',
        'cedula',
        'nombres',
        'reunion',
        'tripulacion',
        'viajes',
    ];

    protected function casts(): array
    {
        return [
            'tripulacion' => 'array',
            'viajes' => 'array',
        ];
    }

    public function modulacion(): BelongsTo
    {
        return $this->belongsTo(Modulacion::class);
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }
}
