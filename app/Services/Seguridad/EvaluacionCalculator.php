<?php

namespace App\Services\Seguridad;

use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\CondicionSalud;
use App\Models\Seguridad\PruebaAlcoholemia;
use Illuminate\Support\Carbon;

class EvaluacionCalculator
{
    /**
     * HU047: estado del colaborador hoy (Apto / Apto con Observaciones / No Apto),
     * o null si todavía no tiene ningún registro el día de hoy.
     */
    public function paraColaboradorHoy(Colaborador $colaborador): ?string
    {
        $hoy = Carbon::today();

        $huboPositiva = PruebaAlcoholemia::query()
            ->where('colaborador_id', $colaborador->id)
            ->whereDate('fecha_hora', $hoy)
            ->where('es_positivo', true)
            ->exists();

        if ($huboPositiva) {
            return 'No Apto';
        }

        $condicion = CondicionSalud::query()
            ->where('colaborador_id', $colaborador->id)
            ->whereDate('fecha_hora', $hoy)
            ->latest('fecha_hora')
            ->first();

        $huboPrueba = PruebaAlcoholemia::query()
            ->where('colaborador_id', $colaborador->id)
            ->whereDate('fecha_hora', $hoy)
            ->where('estado', 'realizada')
            ->exists();

        if (! $condicion && ! $huboPrueba) {
            return null;
        }

        return match ($condicion?->estado) {
            'Malo' => 'No Apto',
            'Regular' => 'Apto con Observaciones',
            default => 'Apto',
        };
    }

    /**
     * Bloquea la creación de un NUEVO ingreso: cuando el último registro
     * histórico del colaborador es un ingreso sin su salida correspondiente.
     * Si hoy ya existe un registro de ingreso, esta comprobación no aplica
     * (el registro de hoy ya es inmutable por sí mismo, ver `store()`) —
     * por eso es distinta de {@see faltaRegistrarSalida()}.
     */
    /**
     * Bloquea la creación de un NUEVO ingreso: cuando el último registro
     * histórico del colaborador es un ingreso sin su salida correspondiente.
     */
    public function jornadaAbierta(Colaborador $colaborador): bool
    {
        return $this->ultimoMomentoEsIngreso($colaborador);
    }

    /**
     * Para avisos informativos (dashboard, historial): si el último registro
     * es un ingreso sin salida.
     */
    public function faltaRegistrarSalida(Colaborador $colaborador): bool
    {
        return $this->ultimoMomentoEsIngreso($colaborador);
    }

    public function ultimoRegistro(Colaborador $colaborador): ?CondicionSalud
    {
        return CondicionSalud::query()
            ->where('colaborador_id', $colaborador->id)
            ->latest('fecha_hora')
            ->first();
    }

    private function ultimoMomentoEsIngreso(Colaborador $colaborador): bool
    {
        $ultimoRegistro = $this->ultimoRegistro($colaborador);

        return $ultimoRegistro?->momento === 'ingreso';
    }
}
