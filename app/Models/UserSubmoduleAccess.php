<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Submódulo concreto (ver config/modulos.php) que un usuario con
 * `modulos_personalizados = true` tiene habilitado explícitamente.
 * Si el usuario no está personalizado, esta tabla se ignora y su acceso se
 * deriva por completo de sus roles — ver App\Support\ModuleAccessRegistry.
 */
class UserSubmoduleAccess extends Model
{
    protected $table = 'user_submodule_access';

    protected $fillable = [
        'user_id',
        'module_slug',
        'submodule_key',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
