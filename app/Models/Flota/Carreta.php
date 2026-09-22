<?php

namespace App\Models\Flota;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Carreta extends Model
{
    use SoftDeletes;

    protected $table = 'carretas';

    protected $fillable = [
        'placa',
        'tipo',
        'is_active',
        'novedad_no_disponible',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function disponibilidadHistorial(): HasMany
    {
        return $this->hasMany(CarretaDisponibilidadHistorial::class);
    }
}
