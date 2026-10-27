<?php

namespace App\Services\Flota;

use App\Models\Flota\VehiculoKilometroDiario;
use App\Support\MygeotabPlaca;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Log;

/**
 * Trae de MyGeotab los viajes (Trip) del día y los agrega por vehículo
 * (suma de Trip.distance, en km) para dejarlos en
 * vehiculo_kilometros_diarios. Se guarda por placa (texto libre, sin FK),
 * igual que modulacion_items.placa — ver OcupacionCargaController para el
 * mismo patrón de cruce por placa normalizada usado en el dashboard de
 * análisis de combustible.
 */
class MygeotabKilometrosSyncService
{
    public function __construct(private MygeotabClient $cliente) {}

    /**
     * @return array{vehiculos_actualizados: int, viajes_procesados: int}
     */
    public function sincronizarDia(CarbonInterface $fecha): array
    {
        $fechaLocal = $fecha->toDateString();

        $dispositivos = $this->cliente->dispositivos();
        $placaPorDeviceId = [];
        foreach ($dispositivos as $dispositivo) {
            $placa = $dispositivo['licensePlate'] ?? $dispositivo['name'] ?? null;
            $deviceId = $dispositivo['id'] ?? null;
            if ($placa && $deviceId) {
                $placaPorDeviceId[$deviceId] = MygeotabPlaca::normalizar($placa);
            }
        }

        $desde = $fecha->copy()->startOfDay()->subHours(12)->toIso8601ZuluString();
        $hasta = $fecha->copy()->endOfDay()->addHours(12)->toIso8601ZuluString();
        $viajes = $this->cliente->viajes($desde, $hasta);

        // El rango de búsqueda se da holgado (±12h) porque MyGeotab filtra en
        // UTC y 'start' puede caer un día antes/después en UTC respecto al
        // día local (America/Bogota) que realmente nos interesa — se filtra
        // aquí por la fecha local real de cada viaje.
        $kmPorDeviceId = [];
        $viajesDelDia = 0;
        foreach ($viajes as $viaje) {
            $deviceId = $viaje['device']['id'] ?? null;
            $inicio = $viaje['start'] ?? null;
            $distancia = (float) ($viaje['distance'] ?? 0);

            if (! $deviceId || ! $inicio) {
                continue;
            }

            $fechaViajeLocal = Carbon::parse($inicio)->setTimezone(config('app.timezone'))->toDateString();
            if ($fechaViajeLocal !== $fechaLocal) {
                continue;
            }

            $kmPorDeviceId[$deviceId] = ($kmPorDeviceId[$deviceId] ?? 0) + $distancia;
            $viajesDelDia++;
        }

        $ahora = now();
        $filas = [];
        foreach ($kmPorDeviceId as $deviceId => $km) {
            $placa = $placaPorDeviceId[$deviceId] ?? null;
            if (! $placa) {
                Log::warning('MyGeotab: viaje de un dispositivo sin placa mapeada.', ['device_id' => $deviceId]);

                continue;
            }

            $filas[] = [
                'fecha' => $fechaLocal,
                'placa' => $placa,
                'mygeotab_device_id' => $deviceId,
                'distancia_km' => round($km, 2),
                'created_at' => $ahora,
                'updated_at' => $ahora,
            ];
        }

        if ($filas !== []) {
            VehiculoKilometroDiario::upsert(
                $filas,
                ['fecha', 'placa'],
                ['mygeotab_device_id', 'distancia_km', 'updated_at']
            );
        }

        return [
            'vehiculos_actualizados' => count($filas),
            'viajes_procesados' => $viajesDelDia,
        ];
    }
}
