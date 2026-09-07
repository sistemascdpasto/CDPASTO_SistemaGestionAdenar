<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use App\Models\Seguridad\Alerta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class AlertaController extends Controller
{
    public function index(Request $request): Response
    {
        $estado = $request->string('estado', 'pendientes')->toString();

        $alertas = Alerta::query()
            ->with(['colaborador:id,nombres,apellidos', 'alcoholimetro:id,codigo'])
            ->when($estado === 'pendientes', fn ($query) => $query->where('atendida', false))
            ->when($estado === 'atendidas', fn ($query) => $query->where('atendida', true))
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('seguridad/alertas/index', [
            'alertas' => $alertas,
            'filters' => ['estado' => $estado],
        ]);
    }

    /**
     * Endpoint JSON para la campana de notificaciones del header.
     * Solo devuelve alertas pendientes (atendida = false), máx 30.
     */
    public function bell(): JsonResponse
    {
        $alertas = Alerta::query()
            ->with(['colaborador:id,nombres,apellidos,cedula', 'alcoholimetro:id,codigo'])
            ->where('atendida', false)
            ->latest()
            ->limit(30)
            ->get();

        $items = $alertas->map(fn (Alerta $a) => [
            'id'          => $a->id,
            'tipo'        => $a->tipo,
            'mensaje'     => $a->mensaje,
            'created_at'  => $a->created_at?->diffForHumans(),
            'colaborador' => $a->colaborador
                ? $a->colaborador->nombres . ' ' . $a->colaborador->apellidos
                : null,
            'cedula'      => $a->colaborador?->cedula,
            'alcoholimetro' => $a->alcoholimetro?->codigo,
        ]);

        return response()->json([
            'total'  => $alertas->count(),
            'alertas' => $items,
        ]);
    }

    public function atender(Request $request, Alerta $alerta): RedirectResponse
    {
        $alerta->update([
            'atendida' => true,
            'atendida_por' => $request->user()->id,
            'atendida_en' => Carbon::now(),
        ]);

        return back()->with('status', 'Alerta marcada como atendida.');
    }
}
