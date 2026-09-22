<?php

namespace App\Models\Flota;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CarretaDisponibilidadHistorial extends Model
{
    protected $table = 'carreta_disponibilidad_historial';

    protected $fillable = [
        'carreta_id',
        'disponible',
        'novedad',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'disponible' => 'boolean',
        ];
    }

    public function carreta(): BelongsTo
    {
        return $this->belongsTo(Carreta::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
