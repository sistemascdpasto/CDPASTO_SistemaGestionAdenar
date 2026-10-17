<?php

namespace App\Models\Flota;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ExtintorInspeccionEvidencia extends Model
{
    protected $table = 'extintor_inspeccion_evidencias';

    protected $fillable = [
        'inspeccion_id',
        'path',
        'nombre_original',
        'tipo_mime',
        'orden',
    ];

    protected $appends = ['url', 'es_pdf'];

    public function inspeccion(): BelongsTo
    {
        return $this->belongsTo(ExtintorInspeccion::class, 'inspeccion_id');
    }

    public function getUrlAttribute(): string
    {
        return Storage::disk('public')->url($this->path);
    }

    public function getEsPdfAttribute(): bool
    {
        return str_contains($this->tipo_mime ?? '', 'pdf');
    }
}
