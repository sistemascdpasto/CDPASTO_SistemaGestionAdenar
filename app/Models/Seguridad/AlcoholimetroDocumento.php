<?php

namespace App\Models\Seguridad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AlcoholimetroDocumento extends Model
{
    protected $table = 'alcoholimetro_documentos';

    protected $fillable = [
        'alcoholimetro_id',
        'path',
        'nombre_original',
    ];

    public function alcoholimetro(): BelongsTo
    {
        return $this->belongsTo(Alcoholimetro::class);
    }
}
