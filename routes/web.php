<?php

use App\Http\Controllers\ChatbotController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Gente\SeguimientoPruebasController;
use App\Http\Controllers\NotificacionesController;
use App\Http\Controllers\Reparto\CompensacionVariableController;
use App\Http\Controllers\Reparto\ModulacionController;
use App\Http\Controllers\Seguridad\RutaCriticaController;
use App\Services\Seguridad\RutasCriticasDatosAbiertosService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

require __DIR__.'/seguridad.php';
require __DIR__.'/colaborador.php';
require __DIR__.'/flota.php';
require __DIR__.'/capacitaciones.php';
require __DIR__.'/reparto.php';
require __DIR__.'/gente.php';
require __DIR__.'/cinco-porques.php';

Route::middleware(['auth', 'active'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Chatbot interno (Groq): disponible para todos los roles autenticados,
    // no requiere el middleware module.access porque no pertenece a un solo
    // pilar — se monta como widget flotante en AppSidebarLayout.
    Route::post('chatbot/mensaje', [ChatbotController::class, 'send'])
        ->middleware('throttle:20,1')
        ->name('chatbot.send');

    // Campana de notificaciones del header: feed unificado por rol.
    Route::get('notificaciones', [NotificacionesController::class, 'index'])->name('notificaciones.index');

    Route::middleware('module.access')->group(function () {
        Route::get('modules/{module}', function (string $module) {
            return Inertia::render('modules/show', ['module' => $module]);
        })->whereIn('module', ['seguridad', 'reparto', 'gente', 'flota'])->name('modules.show');

        Route::get('modules/{module}/{submodule}', function (string $module, string $submodule, Request $request) {
            if ($module === 'seguridad' && $submodule === 'rutas-criticas') {
                return (new RutaCriticaController)->index(
                    app(RutasCriticasDatosAbiertosService::class)
                );
            }
            if ($module === 'reparto' && $submodule === 'compensacion-variable') {
                return (new CompensacionVariableController)->index($request);
            }
            if ($module === 'reparto' && $submodule === 'modulacion') {
                return (new ModulacionController)->index($request);
            }
            if ($module === 'gente' && ($submodule === 'plan-padrinos' || $submodule === 'seguimiento-pruebas')) {
                return (new SeguimientoPruebasController)->index($request);
            }

            return Inertia::render('modules/submodule', ['module' => $module, 'submodule' => $submodule]);
        })->whereIn('module', ['seguridad', 'reparto', 'gente', 'flota'])->name('modules.submodule');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
require __DIR__.'/admin.php';
