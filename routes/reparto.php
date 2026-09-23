<?php

use App\Http\Controllers\Reparto\AlertaVelocidadCurvaController;
use App\Http\Controllers\Reparto\ChecklistImportController;
use App\Http\Controllers\Reparto\CompensacionVariableController;
use App\Http\Controllers\Reparto\CompensacionVariableDiariaController;
use App\Http\Controllers\Reparto\EventosTripulacionController;
use App\Http\Controllers\Reparto\IndicadoresAdherenciaController;
use App\Http\Controllers\Reparto\IndicadoresController;
use App\Http\Controllers\Reparto\IndicadoresEntregaRangoController;
use App\Http\Controllers\Reparto\IndicadoresResumenController;
use App\Http\Controllers\Reparto\IndicadoresTiempoController;
use App\Http\Controllers\Reparto\MedicionTiempoInventarioController;
use App\Http\Controllers\Reparto\ModulacionController;
use App\Http\Controllers\Reparto\RevisionAleatoriaController;
use App\Http\Controllers\Reparto\RevisionCausalController;
use App\Http\Controllers\Reparto\RevisionResponsableController;
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

        // Compensación Variable — solo Administrador y Reparto
        Route::middleware('role:Administrador|Reparto')->group(function () {
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
        Route::get('/indicadores-adherencia', [IndicadoresAdherenciaController::class, 'index'])
            ->name('indicadores-adherencia.index');

        // Dashboard Adherencia al Tiempo
        Route::get('/indicadores-tiempo', [IndicadoresTiempoController::class, 'index'])
            ->name('indicadores-tiempo.index');

        // Dashboard Entrega en Rango
        Route::get('/indicadores-entrega-rango', [IndicadoresEntregaRangoController::class, 'index'])
            ->name('indicadores-entrega-rango.index');

        // Resumen Ejecutivo
        Route::get('/indicadores-resumen', [IndicadoresResumenController::class, 'index'])
            ->name('indicadores-resumen.index');

        // Checklist de Vehículos
        Route::get('/checklist/import', [ChecklistImportController::class, 'index'])
            ->name('checklist.import.index');
        Route::post('/checklist/import', [ChecklistImportController::class, 'store'])
            ->name('checklist.import.store');

        // Medición de Tiempos en Inventario de Vehículos de Distribución
        // Colaboradores: solo pueden registrar (crear) y finalizar su propio inventario del día.
        // Admin y Reparto: acceso completo.
        Route::middleware('role:Colaborador|Administrador|Reparto')->group(function () {
            Route::get('/medicion-tiempos-inventario/create', [MedicionTiempoInventarioController::class, 'create'])
                ->name('medicion-tiempos-inventario.create');
            Route::post('/medicion-tiempos-inventario', [MedicionTiempoInventarioController::class, 'store'])
                ->name('medicion-tiempos-inventario.store');
            // edit y update también accesibles por colaboradores para finalizar su propio inventario
            Route::get('/medicion-tiempos-inventario/{medicionTiempoInventario}/edit', [MedicionTiempoInventarioController::class, 'edit'])
                ->name('medicion-tiempos-inventario.edit');
            Route::put('/medicion-tiempos-inventario/{medicionTiempoInventario}', [MedicionTiempoInventarioController::class, 'update'])
                ->name('medicion-tiempos-inventario.update');
        });

        Route::middleware('role:Administrador|Reparto')->group(function () {
            Route::get('/medicion-tiempos-inventario', [MedicionTiempoInventarioController::class, 'index'])
                ->name('medicion-tiempos-inventario.index');
            Route::post('/medicion-tiempos-inventario/importar', [MedicionTiempoInventarioController::class, 'importar'])
                ->name('medicion-tiempos-inventario.importar');
            Route::get('/medicion-tiempos-inventario-exportar', [MedicionTiempoInventarioController::class, 'exportar'])
                ->name('medicion-tiempos-inventario.exportar');
            Route::get('/medicion-tiempos-inventario/{medicionTiempoInventario}', [MedicionTiempoInventarioController::class, 'show'])
                ->name('medicion-tiempos-inventario.show');
            Route::delete('/medicion-tiempos-inventario/{medicionTiempoInventario}', [MedicionTiempoInventarioController::class, 'destroy'])
                ->name('medicion-tiempos-inventario.destroy');
        });

        // Revisión Aleatoria de Vehículos / SKU
        Route::middleware('role:Administrador|Reparto')->group(function () {
            Route::get('/revision-aleatoria', [RevisionAleatoriaController::class, 'index'])
                ->name('revision-aleatoria.index');
            Route::post('/revision-aleatoria/seleccionar-vehiculo', [RevisionAleatoriaController::class, 'seleccionarVehiculo'])
                ->name('revision-aleatoria.seleccionar-vehiculo');
            Route::post('/revision-aleatoria/seleccionar-responsable', [RevisionAleatoriaController::class, 'seleccionarResponsable'])
                ->name('revision-aleatoria.seleccionar-responsable');
            Route::post('/revision-aleatoria/finalizar', [RevisionAleatoriaController::class, 'finalizar'])
                ->name('revision-aleatoria.finalizar');
            Route::get('/revision-aleatoria/historial', [RevisionAleatoriaController::class, 'historial'])
                ->name('revision-aleatoria.historial');
            Route::get('/revision-aleatoria/indicadores', [RevisionAleatoriaController::class, 'indicadores'])
                ->name('revision-aleatoria.indicadores');
            // Wildcard al final para no chocar con las rutas fijas de arriba.
            Route::get('/revision-aleatoria/{revisionAleatoria}', [RevisionAleatoriaController::class, 'show'])
                ->name('revision-aleatoria.show');
        });

        // Configuración de la Revisión Aleatoria — exclusivo de Administrador.
        Route::middleware('role:Administrador')->group(function () {
            Route::delete('/revision-aleatoria/{revisionAleatoria}', [RevisionAleatoriaController::class, 'destroy'])
                ->name('revision-aleatoria.destroy');

            Route::get('/revision-responsables', [RevisionResponsableController::class, 'index'])
                ->name('revision-responsables.index');
            Route::get('/revision-responsables/create', [RevisionResponsableController::class, 'create'])
                ->name('revision-responsables.create');
            Route::post('/revision-responsables', [RevisionResponsableController::class, 'store'])
                ->name('revision-responsables.store');
            Route::patch('/revision-responsables/{revisionResponsable}/toggle-activo', [RevisionResponsableController::class, 'toggleActivo'])
                ->name('revision-responsables.toggle-activo');
            Route::delete('/revision-responsables/{revisionResponsable}', [RevisionResponsableController::class, 'destroy'])
                ->name('revision-responsables.destroy');

            Route::get('/revision-causales', [RevisionCausalController::class, 'index'])
                ->name('revision-causales.index');
            Route::get('/revision-causales/create', [RevisionCausalController::class, 'create'])
                ->name('revision-causales.create');
            Route::post('/revision-causales', [RevisionCausalController::class, 'store'])
                ->name('revision-causales.store');
            Route::get('/revision-causales/{revisionCausal}/edit', [RevisionCausalController::class, 'edit'])
                ->name('revision-causales.edit');
            Route::put('/revision-causales/{revisionCausal}', [RevisionCausalController::class, 'update'])
                ->name('revision-causales.update');
            Route::patch('/revision-causales/{revisionCausal}/toggle-activo', [RevisionCausalController::class, 'toggleActivo'])
                ->name('revision-causales.toggle-activo');
            Route::delete('/revision-causales/{revisionCausal}', [RevisionCausalController::class, 'destroy'])
                ->name('revision-causales.destroy');
        });
    });
