<?php

namespace App\Services\Gente;

use App\Models\Gente\ColaboradorContrato;
use App\Models\Gente\ContratoProrroga;
use App\Models\Seguridad\Colaborador;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ContratoVigenciaService
{
    public function contratoActual(Colaborador $colaborador): ?ColaboradorContrato
    {
        $contratos = $colaborador->contratos()->reorder();

        if ($colaborador->fecha_ingreso_empresa) {
            $contrato = (clone $contratos)
                ->whereDate('fecha_inicio', $colaborador->fecha_ingreso_empresa)
                ->when($colaborador->tipo_contrato, fn (Builder $query) => $query->where('tipo_contrato', $colaborador->tipo_contrato))
                ->orderByDesc('id')
                ->first();

            if ($contrato) {
                return $contrato;
            }

            $contrato = (clone $contratos)
                ->whereNotNull('fecha_inicio')
                ->whereDate('fecha_inicio', '<=', $colaborador->fecha_ingreso_empresa)
                ->orderByDesc('fecha_inicio')
                ->orderByDesc('id')
                ->first();

            if ($contrato) {
                return $contrato;
            }
        }

        return (clone $contratos)->orderByDesc('id')->first();
    }

    public function cantidadProrrogas(Colaborador $colaborador, ?ColaboradorContrato $contrato = null): int
    {
        $contrato ??= $this->contratoActual($colaborador);

        $query = $colaborador->prorrogas()->where('tipo', 'prorroga');

        return $contrato
            ? $query->where('contrato_id', $contrato->id)->count()
            : $query->whereNull('contrato_id')->count();
    }

    public function esAprendiz(Colaborador $colaborador, ?ColaboradorContrato $contrato = null): bool
    {
        $contrato ??= $this->contratoActual($colaborador);

        return $contrato
            ? $contrato->esAprendiz()
            : Str::contains(Str::upper($colaborador->tipo_contrato.' '.$colaborador->tipo_contrato_otro), 'APRENDIZ');
    }

    /**
     * Register a new current contract, close the previous one, and synchronize
     * the collaborator's current contract fields in one transaction.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function crearContratoActual(Colaborador $colaborador, array $attributes): ColaboradorContrato
    {
        return DB::transaction(function () use ($colaborador, $attributes): ColaboradorContrato {
            $contratoAnterior = $this->contratoActual($colaborador);
            $contratoAnterior?->update(['estado' => 'finalizado']);

            $contrato = $colaborador->contratos()->create([
                ...$attributes,
                'estado' => 'activo',
            ]);

            $colaborador->update([
                'tipo_contrato' => $contrato->tipo_contrato,
                'tipo_contrato_otro' => $contrato->tipo_contrato_otro,
                'fecha_ingreso_empresa' => $contrato->fecha_inicio,
                'fecha_retiro_empresa' => $contrato->fecha_fin,
            ]);

            return $contrato;
        });
    }

    /**
     * @param  Collection<int, ContratoProrroga>  $prorrogas
     * @return Collection<int, int>
     */
    public function numerarProrrogas(Collection $prorrogas): Collection
    {
        $numeros = collect();

        $prorrogas
            ->groupBy(fn (ContratoProrroga $prorroga) => $prorroga->contrato_id ?? 'sin-contrato')
            ->each(function (Collection $prorrogasContrato) use ($numeros): void {
                foreach ($prorrogasContrato->sortBy([
                    ['fecha_anterior', 'asc'],
                    ['id', 'asc'],
                ])->values() as $indice => $prorroga) {
                    $numeros->put($prorroga->id, $indice + 1);
                }
            });

        return $numeros;
    }

    public function numeroProrroga(ContratoProrroga $prorroga): ?int
    {
        $query = ContratoProrroga::query()
            ->where('tipo', 'prorroga')
            ->where('colaborador_id', $prorroga->colaborador_id)
            ->when(
                $prorroga->contrato_id,
                fn (Builder $query) => $query->where('contrato_id', $prorroga->contrato_id),
                fn (Builder $query) => $query->whereNull('contrato_id'),
            );

        return $query
            ->where(function (Builder $query) use ($prorroga): void {
                $query->where('fecha_anterior', '<', $prorroga->fecha_anterior)
                    ->orWhere(function (Builder $query) use ($prorroga): void {
                        $query->where('fecha_anterior', $prorroga->fecha_anterior)
                            ->where('id', '<=', $prorroga->id);
                    });
            })
            ->count();
    }

    /**
     * Update a base contract and translate only its linked extensions by the
     * change in the contract's start date (or end date when start is unchanged).
     *
     * @param  array<string, mixed>  $attributes
     */
    public function actualizarContrato(Colaborador $colaborador, ColaboradorContrato $contrato, array $attributes): void
    {
        DB::transaction(function () use ($colaborador, $contrato, $attributes): void {
            $inicioAnterior = $contrato->fecha_inicio;
            $finAnterior = $contrato->fecha_fin;

            $contrato->update($attributes);
            $contrato->refresh();

            $inicioNuevo = $contrato->fecha_inicio;
            $finNuevo = $contrato->fecha_fin;
            $fechaAnterior = $inicioAnterior && $inicioNuevo && ! $inicioAnterior->equalTo($inicioNuevo)
                ? $inicioAnterior
                : $finAnterior;
            $fechaNueva = $inicioAnterior && $inicioNuevo && ! $inicioAnterior->equalTo($inicioNuevo)
                ? $inicioNuevo
                : $finNuevo;

            if (! $fechaAnterior || ! $fechaNueva) {
                return;
            }

            $diasDesplazamiento = (int) $fechaAnterior->diffInDays($fechaNueva, false);

            if ($diasDesplazamiento === 0) {
                return;
            }

            $contrato->prorrogas()->orderBy('id')->get()->each(
                function (ContratoProrroga $prorroga) use ($diasDesplazamiento): void {
                    $fechas = [];

                    foreach (['fecha_anterior', 'fecha_inicio', 'fecha_nueva'] as $campo) {
                        if ($prorroga->{$campo}) {
                            $fechas[$campo] = $prorroga->{$campo}->copy()->addDays($diasDesplazamiento)->toDateString();
                        }
                    }

                    if ($fechas !== []) {
                        $prorroga->update($fechas);
                    }
                },
            );

            if ($this->contratoActual($colaborador)?->is($contrato)) {
                $ultimaProrroga = $contrato->prorrogas()
                    ->orderByDesc('fecha_nueva')
                    ->orderByDesc('id')
                    ->first();

                if ($ultimaProrroga) {
                    $colaborador->update(['fecha_retiro_empresa' => $ultimaProrroga->fecha_nueva]);
                }
            }
        });
    }
}
