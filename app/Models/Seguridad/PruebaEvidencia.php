<?php

namespace App\Models\Seguridad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PruebaEvidencia extends Model
{
    protected $table = 'prueba_evidencias';

    protected $fillable = [
        'prueba_alcoholemia_id',
        'path',
        'marca_agua_ok',
    ];

    protected function casts(): array
    {
        return ['marca_agua_ok' => 'boolean'];
    }

    public function prueba(): BelongsTo
    {
        return $this->belongsTo(PruebaAlcoholemia::class, 'prueba_alcoholemia_id');
    }

    /** Alias para el eager-load del comando (with('pruebaAlcoholemia')) */
    public function pruebaAlcoholemia(): BelongsTo
    {
        return $this->belongsTo(PruebaAlcoholemia::class, 'prueba_alcoholemia_id');
    }
}
