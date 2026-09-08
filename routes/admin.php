<?php

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
    });
