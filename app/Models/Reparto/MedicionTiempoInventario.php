<?php

namespace App\Models\Reparto;

use App\Models\Seguridad\Colaborador;
use App\Models\User;
use App\Models\Flota\Vehiculo;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicionTiempoInventario extends Model
{
    protected $table = 'medicion_tiempos_inventario';

    protected $fillable = [
        'fecha_medicion',
        'hora_inicio',
        'hora_fin',
        'duracion_minutos',
        'meta_minutos',
        'placa_vehiculo',
        'nombre_colaborador',
        'tipo_inventario',
        'user_id',
        'colaborador_id',
        'vehiculo_id',
        'creado_por',
    ];

    protected $casts = [
        'fecha_medicion' => 'date',
        'hora_inicio' => 'datetime:H:i',
        'hora_fin' => 'datetime:H:i',
        'duracion_minutos' => 'integer',
        'meta_minutos' => 'integer',
        'fecha_creacion' => 'datetime',
    ];

    /** Relación con el usuario que creó el registro */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Relación con el colaborador */
    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    /** Relación con el vehículo */
    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    /** Scope para filtrar por fecha */
    public function scopeFecha($query, $fecha)
    {
        return $query->where('fecha_medicion', $fecha);
    }

    /** Scope para filtrar por rango de fechas */
    public function scopeEntreFechas($query, $desde, $hasta)
    {
        return $query->whereBetween('fecha_medicion', [$desde, $hasta]);
    }

    /** Scope para filtrar por placa de vehículo */
    public function scopePorPlaca($query, $placa)
    {
        return $query->whereHas('vehiculo', function ($q) use ($placa) {
            $q->where('placa', 'like', "%{$placa}%");
        });
    }

    /** Scope para filtrar por colaborador */
    public function scopePorColaborador($query, $cedula)
    {
        return $query->whereHas('colaborador', function ($q) use ($cedula) {
            $q->where('cedula', 'like', "%{$cedula}%")
              ->orWhere('nombres', 'like', "%{$cedula}%")
              ->orWhere('apellidos', 'like', "%{$cedula}%");
        });
    }

    /** Scope para registros del usuario actual */
    public function scopeDelUsuario($query, $userId)
    {
        return $query->where('user_id', $userId);
    }
}