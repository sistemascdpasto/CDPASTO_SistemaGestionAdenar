<?php

namespace App\Http\Controllers\Gente;

use App\Http\Controllers\Controller;
use App\Models\Gente\OpcionCatalogo;
use App\Models\Seguridad\Colaborador;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class OpcionCatalogoController extends Controller
{
    /**
     * Categorías gestionables y su etiqueta visible.
     */
    public const CATEGORIAS = [
        'eps'           => 'EPS',
        'afp'           => 'AFP',
        'arl'           => 'ARL',
        'estado_civil'  => 'Estado civil',
        'tipo_contrato' => 'Tipo de contrato',
        'area'          => 'Área / Dependencia',
        'centro'        => 'Centro',
        'centro_trabajo' => 'Centro de trabajo',
        'cargo_anterior' => 'Cargo anterior',
    ];

    /**
     * Columnas del colaborador que usan cada categoría
     * (para validar si una opción está en uso antes de eliminar).
     */
    private const COLUMNAS_EN_USO = [
        'eps'            => 'eps',
        'afp'            => 'afp',
        'arl'            => 'arl',
        'estado_civil'   => 'estado_civil',
        'tipo_contrato'  => 'tipo_contrato',
        'area'           => 'area',
        'centro'         => 'centro',
        'centro_trabajo' => 'centro_trabajo',
        'cargo_anterior' => 'cargo_anterior',
    ];

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'categoria' => ['required', 'string', 'in:' . implode(',', array_keys(self::CATEGORIAS))],
            'nombre'    => ['required', 'string', 'max:100'],
        ]);

        OpcionCatalogo::firstOrCreate(
            ['categoria' => $request->categoria, 'nombre' => trim($request->nombre)],
            ['es_personalizado' => true],
        );

        return back()->with('status', 'Opción agregada correctamente.');
    }

    public function update(Request $request, OpcionCatalogo $opcionCatalogo): RedirectResponse
    {
        $request->validate([
            'nombre' => ['required', 'string', 'max:100'],
        ]);

        $nuevoNombre = trim($request->nombre);
        $nombreAnterior = $opcionCatalogo->nombre;

        $opcionCatalogo->update(['nombre' => $nuevoNombre]);

        // Actualizar la columna de colaboradores que referencie el nombre anterior
        $columna = self::COLUMNAS_EN_USO[$opcionCatalogo->categoria] ?? null;
        if ($columna) {
            Colaborador::where($columna, $nombreAnterior)
                ->update([$columna => $nuevoNombre]);
        }

        return back()->with('status', 'Opción actualizada correctamente.');
    }

    public function destroy(OpcionCatalogo $opcionCatalogo): RedirectResponse
    {
        $columna = self::COLUMNAS_EN_USO[$opcionCatalogo->categoria] ?? null;

        if ($columna) {
            $enUso = Colaborador::where($columna, $opcionCatalogo->nombre)->exists();

            if ($enUso) {
                // Deja el campo vacío en los colaboradores que la tenían
                Colaborador::where($columna, $opcionCatalogo->nombre)
                    ->update([$columna => null]);
            }
        }

        $opcionCatalogo->delete();

        return back()->with('status', 'Opción eliminada. Los colaboradores que la usaban quedaron con ese campo vacío.');
    }
}
