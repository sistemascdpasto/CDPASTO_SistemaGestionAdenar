<?php

namespace App\Http\Controllers\Capacitaciones;

use App\Http\Controllers\Controller;
use App\Models\Capacitaciones\CapacitacionPortalConfig;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PortalConfigController extends Controller
{
    /**
     * Guarda el título, subtítulo e imagen de fondo del hero del portal
     * de capacitaciones. Solo un registro existe (id = 1); se usa updateOrCreate.
     */
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'titulo_hero' => ['required', 'string', 'max:255'],
            'subtitulo_hero' => ['nullable', 'string', 'max:500'],
            'imagen_hero' => ['nullable', 'image', 'max:10240'],
        ]);

        $config = CapacitacionPortalConfig::obtener();

        $imagenPath = $config->imagen_hero_path;

        if ($request->hasFile('imagen_hero') && $request->file('imagen_hero')->isValid()) {
            // Eliminar imagen anterior si existe
            if ($imagenPath && Storage::disk('public')->exists($imagenPath)) {
                Storage::disk('public')->delete($imagenPath);
            }
            $file = $request->file('imagen_hero');
            $safeName = time().'_hero_'.preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $file->getClientOriginalName());
            $imagenPath = $file->storeAs('capacitaciones/hero', $safeName, 'public');
        }

        $config->update([
            'titulo_hero' => $data['titulo_hero'],
            'subtitulo_hero' => $data['subtitulo_hero'] ?? null,
            'imagen_hero_path' => $imagenPath,
        ]);

        return back()->with('status', ['type' => 'success', 'message' => 'Configuración del portal actualizada correctamente.']);
    }
}
