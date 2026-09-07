<?php

use App\Http\Controllers\Reparto\AlertaVelocidadCurvaController;
use App\Http\Controllers\Reparto\ChecklistImportController;
use App\Http\Controllers\Reparto\CompensacionVariableController;
use App\Http\Controllers\Reparto\CompensacionVariableDiariaController;
use App\Http\Controllers\Reparto\EventosTripulacionController;
use App\Http\Controllers\Reparto\IndicadoresController;
use App\Http\Controllers\Reparto\ModulacionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active'])
    ->prefix('modules/reparto')
    ->name('reparto.')
    ->group(function () {
        // Modulación
        Route::get('/modulacion', [ModulacionController::class, 'index'])
            ->name('modulacion.index');
        Route::get('/modulacion/check-fecha', [ModulacionController::class, 'checkFecha'])
            ->name('modulacion.checkFecha');
        Route::get('/modulacion/historial', [ModulacionController::class, 'historial'])
            ->name('modulacion.historial');
        Route::get('/modulacion-historial', [ModulacionController::class, 'historial'])
            ->name('modulacion.historial.sidebar');
        Route::post('/modulacion/header', [ModulacionController::class, 'saveHeader'])
            ->name('modulacion.saveHeader');
        Route::post('/modulacion/batch', [ModulacionController::class, 'storeBatch'])
            ->name('modulacion.storeBatch');
        Route::put('/modulacion/item/{id}', [ModulacionController::class, 'updateItem'])
            ->name('modulacion.updateItem');
        Route::delete('/modulacion/item/{id}', [ModulacionController::class, 'destroyItem'])
            ->name('modulacion.destroyItem');
        Route::delete('/modulacion/{id}', [ModulacionController::class, 'destroyModulacion'])
            ->name('modulacion.destroy');
        Route::put('/modulacion/novedad/{id}', [ModulacionController::class, 'updateNovedad'])
            ->name('modulacion.updateNovedad');
        Route::post('/modulacion/novedad', [ModulacionController::class, 'storeNovedad'])
            ->name('modulacion.storeNovedad');
        Route::delete('/modulacion/novedad/{id}', [ModulacionController::class, 'destroyNovedad'])
            ->name('modulacion.destroyNovedad');

        // Compensación Variable — solo Administrador y Colaborador
        Route::middleware('role:Administrador|Colaborador')->group(function () {
            Route::get('/compensacion-variable', [CompensacionVariableController::class, 'index'])
                ->name('compensacion-variable.index');

            Route::post('/compensacion-variable/importar', [CompensacionVariableController::class, 'importar'])
                ->name('compensacion-variable.importar');

            Route::get('/compensacion-variable/{identificador}/detalle', [CompensacionVariableController::class, 'detalle'])
                ->name('compensacion-variable.detalle');

            Route::post('/compensacion-variable/limpiar', [CompensacionVariableController::class, 'limpiar'])
                ->name('compensacion-variable.limpiar');

            Route::get('/compensacion-variable-exportar', [CompensacionVariableController::class, 'exportar'])
                ->name('compensacion-variable.exportar');
        });

        // Compensación Variable Diaria
        Route::get('/compensacion-variable-diaria', [CompensacionVariableDiariaController::class, 'index'])
            ->name('compensacion-variable-diaria.index');

        // Calcular desde Eventos de Tripulación (reemplaza la importación de Excel)
        Route::post('/compensacion-variable-diaria/calcular', [CompensacionVariableDiariaController::class, 'importar'])
            ->name('compensacion-variable-diaria.calcular');

        Route::get('/compensacion-variable-diaria/{id}/detalle', [CompensacionVariableDiariaController::class, 'detalle'])
            ->name('compensacion-variable-diaria.detalle');

        Route::post('/compensacion-variable-diaria/limpiar', [CompensacionVariableDiariaController::class, 'limpiar'])
            ->name('compensacion-variable-diaria.limpiar');

        Route::get('/compensacion-variable-diaria-exportar', [CompensacionVariableDiariaController::class, 'exportar'])
            ->name('compensacion-variable-diaria.exportar');

        // Alertas de Velocidad en Curva
        Route::get('/alertas-velocidad-curva', [AlertaVelocidadCurvaController::class, 'index'])
            ->name('alertas-velocidad-curva.index');
        Route::get('/alertas-velocidad-curva/descargar-plantilla', [AlertaVelocidadCurvaController::class, 'downloadTemplate'])
            ->name('alertas-velocidad-curva.template');
        Route::post('/alertas-velocidad-curva/importar', [AlertaVelocidadCurvaController::class, 'store'])
            ->name('alertas-velocidad-curva.store');
        Route::post('/alertas-velocidad-curva/crear', [AlertaVelocidadCurvaController::class, 'storeManual'])
            ->name('alertas-velocidad-curva.storeManual');
        Route::put('/alertas-velocidad-curva/{id}', [AlertaVelocidadCurvaController::class, 'updateAlerta'])
            ->name('alertas-velocidad-curva.update');
        Route::delete('/alertas-velocidad-curva/{id}', [AlertaVelocidadCurvaController::class, 'deleteAlerta'])
            ->name('alertas-velocidad-curva.delete');

        // Eventos de Tripulación
        Route::get('/eventos-tripulacion', [EventosTripulacionController::class, 'index'])
            ->name('eventos-tripulacion.index');
        Route::post('/eventos-tripulacion/actualizar', [EventosTripulacionController::class, 'refresh'])
            ->name('eventos-tripulacion.refresh');
        Route::post('/eventos-tripulacion/importar', [EventosTripulacionController::class, 'store'])
            ->name('eventos-tripulacion.store');
        Route::get('/eventos-tripulacion/descargar-plantilla', [EventosTripulacionController::class, 'downloadTemplate'])
            ->name('eventos-tripulacion.template');

        // Indicadores de Velocidad
        Route::get('/indicadores', [IndicadoresController::class, 'index'])
            ->name('indicadores.index');

        // Indicadores de Adherencia Checklist
        Route::get('/indicadores-adherencia', [\App\Http\Controllers\Reparto\IndicadoresAdherenciaController::class, 'index'])
            ->name('indicadores-adherencia.index');

        // Dashboard Adherencia al Tiempo
        Route::get('/indicadores-tiempo', [\App\Http\Controllers\Reparto\IndicadoresTiempoController::class, 'index'])
            ->name('indicadores-tiempo.index');

        // Dashboard Entrega en Rango
        Route::get('/indicadores-entrega-rango', [\App\Http\Controllers\Reparto\IndicadoresEntregaRangoController::class, 'index'])
            ->name('indicadores-entrega-rango.index');

        // Resumen Ejecutivo
        Route::get('/indicadores-resumen', [\App\Http\Controllers\Reparto\IndicadoresResumenController::class, 'index'])
            ->name('indicadores-resumen.index');

        // Checklist de Vehículos
        Route::get('/checklist/import', [ChecklistImportController::class, 'index'])
            ->name('checklist.import.index');
        Route::post('/checklist/import', [ChecklistImportController::class, 'store'])
            ->name('checklist.import.store');
    });

