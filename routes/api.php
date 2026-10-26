<?php

use App\Http\Controllers\Api\GeovictoriaAsistenciaController;
use App\Http\Controllers\Api\MygeotabSyncController;
use App\Http\Controllers\Api\SimitConsultaController;
use Illuminate\Support\Facades\Route;

// Ingesta del monitor SIMIT (script Python en la PC local). Protegida por
// token compartido (EnsureSimitApiToken), no por sesion/roles.
Route::post('simit/consultas', [SimitConsultaController::class, 'store'])
    ->middleware('simit.token')
    ->name('api.simit.consultas.store');

// Ingesta de la automatizacion GeoVictoria (script Python en la PC local).
// Protegida por token compartido (EnsureGeovictoriaApiToken), no por
// sesion/roles.
Route::post('geovictoria/asistencias', [GeovictoriaAsistenciaController::class, 'store'])
    ->middleware('geovictoria.token')
    ->name('api.geovictoria.asistencias.store');

// Sincronización diaria de kilómetros por vehículo (MyGeotab), disparada por
// una tarea programada en la PC local (no un usuario). Protegida por token
// compartido (EnsureMygeotabApiToken), no por sesion/roles.
Route::post('mygeotab/sincronizar-km', [MygeotabSyncController::class, 'store'])
    ->middleware('mygeotab.token')
    ->name('api.mygeotab.sincronizar-km');
