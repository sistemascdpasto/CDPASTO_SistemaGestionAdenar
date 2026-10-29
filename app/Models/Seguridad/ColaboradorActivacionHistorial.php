<?php

namespace App\Models\Seguridad;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ColaboradorActivacionHistorial extends Model
{
    protected $table = 'colaborador_activacion_historial';

    protected $fillable = [
        'colaborador_id',
        'is_active',
        'tipo',
        'fecha',
        'motivo',
        'observaciones',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'fecha' => 'datetime',
        ];
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
