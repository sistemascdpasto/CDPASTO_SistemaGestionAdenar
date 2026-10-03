<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ColaboradorPadrinoCriterio extends Model
{
    protected $table = 'colaborador_padrino_criterios';

    protected $fillable = [
        'colaborador_id',
        'qr_safety',
        'nombre_excel',
        'funcional_7_dias',
        'funcional_30_dias',
        'funcional_90_dias',
        'funcional_total',
        'hab_tecnicas_1',
        'hab_tecnicas_2',
        'hab_tecnicas_3',
        'habilidades_tecnicas_total',
        'autonomia_1',
        'autonomia_2',
        'autonomia_3',
        'autonomia_4',
        'autonomia_total',
    ];

    protected function casts(): array
    {
        return [
            'funcional_7_dias' => 'float',
            'funcional_30_dias' => 'float',
            'funcional_90_dias' => 'float',
            'funcional_total' => 'float',
            'hab_tecnicas_1' => 'float',
            'hab_tecnicas_2' => 'float',
            'hab_tecnicas_3' => 'float',
            'habilidades_tecnicas_total' => 'float',
            'autonomia_1' => 'float',
            'autonomia_2' => 'float',
            'autonomia_3' => 'float',
            'autonomia_4' => 'float',
            'autonomia_total' => 'float',
        ];
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }
}
