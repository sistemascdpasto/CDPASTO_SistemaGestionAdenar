<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ColaboradorPadrinoIndicador extends Model
{
    protected $table = 'colaborador_padrino_indicadores';

    protected $fillable = [
        'colaborador_id',
        'mes',
        'anio',
        'safety_together',
        'comunicacion_asertiva',
        'habilidades',
        'eventos_seguridad',
    ];

    protected function casts(): array
    {
        return [
            'safety_together'      => 'boolean',
            'comunicacion_asertiva' => 'boolean',
            'habilidades'          => 'boolean',
            'eventos_seguridad'    => 'boolean',
            'mes'                  => 'integer',
            'anio'                 => 'integer',
        ];
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }
}
