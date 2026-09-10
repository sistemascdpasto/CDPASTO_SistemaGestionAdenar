<?php

namespace App\Models\Flota;

use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ActaTaller extends Model
{
    use SoftDeletes;

    protected $table = 'actas_taller';

    const ESTADO_EN_TALLER = 'en_taller';
    const ESTADO_CERRADA   = 'cerrada';
    const ESTADO_CANCELADA = 'cancelada';

    protected $fillable = [
        'numero_acta',
        'placa',
        'fecha_entrega',
        'hora_entrega',
        'fecha_estimada_solucion',
        'fecha_cierre',
        'kilometraje_entrada',
        'kilometraje_salida',
        'taller',
        'motivo_ingreso',
        'colaborador_id',
        'quien_reporta',
        'diagnostico_taller',
        'solucion_realizada',
        'estado_vehiculo',
        'inventario',
        'observaciones',
        'observacion_cierre',
        'combustible',
        'firma_entrega',
        'firma_recibe',
        'firma_autorizacion',
        'nombre_entrega',
        'cargo_entrega',
        'identificacion_entrega',
        'telefono_entrega',
        'contacto_taller',
        'nombre_recibe',
        'cargo_recibe',
        'nombre_autorizacion',
        'cargo_autorizacion',
        'estado_acta',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'fecha_entrega'           => 'datetime',
            'hora_entrega'            => 'datetime',
            'fecha_estimada_solucion' => 'datetime',
            'fecha_cierre'            => 'datetime',
            'estado_vehiculo'         => 'array',
            'inventario'              => 'array',
            'combustible'             => 'integer',
            'kilometraje_entrada'     => 'integer',
            'kilometraje_salida'      => 'integer',
        ];
    }

    // ── Relaciones ────────────────────────────────────────────────────────────

    public function novedades(): HasMany
    {
        return $this->hasMany(ActaTallerNovedad::class)->orderBy('orden');
    }

    public function evidencias(): HasMany
    {
        return $this->hasMany(ActaTallerEvidencia::class)->orderBy('orden');
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function creador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public static function generarNumero(): string
    {
        $ultimo = static::withTrashed()->orderByDesc('id')->value('numero_acta');
        if (! $ultimo) return 'AT-000001';
        $n = (int) substr($ultimo, 3);
        return 'AT-' . str_pad($n + 1, 6, '0', STR_PAD_LEFT);
    }

    public function getEstadoLabelAttribute(): string
    {
        return match ($this->estado_acta) {
            self::ESTADO_EN_TALLER => 'En taller',
            self::ESTADO_CERRADA   => 'Cerrada',
            self::ESTADO_CANCELADA => 'Cancelada',
            default                => $this->estado_acta,
        };
    }

    public function getEstadoColorAttribute(): string
    {
        return match ($this->estado_acta) {
            self::ESTADO_EN_TALLER => 'amber',
            self::ESTADO_CERRADA   => 'green',
            self::ESTADO_CANCELADA => 'gray',
            default                => 'gray',
        };
    }
}
