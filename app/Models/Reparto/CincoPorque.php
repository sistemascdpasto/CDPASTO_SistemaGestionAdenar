<?php

namespace App\Models\Reparto;

use App\Models\Flota\Vehiculo;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CincoPorque extends Model
{
    protected $table = 'cinco_porques';

    protected $fillable = [
        'user_id',
        'colaborador_id',
        'vehiculo_id',
        'fecha',
        'rutina',
        'indicador',
        'problema',
        'porque_1',
        'porque_2',
        'porque_3',
        'porque_4',
        'porque_5',
        'causa_raiz',
        'plan_accion',
        'ia_sugerencias',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date:Y-m-d',
            'ia_sugerencias' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    /**
     * @return array<int, string>
     */
    public function porquesArray(): array
    {
        return array_values(array_filter([
            $this->porque_1,
            $this->porque_2,
            $this->porque_3,
            $this->porque_4,
            $this->porque_5,
        ], fn ($v) => filled($v)));
    }
}
