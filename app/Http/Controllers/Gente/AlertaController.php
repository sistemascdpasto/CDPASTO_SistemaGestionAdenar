<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Seguridad\Alerta;
use App\Support\AlertasPorPilar;
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

        return Inertia::render('gente/alertas/index', [
            'alertas' => AlertasPorPilar::paginar('gente', $request->user(), $estado),
            'filters' => ['estado' => $estado],
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

    public function destroy(Alerta $alerta): RedirectResponse
    {
        $alerta->delete();

        return back()->with('status', 'Alerta eliminada.');
    }
}
