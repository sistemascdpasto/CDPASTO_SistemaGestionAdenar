<?php

namespace App\Models\Capacitaciones;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class CapacitacionPortalConfig extends Model
{
    protected $table = 'capacitacion_portal_config';

    protected $fillable = [
        'titulo_hero',
        'subtitulo_hero',
        'imagen_hero_path',
    ];

    protected $appends = ['imagen_hero_url'];

    public function getImagenHeroUrlAttribute(): ?string
    {
        return $this->imagen_hero_path
            ? Storage::url($this->imagen_hero_path)
            : null;
    }

    /**
     * Obtiene (o crea) la única fila de configuración del portal.
     */
    public static function obtener(): self
    {
        return self::firstOrCreate(
            ['id' => 1],
            [
                'titulo_hero' => 'Atraemos talento, desarrollamos potencial.',
                'subtitulo_hero' => 'Capacitaciones certificadas para el crecimiento profesional de tu equipo. Aprende a tu ritmo, avanza con propósito.',
                'imagen_hero_path' => null,
            ]
        );
    }
}
