<?php

namespace App\Services\Flota;

use App\Models\Flota\VehiculoEstadoMygeotab;
use App\Support\MygeotabPlaca;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Actualiza vehiculo_estado_mygeotab con el estado actual de cada placa
 * (DeviceStatusInfo) — para el módulo de Vehículos Detenidos (Reparto).
 * 'detenido_desde' se calcula restando el 'currentStateDuration' que ya
 * trae MyGeotab a la hora del dato, no infiriéndolo comparando sondeos.
 */
class VehiculoDetenidoDetector
{
    // Si la parada "fresca" calculada en este sondeo queda más de esto
    // (segundos) separada de la que ya teníamos guardada, se asume que el
    // vehículo se movió y se volvió a parar entre sondeos — es una parada
    // NUEVA, no la continuación de la anterior, así que se reinicia el
    // dedupe de notificación (notificado_en vuelve a null).
    private const TOLERANCIA_MISMA_PARADA_SEGUNDOS = 120;

    public function __construct(private MygeotabClient $cliente) {}

    /**
     * @return Collection<int, VehiculoEstadoMygeotab>
     */
    public function actualizarEstados(): Collection
    {
        $placaPorDeviceId = [];
        foreach ($this->cliente->dispositivos() as $dispositivo) {
            $placaCruda = $dispositivo['licensePlate'] ?? $dispositivo['name'] ?? null;
            $deviceId = $dispositivo['id'] ?? null;
            if ($placaCruda && $deviceId) {
                $placaPorDeviceId[$deviceId] = MygeotabPlaca::normalizar($placaCruda);
            }
        }

        $anteriores = VehiculoEstadoMygeotab::query()->get()->keyBy('placa');

        return collect($this->cliente->estadosDispositivos())
            ->map(function (array $estado) use ($placaPorDeviceId, $anteriores) {
                $deviceId = $estado['device']['id'] ?? null;
                $placa = $deviceId ? ($placaPorDeviceId[$deviceId] ?? null) : null;

                if (! $placa) {
                    return null;
                }

                return $this->actualizarPlaca($placa, $deviceId, $estado, $anteriores->get($placa));
            })
            ->filter()
            ->values();
    }

    /**
     * @param  array<string, mixed>  $estado
     */
    private function actualizarPlaca(string $placa, string $deviceId, array $estado, ?VehiculoEstadoMygeotab $anterior): VehiculoEstadoMygeotab
    {
        $detenido = (float) ($estado['speed'] ?? 0) === 0.0;
        // MyGeotab manda 'dateTime' en UTC ('...Z'). Sin convertir a la zona
        // de la app ANTES de guardar, Eloquent reinterpreta los mismos
        // dígitos como si ya fueran hora local al releerlos de la BD (no
        // hace conversión de zona horaria por sí solo) — mismo ajuste que
        // ya hace MygeotabKilometrosSyncService con los timestamps de Trip.
        $fechaDato = isset($estado['dateTime'])
            ? Carbon::parse($estado['dateTime'])->setTimezone(config('app.timezone'))
            : now();

        $detenidoDesde = null;
        if ($detenido) {
            $segundos = $this->parsearDuracion((string) ($estado['currentStateDuration'] ?? '00:00:00'));
            $detenidoDesde = $fechaDato->copy()->subSeconds($segundos);
        }

        $notificadoEn = $this->resolverNotificadoEn($detenido, $detenidoDesde, $anterior);

        return VehiculoEstadoMygeotab::updateOrCreate(
            ['placa' => $placa],
            [
                'mygeotab_device_id' => $deviceId,
                'detenido' => $detenido,
                'velocidad' => (float) ($estado['speed'] ?? 0),
                'latitud' => $estado['latitude'] ?? null,
                'longitud' => $estado['longitude'] ?? null,
                'ultima_posicion_en' => $fechaDato,
                'detenido_desde' => $detenidoDesde,
                'notificado_en' => $notificadoEn,
            ]
        );
    }

    private function resolverNotificadoEn(bool $detenido, ?Carbon $detenidoDesde, ?VehiculoEstadoMygeotab $anterior): ?Carbon
    {
        if (! $detenido) {
            return null;
        }

        $esParadaNueva = ! $anterior
            || ! $anterior->detenido
            || ! $anterior->detenido_desde
            || abs($detenidoDesde->diffInSeconds($anterior->detenido_desde)) > self::TOLERANCIA_MISMA_PARADA_SEGUNDOS;

        return $esParadaNueva ? null : $anterior->notificado_en;
    }

    /**
     * TimeSpan de MyGeotab: "HH:MM:SS" normalmente, o "D.HH:MM:SS" si pasa
     * de 24h. Los segundos pueden traer decimales.
     */
    private function parsearDuracion(string $duracion): int
    {
        $dias = 0;

        if (str_contains($duracion, '.')) {
            [$posiblesDias, $resto] = explode('.', $duracion, 2);
            // Diferenciar "D.HH:MM:SS" (el separador de días no lleva ':'
            // antes del punto) de "HH:MM:SS.fffffff" (segundos con decimales).
            if (! str_contains($posiblesDias, ':') && ctype_digit($posiblesDias)) {
                $dias = (int) $posiblesDias;
                $duracion = $resto;
            }
        }

        $partes = explode(':', $duracion);
        $horas = (int) ($partes[0] ?? 0);
        $minutos = (int) ($partes[1] ?? 0);
        $segundos = (int) round((float) ($partes[2] ?? 0));

        return $dias * 86400 + $horas * 3600 + $minutos * 60 + $segundos;
    }
}
