<?php

namespace App\Models\Reparto;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class RevisionNovedadEvidencia extends Model
{
    protected $table = 'revision_novedad_evidencias';

    protected $fillable = [
        'novedad_id',
        'path',
        'orden',
    ];

    protected $appends = ['url'];

    public function novedad(): BelongsTo
    {
        return $this->belongsTo(RevisionNovedad::class, 'novedad_id');
    }

    public function getUrlAttribute(): string
    {
        return Storage::disk('public')->url($this->path);
    }
}
