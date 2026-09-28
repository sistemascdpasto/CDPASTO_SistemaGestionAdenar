<?php

namespace App\Models\Reparto;

use App\Models\Seguridad\Colaborador;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ModulacionNovedad extends Model
{
    protected $table = 'modulacion_novedades';

    protected $fillable = [
        'modulacion_id',
        'colaborador_id',
        'cedula',
        'nombres',
        'cargo',
        'observaciones',
        'fijo',
        'fijo_rescate',
        'fijo_taller',
        'fecha_reintegro',
        'permiso',
        'no_asitio',
        'incapacidad',
        'vacaciones',
    ];

    protected function casts(): array
    {
        return [
            'fijo'         => 'boolean',
            'fijo_rescate' => 'boolean',
            'fijo_taller'  => 'boolean',
            'permiso'      => 'boolean',
            'no_asitio'    => 'boolean',
            'incapacidad'  => 'boolean',
            'vacaciones'   => 'boolean',
        ];
    }

    public function modulacion(): BelongsTo
    {
        return $this->belongsTo(Modulacion::class);
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    // Accessor para mantener compatibilidad con frontend que espera no_asistio
    protected function getNoAsistioAttribute(): bool
    {
        return (bool) ($this->attributes['no_asitio'] ?? false);
    }
}
