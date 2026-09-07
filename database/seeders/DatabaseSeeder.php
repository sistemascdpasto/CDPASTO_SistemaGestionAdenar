<?php

namespace Database\Seeders;

use App\Enums\Role as RoleEnum;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RoleSeeder::class);
        $this->call(GlossarySeeder::class);
        $this->call(GlosarioInviasSeeder::class);
        $this->call(WebScrapingSourceSeeder::class);
        $this->call(RecomendacionSeeder::class);

        $demoUsers = [
            ['id_number' => '1000000001', 'first' => 'Brian', 'last' => 'Administrador', 'role' => RoleEnum::Administrador],
            ['id_number' => '1000000002', 'first' => 'Samuel', 'last' => 'Seguridad', 'role' => RoleEnum::Seguridad],
            ['id_number' => '1000000003', 'first' => 'Rita', 'last' => 'Reparto', 'role' => RoleEnum::Reparto],
            ['id_number' => '1000000004', 'first' => 'Gina', 'last' => 'Gente', 'role' => RoleEnum::Gente],
            ['id_number' => '1000000005', 'first' => 'Felipe', 'last' => 'Flota', 'role' => RoleEnum::Flota],
            ['id_number' => '1000000006', 'first' => 'Carlos', 'last' => 'Colaborador', 'role' => RoleEnum::Colaborador],
        ];

        foreach ($demoUsers as $demo) {
            $user = User::where('identification_number', $demo['id_number'])->first();

            if (! $user) {
                $user = User::factory()->create([
                    'first_name' => $demo['first'],
                    'last_name' => $demo['last'],
                    'identification_number' => $demo['id_number'],
                    'email' => strtolower("{$demo['first']}@adenar.test"),
                    'password' => 'password',
                    'is_active' => true,
                ]);
            }

            if (! $user->hasRole($demo['role']->value)) {
                $user->assignRole($demo['role']->value);
            }

            if ($demo['role'] === RoleEnum::Colaborador) {
                Colaborador::firstOrCreate(
                    ['user_id' => $user->id],
                    [
                        'cedula' => $demo['id_number'],
                        'nombres' => $demo['first'],
                        'apellidos' => $demo['last'],
                        'cargo' => 'Conductor',
                        'turno' => 'manana',
                        'area' => 'Ruta Norte',
                        'is_active' => true,
                    ]
                );
            }
        }
    }
}
