<?php

use App\Http\Controllers\Reparto\CincoPorqueController;
use Illuminate\Support\Facades\Route;

// Módulo "5 Por Qué" (análisis de causa raíz). Lo diligencian los roles
// Colaborador y Reparto; Reparto y Administrador además ven el historial de
// todos los colaboradores (Colaborador solo ve el suyo) y el dashboard de
// indicadores (Colaborador no lo ve, por eso va en un grupo aparte).
Route::middleware(['auth', 'active', 'role:Colaborador|Reparto|Administrador'])
    ->prefix('cinco-porques')
    ->name('cinco-porques.')
    ->group(function () {
        Route::get('/', [CincoPorqueController::class, 'create'])->name('create');
        Route::post('/', [CincoPorqueController::class, 'store'])->name('store');
        Route::get('historial', [CincoPorqueController::class, 'historial'])->name('historial');

        Route::post('ia/analizar', [CincoPorqueController::class, 'analizarIa'])
            ->middleware('throttle:30,1')
            ->name('ia.analizar');
    });

// Registrado antes del wildcard {cincoPorque} de abajo para que "indicadores"
// no sea interpretado como un id de registro.
Route::middleware(['auth', 'active', 'role:Reparto|Administrador'])
    ->prefix('cinco-porques')
    ->name('cinco-porques.')
    ->group(function () {
        Route::get('indicadores', [CincoPorqueController::class, 'indicadores'])->name('indicadores');
    });

Route::middleware(['auth', 'active', 'role:Colaborador|Reparto|Administrador'])
    ->prefix('cinco-porques')
    ->name('cinco-porques.')
    ->group(function () {
        Route::get('{cincoPorque}', [CincoPorqueController::class, 'show'])->name('show');
    });
