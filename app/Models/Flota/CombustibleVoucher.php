<?php

namespace App\Models\Flota;

use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CombustibleVoucher extends Model
{
    protected $table = 'combustible_vouchers';

    protected $fillable = [
        'colaborador_id',
        'placa',
        'foto_path',
        'estado',
        'galones',
        'total_pagado',
        'precio_galon',
        'fecha_voucher',
        'gemini_raw',
        'gemini_error',
        'revisado_por_id',
        'revisado_at',
    ];

    protected function casts(): array
    {
        return [
            'galones' => 'decimal:2',
            'total_pagado' => 'decimal:2',
            'precio_galon' => 'decimal:2',
            'fecha_voucher' => 'date:Y-m-d',
            'gemini_raw' => 'array',
            'revisado_at' => 'datetime',
        ];
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function revisadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revisado_por_id');
    }
}
