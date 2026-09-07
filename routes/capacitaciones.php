<?php

use App\Http\Controllers\Capacitaciones\CarpetaController;
use App\Http\Controllers\Capacitaciones\MaterialController;
use Illuminate\Support\Facades\Route;

// Capacitaciones es un recurso transversal: accesible a todos los pilares
// (aparece como submódulo dentro de cada sección del sidebar).
Route::middleware(['auth', 'active', 'role:Administrador|Seguridad|Reparto|Gente|Flota'])
    ->prefix('modules/capacitaciones')
    ->name('capacitaciones.')
    ->group(function () {
        // Explorador principal de carpetas
        Route::get('/', [CarpetaController::class, 'index'])->name('index');
        Route::post('carpetas', [CarpetaController::class, 'store'])->name('carpetas.store');
        Route::get('carpetas/{carpeta}', [CarpetaController::class, 'show'])->name('carpetas.show');
        Route::match(['put', 'post'], 'carpetas/{carpeta}', [CarpetaController::class, 'update'])->name('carpetas.update');
        Route::delete('carpetas/{carpeta}', [CarpetaController::class, 'destroy'])->name('carpetas.destroy');

        // Materiales dentro de una carpeta
        Route::post('carpetas/{carpeta}/materiales', [MaterialController::class, 'store'])->name('materiales.store');
        Route::match(['put', 'post'], 'materiales/{material}', [MaterialController::class, 'update'])->name('materiales.update');
        Route::delete('materiales/{material}', [MaterialController::class, 'destroy'])->name('materiales.destroy');
        Route::get('materiales/{material}/descargar', [MaterialController::class, 'descargar'])->name('materiales.descargar');
    });
