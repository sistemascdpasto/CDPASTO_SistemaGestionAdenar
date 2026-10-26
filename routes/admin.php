<?php

use App\Http\Controllers\Admin\MygeotabCredentialController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'role:Administrador'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        // Sin 'destroy': los usuarios no se eliminan, solo se desactivan
        // (users.toggle-status).
        Route::resource('users', UserController::class)->except(['show', 'destroy']);
        Route::patch('users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset-password');
        Route::patch('users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->name('users.toggle-status');

        // Credenciales de MyGeotab (rotan periódicamente, ver
        // App\Support\MygeotabCredentials): se editan aquí en vez de en .env
        // para no depender de un redeploy cada vez que cambian.
        Route::get('mygeotab-credenciales', [MygeotabCredentialController::class, 'edit'])->name('mygeotab-credenciales.edit');
        Route::put('mygeotab-credenciales', [MygeotabCredentialController::class, 'update'])->name('mygeotab-credenciales.update');
        Route::post('mygeotab-credenciales/probar', [MygeotabCredentialController::class, 'probar'])->name('mygeotab-credenciales.probar');
    });
