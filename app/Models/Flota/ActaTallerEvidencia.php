<?php

namespace App\Models\Flota;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ActaTallerEvidencia extends Model
{
    protected $table = 'actas_taller_evidencias';

    protected $fillable = [
        'acta_taller_id',
        'novedad_id',
        'path',
        'etiqueta',
        'orden',
    ];

    protected $appends = ['url'];

    public function acta(): BelongsTo
    {
        return $this->belongsTo(ActaTaller::class, 'acta_taller_id');
    }

    public function novedad(): BelongsTo
    {
        return $this->belongsTo(ActaTallerNovedad::class, 'novedad_id');
    }

    public function getUrlAttribute(): string
    {
        return Storage::disk('public')->url($this->path);
    }
}
