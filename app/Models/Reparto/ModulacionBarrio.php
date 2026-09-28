<?php

namespace App\Models\Reparto;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ModulacionBarrio extends Model
{
    protected $table = 'modulacion_barrios';

    protected $fillable = [
        'municipio_id',
        'nombre',
        'nombre_normalizado',
        'origen',
    ];

    public function municipio(): BelongsTo
    {
        return $this->belongsTo(ModulacionMunicipio::class);
    }
}
