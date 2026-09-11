<?php

namespace App\Models\Capacitaciones;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class CapacitacionBanner extends Model
{
    protected $table = 'capacitacion_banner';

    protected $fillable = [
        'imagen_path',
        'frase',
        'sub_frase',
        'updated_by',
    ];

    protected $appends = ['imagen_url'];

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function getImagenUrlAttribute(): ?string
    {
        return $this->imagen_path ? Storage::url($this->imagen_path) : null;
    }

    /**
     * Devuelve el único registro de banner, o uno en memoria con valores por defecto
     * si todavía no se ha guardado ninguno. Nunca lanza una excepción.
     */
    public static function actual(): self
    {
        return static::first() ?? new static([
            'frase'     => 'Tu aprendizaje impulsa tu seguridad y la de tus compañeros.',
            'sub_frase' => 'Explora los materiales disponibles y marca tu progreso.',
        ]);
    }
}
