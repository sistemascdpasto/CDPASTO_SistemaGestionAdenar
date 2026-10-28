<?php

namespace App\Support;

use App\Models\Seguridad\Alerta;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Query compartida entre los controladores de Alertas de cada pilar
 * (Seguridad/Gente/Flota). Administrador ve TODO sin filtrar por pilar
 * (con el pilar visible en cada fila) sin importar desde cuál de las
 * pantallas entre; cualquier otro usuario solo ve el pilar dueño de esa
 * pantalla.
 */
class AlertasPorPilar
{
    public static function paginar(string $pilar, User $user, string $estado): LengthAwarePaginator
    {
        return Alerta::query()
            ->with(['colaborador:id,nombres,apellidos,fecha_retiro_empresa', 'alcoholimetro:id,codigo'])
            ->when(! $user->hasRole('Administrador'), fn ($query) => $query->where('pilar', $pilar))
            ->when($estado === 'pendientes', fn ($query) => $query->where('atendida', false))
            ->when($estado === 'atendidas', fn ($query) => $query->where('atendida', true))
            ->latest()
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Alerta $alerta) => [
                'id' => $alerta->id,
                'tipo' => $alerta->tipo,
                'tipo_label' => AlertaCatalogo::labelDeTipo($alerta->tipo),
                'pilar' => $alerta->pilar,
                'mensaje' => $alerta->mensaje,
                'atendida' => $alerta->atendida,
                'created_at' => $alerta->created_at,
                'colaborador' => $alerta->colaborador,
                'alcoholimetro' => $alerta->alcoholimetro,
            ]);
    }
}
