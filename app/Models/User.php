<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\Capacitaciones\CapacitacionRevision;
use App\Models\Seguridad\Colaborador;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasRoles, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'first_name',
        'last_name',
        'identification_number',
        'email',
        'password',
        'is_active',
        'modulos_personalizados',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'roles',
        'permissions',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'modulos_personalizados' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (User $user) {
            if ($user->isDirty(['first_name', 'last_name'])) {
                $user->name = trim("{$user->first_name} {$user->last_name}");
            }
        });

        // Activar o desactivar un usuario en Gestión de usuarios se refleja en su colaborador
        // (el sentido contrario lo hace el módulo de colaboradores al cambiar su estado).
        static::updated(function (User $user) {
            if (! $user->wasChanged('is_active')) {
                return;
            }

            $colaborador = $user->colaborador()->first();

            if ($colaborador && $colaborador->is_active !== $user->is_active) {
                $colaborador->update(['is_active' => $user->is_active]);
            }
        });
    }

    public function colaborador(): HasOne
    {
        return $this->hasOne(Colaborador::class);
    }

    public function submoduleAccess(): HasMany
    {
        return $this->hasMany(UserSubmoduleAccess::class);
    }

    public function capacitacionRevisiones(): HasMany
    {
        return $this->hasMany(CapacitacionRevision::class);
    }
}
