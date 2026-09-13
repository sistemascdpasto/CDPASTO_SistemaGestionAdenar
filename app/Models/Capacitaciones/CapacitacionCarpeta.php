<?php

namespace App\Models\Capacitaciones;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class CapacitacionCarpeta extends Model
{
    use HasFactory;

    protected $table = 'capacitacion_carpetas';

    protected $fillable = [
        'parent_id',
        'nombre',
        'descripcion',
        'color',
        'icono',
        'visible_colaborador',
        'meses_visibles',
        'portada_path',
        'orden',
        'created_by',
    ];

    protected $casts = [
        'visible_colaborador' => 'boolean',
            'meses_visibles'      => 'array',
    ];

    protected $appends = [
        'portada_url',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function subcarpetas(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('nombre', 'asc');
    }

    public function materiales(): HasMany
    {
        return $this->hasMany(CapacitacionMaterial::class, 'carpeta_id');
    }

    public function creador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getAncestros(): array
    {
        $ancestros = [];
        $actual = $this->parent;

        while ($actual) {
            array_unshift($ancestros, [
                'id' => $actual->id,
                'nombre' => $actual->nombre,
            ]);
            $actual = $actual->parent;
        }

        return $ancestros;
    }

    public function getPortadaUrlAttribute(): ?string
    {
        return $this->portada_path ? Storage::url($this->portada_path) : null;
    }
}
