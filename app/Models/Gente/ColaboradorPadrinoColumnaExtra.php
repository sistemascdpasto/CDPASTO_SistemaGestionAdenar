<?php

namespace App\Models\Gente;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ColaboradorPadrinoColumnaExtra extends Model
{
    protected $table = 'colaborador_padrino_columnas_extra';

    // Sin mes/anio — la columna es global y persiste hasta que se elimina
    protected $fillable = ['nombre', 'orden'];

    protected function casts(): array
    {
        return ['orden' => 'integer'];
    }

    public function valores(): HasMany
    {
        return $this->hasMany(ColaboradorPadrinoColumnaExtraValor::class, 'columna_extra_id');
    }
}
