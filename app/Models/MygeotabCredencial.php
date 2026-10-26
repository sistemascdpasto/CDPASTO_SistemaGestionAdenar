<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MygeotabCredencial extends Model
{
    protected $table = 'mygeotab_credenciales';

    protected $fillable = [
        'username',
        'password',
        'database',
        'actualizado_por_id',
    ];

    protected function casts(): array
    {
        return [
            'username' => 'encrypted',
            'password' => 'encrypted',
            'database' => 'encrypted',
        ];
    }

    public function actualizadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actualizado_por_id');
    }
}
