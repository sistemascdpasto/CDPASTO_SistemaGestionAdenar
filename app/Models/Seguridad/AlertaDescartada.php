<?php

namespace App\Models\Seguridad;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AlertaDescartada extends Model
{
    protected $table = 'alertas_descartadas';

    public $timestamps = false;

    protected $fillable = [
        'alerta_id',
        'user_id',
        'descartada_en',
    ];

    protected $casts = [
        'descartada_en' => 'datetime',
    ];

    public function alerta(): BelongsTo
    {
        return $this->belongsTo(Alerta::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
