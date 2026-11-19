<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\Cargo;
use App\Models\Gente\OpcionCatalogo;
use App\Models\Gente\PerfilCargo;
use App\Models\Gente\TipoDocumento;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ConfiguracionCatalogoController extends Controller
{
    public function index(): Response
    {
        // Tipos de documento
        $tiposDocumento = TipoDocumento::orderBy('es_personalizado')
            ->orderBy('nombre')
            ->get(['id', 'nombre', 'es_personalizado']);

        // Opciones de catálogo agrupadas por categoría
        $opcionesPorCategoria = [];
        foreach (OpcionCatalogoController::CATEGORIAS as $categoria => $etiqueta) {
            $opcionesPorCategoria[$categoria] = [
                'etiqueta' => $etiqueta,
                'opciones' => OpcionCatalogo::where('categoria', $categoria)
                    ->orderBy('es_personalizado')
                    ->orderBy('nombre')
                    ->get(['id', 'nombre', 'es_personalizado']),
            ];
        }

        // Cargos (tabla cargos — sincronizados desde GeoVictoria + manuales)
        $cargos = Cargo::orderBy('nombre')->get(['id', 'nombre', 'valor_cvd']);

        // Perfiles / funciones de cargo
        $perfilesCargos = PerfilCargo::orderBy('nombre')->get(['id', 'nombre', 'observaciones']);

        return Inertia::render('gente/configuracion-catalogo/index', [
            'tiposDocumento'       => $tiposDocumento,
            'opcionesPorCategoria' => $opcionesPorCategoria,
            'cargos'               => $cargos,
            'perfilesCargos'       => $perfilesCargos,
        ]);
    }
}
