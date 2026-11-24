<?php

namespace App\Models\Flota;

use Illuminate\Database\Eloquent\Casts\Attribute;
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

    protected function url(): Attribute
    {
        return Attribute::get(fn () => Storage::disk('public')->url($this->path));
    }

    protected function esPdf(): Attribute
    {
        return Attribute::get(fn () => str_contains($this->tipo_mime ?? '', 'pdf'));
    }
}