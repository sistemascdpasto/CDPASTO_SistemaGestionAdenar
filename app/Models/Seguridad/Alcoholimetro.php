<?php

namespace App\Models\Seguridad;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

class Alcoholimetro extends Model
{
    use SoftDeletes;

    protected $table = 'alcoholimetros';

    protected $fillable = [
        'codigo',
        'marca',
        'modelo',
        'fecha_calibracion',
        'fecha_vencimiento_certificado',
        'valor_min',
        'valor_max',
        'estado',
    ];

    protected function casts(): array
    {
        return [
            'fecha_calibracion' => 'date',
            'fecha_vencimiento_certificado' => 'date',
            'valor_min' => 'decimal:3',
            'valor_max' => 'decimal:3',
        ];
    }

    public function mantenimientos(): HasMany
    {
        return $this->hasMany(AlcoholimetroMantenimiento::class)->latest('fecha');
    }

    public function imagenes(): HasMany
    {
        return $this->hasMany(AlcoholimetroImagen::class);
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(AlcoholimetroDocumento::class);
    }

    public function pruebasAlcoholemia(): HasMany
    {
        return $this->hasMany(PruebaAlcoholemia::class);
    }

    public function calibracionProxima(): bool
    {
        $dias = config('seguridad.dias_alerta_calibracion');
        $limite = Carbon::now()->addDays($dias);

        return ($this->fecha_calibracion && $this->fecha_calibracion->lte($limite))
            || ($this->fecha_vencimiento_certificado && $this->fecha_vencimiento_certificado->lte($limite));
    }
}
