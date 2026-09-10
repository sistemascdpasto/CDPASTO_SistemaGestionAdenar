<?php

namespace App\Models\Gente;

use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChecklistPlanPremiacion extends Model
{
    protected $table = 'checklist_plan_premiacion';

    protected $fillable = [
        'colaborador_id',
        'mes',
        'anio',
        'cl_pre',
        'cl_post',
        'ausentismo_ok',
        'updated_by',
    ];

    protected $casts = [
        'mes'           => 'integer',
        'anio'          => 'integer',
        'cl_pre'        => 'boolean',
        'cl_post'       => 'boolean',
        'ausentismo_ok' => 'boolean',
    ];

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class, 'colaborador_id');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
