<?php

use App\Http\Controllers\Colaborador\CompensacionColaboradorController;
use App\Http\Controllers\Colaborador\CondicionSaludController;
use App\Http\Controllers\Colaborador\EncuestaMorbilidadController;
use App\Http\Controllers\Colaborador\PortalController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'role:Colaborador|Administrador|Seguridad'])
    ->prefix('portal')
    ->name('portal.')
    ->group(function () {
        Route::get('/', [PortalController::class, 'index'])->name('index');
        Route::get('perfil', [PortalController::class, 'perfil'])->name('perfil');
        Route::get('pruebas', [PortalController::class, 'pruebas'])->name('pruebas');
        Route::get('rutas', [PortalController::class, 'rutas'])->name('rutas');
        Route::get('mis-rutas-reparto', [PortalController::class, 'misRutasReparto'])->name('mis-rutas-reparto');
        Route::get('mis-indicadores-reparto', [PortalController::class, 'misIndicadoresReparto'])->name('mis-indicadores-reparto');
        Route::get('mi-plan-premiacion', [PortalController::class, 'miPlanPremiacion'])->name('mi-plan-premiacion');
        Route::get('alertas', [PortalController::class, 'alertas'])->name('alertas');
        Route::get('condicion-salud', [CondicionSaludController::class, 'create'])->name('condicion-salud');
        Route::post('condicion-salud', [CondicionSaludController::class, 'store'])->name('condicion-salud.store');
        Route::get('condicion-salud/historial', [CondicionSaludController::class, 'historial'])->name('condicion-salud.historial');

        Route::get('encuesta-morbilidad', [EncuestaMorbilidadController::class, 'create'])->name('encuesta-morbilidad');
        Route::post('encuesta-morbilidad/{encuestaMorbilidad}/guardar', [EncuestaMorbilidadController::class, 'guardar'])
            ->name('encuesta-morbilidad.guardar');
        Route::post('encuesta-morbilidad/{encuestaMorbilidad}/enviar', [EncuestaMorbilidadController::class, 'store'])
            ->name('encuesta-morbilidad.enviar');
        Route::get('encuesta-morbilidad/historial', [EncuestaMorbilidadController::class, 'historial'])
            ->name('encuesta-morbilidad.historial');
        // Capacitaciones para colaboradores
        Route::get('capacitaciones', [\App\Http\Controllers\Colaborador\CapacitacionController::class, 'index'])
            ->name('capacitaciones.index');
        Route::get('capacitaciones/carpetas/{carpeta}', [\App\Http\Controllers\Colaborador\CapacitacionController::class, 'showCarpeta'])
            ->name('capacitaciones.carpetas.show');
        Route::post('capacitaciones/materiales/{material}/marcar-revisada', [\App\Http\Controllers\Colaborador\CapacitacionController::class, 'marcarRevisada'])
            ->name('capacitaciones.materiales.marcar-revisada');
        Route::get('capacitaciones/materiales/{material}/descargar', [\App\Http\Controllers\Colaborador\CapacitacionController::class, 'descargar'])
            ->name('capacitaciones.materiales.descargar');
        
        Route::get('mi-compensacion', [CompensacionColaboradorController::class, 'index'])
            ->name('mi-compensacion.index');
    });
