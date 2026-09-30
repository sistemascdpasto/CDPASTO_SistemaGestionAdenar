<?php

namespace App\Http\Controllers\Seguridad;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class RutogramasController extends Controller
{
    public function index(?string $vista = null): Response
    {
        $vistas = [
            null => 'rutas',
            'criticidad' => 'criticidad',
            'conductores' => 'conductores',
            'mapa-calor' => 'mapa',
        ];

        abort_unless(array_key_exists($vista, $vistas), 404);

        return Inertia::render('seguridad/rutogramas/index', [
            'vista' => $vistas[$vista],
        ]);
    }
}
