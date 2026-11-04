<?php

namespace App\Services\Seguridad;

use App\Models\Gente\OpcionCatalogo;
use App\Models\GeovictoriaAsistencia;
use App\Models\Seguridad\Colaborador;

class ColaboradorCatalogoService
{
    /**
     * @return array<int, string>
     */
    public function cargos(): array
    {
        return collect(config('seguridad.colaboradores.cargos', []))
            ->merge(Colaborador::query()->whereNotNull('cargo')->where('cargo', '!=', '')->distinct()->pluck('cargo'))
            ->merge(GeovictoriaAsistencia::query()->whereNotNull('cargo')->where('cargo', '!=', '')->distinct()->pluck('cargo'))
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    public function tiposContrato(): array
    {
        return collect(config('seguridad.colaboradores.tipos_contrato', []))
            ->merge(OpcionCatalogo::opcionesDe('tipo_contrato'))
            ->merge(
                Colaborador::query()
                    ->whereNotNull('tipo_contrato')
                    ->where('tipo_contrato', '!=', '')
                    ->distinct()
                    ->pluck('tipo_contrato'),
            )
            ->unique()
            ->sort()
            ->values()
            ->all();
    }
}
