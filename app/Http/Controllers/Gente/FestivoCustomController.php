<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\FestivoCustom;
use App\Services\FestivosColombiaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FestivoCustomController extends Controller
{
    /**
     * Retorna todos los festivos de un mes/año dado:
     * - Los festivos automáticos calculados por FestivosColombiaService
     * - Los festivos custom guardados en BD
     *
     * GET /modules/gente/festivos-custom?mes=8&anio=2026
     */
    public function index(Request $request, FestivosColombiaService $service): JsonResponse
    {
        $mes  = $request->integer('mes', (int) now()->month);
        $anio = $request->integer('anio', (int) now()->year);

        // Festivos custom guardados en BD para el mismo mes/año
        $customRaw = FestivoCustom::whereYear('fecha', $anio)
            ->whereMonth('fecha', $mes)
            ->orderBy('fecha')
            ->get();

        // Fechas con registro custom — tienen prioridad y ocultan el automático
        $fechasCustom = $customRaw->pluck('fecha')->map(fn ($f) => $f->format('Y-m-d'))->flip()->toArray();

        // Festivos automáticos del año (Colombia / Nariño / Pasto)
        // Se excluyen los que el usuario ya tiene registrados como custom
        $automaticos = collect($service->festivosDelAnio($anio))
            ->filter(fn ($nombre, $fecha) => (int) substr($fecha, 5, 2) === $mes)
            ->reject(fn ($nombre, $fecha) => isset($fechasCustom[$fecha]))
            ->map(fn ($nombre, $fecha) => [
                'fecha'      => $fecha,
                'nombre'     => $nombre,
                'tipo'       => 'automatico',
                'id'         => null,
            ])
            ->values();

        // Mapear los custom
        $custom = $customRaw->map(fn ($f) => [
            'fecha'  => $f->fecha->format('Y-m-d'),
            'nombre' => $f->nombre,
            'tipo'   => 'custom',
            'id'     => $f->id,
        ]);

        // Unir y ordenar por fecha — no puede haber duplicados
        $todos = $automaticos->merge($custom)->sortBy('fecha')->values();

        return response()->json([
            'festivos'  => $todos,
            'mes'       => $mes,
            'anio'      => $anio,
        ]);
    }

    /**
     * Agrega o elimina (toggle) un festivo custom para una fecha específica.
     * Si ya existe → lo elimina. Si no existe → lo crea.
     *
     * POST /modules/gente/festivos-custom/toggle
     * Body: { fecha: "2026-08-15", nombre: "Festivo personalizado" }
     */
    public function toggle(Request $request): JsonResponse
    {
        $request->validate([
            'fecha'  => ['required', 'date_format:Y-m-d'],
            'nombre' => ['nullable', 'string', 'max:120'],
        ]);

        $fecha   = $request->input('fecha');
        $nombre  = $request->input('nombre') ?: 'Festivo personalizado';
        $existente = FestivoCustom::where('fecha', $fecha)->first();

        if ($existente) {
            $existente->delete();
            return response()->json(['accion' => 'eliminado', 'fecha' => $fecha]);
        }

        $festivo = FestivoCustom::create([
            'fecha'  => $fecha,
            'nombre' => $nombre,
        ]);

        return response()->json([
            'accion'  => 'creado',
            'fecha'   => $fecha,
            'id'      => $festivo->id,
            'nombre'  => $festivo->nombre,
        ]);
    }
}
