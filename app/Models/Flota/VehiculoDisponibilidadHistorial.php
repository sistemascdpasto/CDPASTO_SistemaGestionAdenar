<?php

namespace App\Models\Flota;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehiculoDisponibilidadHistorial extends Model
{
    protected $table = 'vehiculo_disponibilidad_historial';

    protected $fillable = [
        'vehiculo_id',
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

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
