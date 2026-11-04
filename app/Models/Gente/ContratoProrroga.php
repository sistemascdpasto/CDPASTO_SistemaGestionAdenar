<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContratoProrroga extends Model
{
    public const MAX_PRORROGAS_INICIALES = 3;

    protected $table = 'contrato_prorrogas';

    protected $fillable = [
        'colaborador_id',
        'registrado_por',
        'fecha_anterior',
        'fecha_inicio',
        'fecha_nueva',
        'tipo',
        'observaciones',
        'documento_path',
        'documento_nombre',
    ];

    protected $casts = [
        'fecha_anterior' => 'date:Y-m-d',
        'fecha_inicio' => 'date:Y-m-d',
        'fecha_nueva' => 'date:Y-m-d',
    ];

    public function fechaInicioEfectiva(): ?Carbon
    {
        if ($this->tipo !== 'prorroga') {
            return null;
        }

        return $this->fecha_inicio ?? $this->fecha_anterior?->copy()->addDay();
    }

    public static function esProrrogaAnual(int $numero): bool
    {
        return $numero > self::MAX_PRORROGAS_INICIALES;
    }

    public static function fechaFinAnual(Carbon $fechaInicio): Carbon
    {
        return $fechaInicio->copy()->addYearNoOverflow()->subDay();
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }
}
