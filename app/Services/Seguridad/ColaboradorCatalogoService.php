<?php

namespace App\Services\Seguridad;

use App\Models\Gente\Cargo;
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
        return GeovictoriaAsistencia::query()
            ->whereNotNull('cargo')
            ->where('cargo', '!=', '')
            ->distinct()
            ->pluck('cargo')
            ->sort()
            ->values()
            ->all();
    }

    /**
     * Devuelve los perfiles (descripción de funciones) indexados por nombre de cargo.
     * Solo los cargos que tienen perfil definido en la tabla cargos.
     *
     * @return array<string, string>
     */
    public function perfilesCargos(): array
    {
        return Cargo::query()
            ->whereNotNull('perfil')
            ->where('perfil', '!=', '')
            ->pluck('perfil', 'nombre')
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
