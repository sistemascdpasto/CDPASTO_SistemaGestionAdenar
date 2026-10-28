<?php

namespace App\Console\Commands;

use App\Models\Flota\VehiculoEstadoMygeotab;
use App\Models\Reparto\ModulacionItem;
use App\Models\Seguridad\Alerta;
use App\Services\Flota\VehiculoDetenidoDetector;
use App\Services\Seguridad\AlertaNotifier;
use App\Support\Distancia;
use Illuminate\Console\Command;

/**
 * Corre cada 5 minutos (ver routes/console.php): actualiza el estado de
 * cada placa desde MyGeotab y manda un correo (a Reparto + Administrador)
 * por cada vehículo que lleve 30+ minutos detenido, SI pasa los 3 filtros
 * que pidió Brian para no generar falsos positivos (vehículos parqueados
 * de noche en la bodega, o fuera de ruta). El dashboard sigue mostrando
 * TODOS los vehículos detenidos igual — estos filtros solo deciden si se
 * manda el correo, ver VehiculosDetenidosController para la pantalla.
 */
class DetectarVehiculosDetenidos extends Command
{
    protected $signature = 'reparto:detectar-vehiculos-detenidos';

    protected $description = 'Detecta vehículos detenidos 30+ min (MyGeotab) y notifica por correo a Reparto/Administrador';

    private const MINUTOS_UMBRAL = 30;

    private const HORA_INICIO = 6;

    private const HORA_FIN = 22;

    // Coordenada del centro de distribución Bavaria (la dio Brian) — ahí
    // se guardan los vehículos, no se notifica si está parqueado aquí.
    private const BODEGA_LATITUD = 1.153695;

    private const BODEGA_LONGITUD = -77.305209;

    // Radio alrededor de la bodega (metros) dentro del cual no se notifica
    // — no especificado por Brian, elegido razonablemente, fácil de ajustar.
    private const BODEGA_RADIO_METROS = 300;

    public function handle(VehiculoDetenidoDetector $detector): int
    {
        $estados = $detector->actualizarEstados();

        $candidatos = $estados->filter(fn (VehiculoEstadoMygeotab $e) => $e->detenido
            && $e->detenido_desde !== null
            && $e->detenido_desde->lte(now()->subMinutes(self::MINUTOS_UMBRAL))
            && $e->notificado_en === null);

        if ($candidatos->isEmpty()) {
            $this->info('Sin vehículos nuevos que notificar.');

            return self::SUCCESS;
        }

        $notificados = 0;

        foreach ($candidatos as $estado) {
            // Se marca como notificado SIEMPRE (pase o no los 3 filtros),
            // para no reevaluarlo sin parar cada 5 min mientras siga
            // detenido — si se vuelve a mover y detener, es un evento
            // nuevo (VehiculoDetenidoDetector ya reinicia notificado_en).
            $estado->update(['notificado_en' => now()]);

            if (! $this->debeNotificar($estado)) {
                continue;
            }

            $minutos = (int) round($estado->detenido_desde->diffInMinutes(now()));

            $alerta = Alerta::create([
                'tipo' => 'vehiculo_detenido',
                'mensaje' => "La placa {$estado->placa} lleva detenida {$minutos} minutos (desde las {$estado->detenido_desde->format('H:i')}).",
                'contexto' => [
                    'placa' => $estado->placa,
                    'latitud' => $estado->latitud,
                    'longitud' => $estado->longitud,
                ],
            ]);
            AlertaNotifier::notificar($alerta);

            $notificados++;
        }

        $this->info("Vehículos notificados: {$notificados} de {$candidatos->count()} candidatos.");

        return self::SUCCESS;
    }

    private function debeNotificar(VehiculoEstadoMygeotab $estado): bool
    {
        $hora = (int) now()->format('G');
        if ($hora < self::HORA_INICIO || $hora >= self::HORA_FIN) {
            return false;
        }

        if ($this->enLaBodega($estado)) {
            return false;
        }

        return $this->tieneRutaHoy($estado->placa);
    }

    private function enLaBodega(VehiculoEstadoMygeotab $estado): bool
    {
        if ($estado->latitud === null || $estado->longitud === null) {
            return false;
        }

        return Distancia::metros(
            (float) $estado->latitud,
            (float) $estado->longitud,
            self::BODEGA_LATITUD,
            self::BODEGA_LONGITUD,
        ) <= self::BODEGA_RADIO_METROS;
    }

    private function tieneRutaHoy(string $placa): bool
    {
        return ModulacionItem::query()
            ->whereRaw('UPPER(TRIM(placa)) = ?', [$placa])
            ->whereHas('modulacion', fn ($q) => $q->whereDate('fecha', now()->toDateString()))
            ->exists();
    }
}
