<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DpoAcademy extends Model
{
    use HasFactory;

    protected $table = 'dpo_academy';

    protected $fillable = [
        'colaborador_id',
        'mes',
        'anio',
        'region',
        'centro',
        'negocio',
        'qr_safety',
        'nombre',
        'cargo',
        'coronita',
        'calificacion',
        'status',
    ];

    protected $casts = [
        'mes' => 'integer',
        'anio' => 'integer',
        'calificacion' => 'float',
    ];

    protected static function booted(): void
    {
        // mes y anio se establecen explícitamente en la importación cuando el
        // archivo los contiene. Si no vienen en los datos se dejan null para
        // que el controlador los resuelva por created_at — no forzamos el mes
        // del sistema porque rompería el filtrado por período.
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class, 'colaborador_id');
    }
}
