<?php

use App\Http\Controllers\Flota\ActaTallerController;
use App\Http\Controllers\Flota\AnalisisCombustibleController;
use App\Http\Controllers\Flota\CarretaController;
use App\Http\Controllers\Flota\CombustibleVoucherController;
use App\Http\Controllers\Flota\DisponibilidadFlotaController;
use App\Http\Controllers\Flota\ExtintorController;
use App\Http\Controllers\Flota\OcupacionCargaController;
use App\Http\Controllers\Flota\SimitConsultaController;
use App\Http\Controllers\Flota\VaradaController;
use App\Http\Controllers\Flota\VehiculoController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'role:Administrador|Flota', 'submodule.access'])
    ->prefix('modules/flota')
    ->name('flota.')
    ->group(function () {
        // "destroy" se registra aparte con role:Administrador (ver abajo):
        // Flota puede ver/crear/editar/marcar disponibilidad, pero no eliminar.
        Route::resource('vehiculos', VehiculoController::class)
            ->parameters(['vehiculos' => 'vehiculo'])
            ->except(['destroy']);
        Route::patch('vehiculos/{vehiculo}/toggle-activo', [VehiculoController::class, 'toggleActivo'])
            ->name('vehiculos.toggle-activo');

        // ── Reporte de Disponibilidad de Flota (camiones + carretas) ────────────
        Route::get('disponibilidad', [DisponibilidadFlotaController::class, 'index'])
            ->name('disponibilidad.index');
        Route::get('disponibilidad/historico', [DisponibilidadFlotaController::class, 'historico'])
            ->name('disponibilidad.historico');
        Route::get('disponibilidad/exportar-excel', [DisponibilidadFlotaController::class, 'exportarExcel'])
            ->name('disponibilidad.exportar-excel');

        // ── Ocupación de Carga (peso de Planeación de ruta vs capacidad del vehículo) ──
        Route::get('ocupacion-carga', [OcupacionCargaController::class, 'index'])
            ->name('ocupacion-carga.index');

        // ── Análisis de Combustible (km MyGeotab + tanqueadas + rendimiento) ────
        Route::get('combustible', [AnalisisCombustibleController::class, 'index'])
            ->name('combustible.index');
        Route::post('combustible/sincronizar', [AnalisisCombustibleController::class, 'sincronizar'])
            ->name('combustible.sincronizar');
        Route::get('combustible/detalle-placa', [AnalisisCombustibleController::class, 'detallePlaca'])
            ->name('combustible.detalle-placa');
        Route::patch('combustible/vehiculos/{vehiculo}/meta', [AnalisisCombustibleController::class, 'actualizarMeta'])
            ->name('combustible.meta.update');
        Route::get('combustible/vouchers', [CombustibleVoucherController::class, 'index'])
            ->name('combustible.vouchers.index');
        Route::put('combustible/vouchers/{voucher}', [CombustibleVoucherController::class, 'update'])
            ->name('combustible.vouchers.update');
        Route::post('combustible/vouchers/{voucher}/reprocesar', [CombustibleVoucherController::class, 'reprocesar'])
            ->name('combustible.vouchers.reprocesar');

        // "destroy" se registra aparte con role:Administrador (ver abajo).
        Route::resource('carretas', CarretaController::class)
            ->parameters(['carretas' => 'carreta'])
            ->except(['destroy', 'show']);
        Route::patch('carretas/{carreta}/toggle-activo', [CarretaController::class, 'toggleActivo'])
            ->name('carretas.toggle-activo');

        // Solo lectura: los datos los genera la automatizacion SIMIT (ver
        // POST /api/simit/consultas), no se crean/editan desde la web.
        Route::get('simit-consultas', [SimitConsultaController::class, 'index'])->name('simit-consultas.index');
        Route::get('simit-consultas/{consulta}/screenshot', [SimitConsultaController::class, 'screenshot'])
            ->name('simit-consultas.screenshot');

        Route::get('varadas', [VaradaController::class, 'index'])->name('varadas.index');
        Route::post('varadas', [VaradaController::class, 'store'])->name('varadas.store');
        Route::put('varadas/{varada}', [VaradaController::class, 'update'])->name('varadas.update');
        Route::delete('varadas/{varada}', [VaradaController::class, 'destroy'])->name('varadas.destroy');
        Route::post('varadas/importar', [VaradaController::class, 'importar'])->name('varadas.importar');

        // ── Actas de Entrega a Taller ──────────────────────────────────────────
        Route::get('actas-taller/dashboard', [ActaTallerController::class, 'dashboard'])
            ->name('actas-taller.dashboard');
        Route::get('actas-taller/exportar/excel', [ActaTallerController::class, 'exportarExcel'])
            ->name('actas-taller.exportar-excel');
        Route::get('actas-taller/exportar/pdf', [ActaTallerController::class, 'exportarPdf'])
            ->name('actas-taller.exportar-pdf');
        Route::get('actas-taller', [ActaTallerController::class, 'index'])
            ->name('actas-taller.index');
        Route::get('actas-taller/create', [ActaTallerController::class, 'create'])
            ->name('actas-taller.create');
        Route::post('actas-taller', [ActaTallerController::class, 'store'])
            ->name('actas-taller.store');
        Route::get('actas-taller/{actasTaller}/exportar-pdf', [ActaTallerController::class, 'exportarActaPdf'])
            ->name('actas-taller.exportar-acta-pdf');
        Route::get('actas-taller/{actasTaller}', [ActaTallerController::class, 'show'])
            ->name('actas-taller.show');
        Route::put('actas-taller/{actasTaller}', [ActaTallerController::class, 'update'])
            ->name('actas-taller.update');
        Route::delete('actas-taller/{actasTaller}', [ActaTallerController::class, 'destroy'])
            ->name('actas-taller.destroy');

        // ── Extintores ─────────────────────────────────────────────────────────
        // Rutas estáticas ANTES del wildcard {extintor} para evitar colisiones
        Route::post('extintores/columnas', [ExtintorController::class, 'agregarColumna'])->name('extintores.columnas.store');
        Route::delete('extintores/columnas', [ExtintorController::class, 'eliminarColumna'])->name('extintores.columnas.destroy');
        Route::post('extintores/referencia-imagen', [ExtintorController::class, 'subirImagenReferencia'])->name('extintores.referencia-imagen');
        Route::delete('extintores/referencia-imagen', [ExtintorController::class, 'eliminarImagenReferencia'])->name('extintores.referencia-imagen.destroy');
        Route::get('extintores/exportar-tabla', [ExtintorController::class, 'exportarTabla'])->name('extintores.exportar-tabla');
        Route::get('extintores/ultima-firma-inspeccion', [ExtintorController::class, 'ultimaFirmaInspeccion'])->name('extintores.ultima-firma');

        Route::get('extintores', [ExtintorController::class, 'index'])->name('extintores.index');
        Route::post('extintores', [ExtintorController::class, 'store'])->name('extintores.store');
        Route::get('extintores/{extintor}', [ExtintorController::class, 'show'])->name('extintores.show');
        Route::put('extintores/{extintor}', [ExtintorController::class, 'update'])->name('extintores.update');
        Route::delete('extintores/{extintor}', [ExtintorController::class, 'destroy'])->name('extintores.destroy');
        Route::get('extintores/{extintor}/exportar-excel', [ExtintorController::class, 'exportarExcel'])->name('extintores.exportar-excel');
        Route::post('extintores/{extintor}/foto', [ExtintorController::class, 'subirFoto'])->name('extintores.foto.store');
        Route::delete('extintores/{extintor}/foto', [ExtintorController::class, 'eliminarFoto'])->name('extintores.foto.destroy');
        // Asignación a vehículo
        Route::post('extintores/{extintor}/asignar', [ExtintorController::class, 'asignarVehiculo'])->name('extintores.asignar');
        Route::put('extintores/{extintor}/asignaciones/{asignacion}', [ExtintorController::class, 'updateAsignacion'])->name('extintores.asignaciones.update');
        Route::delete('extintores/{extintor}/asignaciones/{asignacion}', [ExtintorController::class, 'destroyAsignacion'])->name('extintores.asignaciones.destroy');
        // Retiro de vehículo
        Route::post('extintores/{extintor}/retirar', [ExtintorController::class, 'retirarVehiculo'])->name('extintores.retirar');
        // Inspecciones (inicio y periódicas) con evidencias
        Route::post('extintores/{extintor}/inspecciones', [ExtintorController::class, 'storeInspeccion'])->name('extintores.inspecciones.store');
        Route::delete('extintores/{extintor}/inspecciones/{inspeccion}', [ExtintorController::class, 'destroyInspeccion'])->name('extintores.inspecciones.destroy');
    });

// Eliminar vehículos es exclusivo de Administrador; Flota conserva el resto
// de acciones sobre "Documentación" (ver grupo role:Administrador|Flota arriba).
Route::middleware(['auth', 'active', 'role:Administrador', 'submodule.access'])
    ->prefix('modules/flota')
    ->name('flota.')
    ->group(function () {
        Route::delete('vehiculos/{vehiculo}', [VehiculoController::class, 'destroy'])
            ->name('vehiculos.destroy');
        Route::delete('carretas/{carreta}', [CarretaController::class, 'destroy'])
            ->name('carretas.destroy');
    });
