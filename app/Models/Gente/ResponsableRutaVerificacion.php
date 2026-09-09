<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResponsableRutaVerificacion extends Model
{
    protected $table = 'responsable_ruta_verificaciones';

    protected $fillable = [
        'colaborador_id',
        'fecha',
        'inicio',
        'fin',
        'duracion_minutos',
        'created_by',
        'closed_by',
    ];

    protected $casts = [
        'fecha'             => 'date',
        'inicio'            => 'datetime',
        'fin'               => 'datetime',
        'duracion_minutos'  => 'integer',
    ];

    /**
     * Relación con el colaborador (Responsable de Ruta).
     */
    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class, 'colaborador_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    /**
     * ¿El proceso ya fue finalizado (tiene inicio y fin)?
     */
    public function getEstaFinalizadoAttribute(): bool
    {
        return $this->inicio !== null && $this->fin !== null;
    }

    /**
     * Duración formateada como "HH:MM:SS".
     */
    protected function duracionFormateada(): Attribute
    {
        return Attribute::make(
            get: function (mixed $_, array $attrs): ?string {
                if (!isset($attrs['inicio']) || !isset($attrs['fin'])) return null;

                $segundos = (int) round(strtotime($attrs['fin']) - strtotime($attrs['inicio']));
                if ($segundos < 0) $segundos = 0;

                $hh = str_pad((string) intdiv($segundos, 3600), 2, '0', STR_PAD_LEFT);
                $mm = str_pad((string) intdiv($segundos % 3600, 60), 2, '0', STR_PAD_LEFT);
                $ss = str_pad((string) ($segundos % 60), 2, '0', STR_PAD_LEFT);

                return "{$hh}:{$mm}:{$ss}";
            }
        );
    }

    /**
     * Scope para filtrar por colaborador y fecha exacta.
     */
    public function scopePorColaboradorFecha($query, int $colaboradorId, string $fecha)
    {
        return $query
            ->where('colaborador_id', $colaboradorId)
            ->whereDate('fecha', $fecha);
    }
}
