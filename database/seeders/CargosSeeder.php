<?php

namespace Database\Seeders;

use App\Models\Gente\Cargo;
use Illuminate\Database\Seeder;

class CargosSeeder extends Seeder
{
    public function run(): void
    {
        $cargos = [
            [
                'nombre' => 'GERENTE GENERAL',
                'perfil' => implode("\n", [
                    '1.1 Dirigir las actividades financieras.',
                    '1.2 Ejecutar acciones que contribuyan al crecimiento de la empresa, teniendo como base la transparencia del desarrollo de los procesos necesarios para dicho fin.',
                    '1.3 Planear, Coordinar y Controlar la documentación necesaria de operación de la empresa cuando lo exijan las entidades del gobierno para que ésta no tenga inconvenientes legales.',
                    '1.4 Supervisar el trabajo del personal que está a su cargo para que las actividades se desarrollen de acuerdo a lo planeado.',
                    '1.5 Presentar informes de gestión y planes de acción.',
                    '1.6 Ejecutar plan de trabajo para cumplimiento de la totalidad e indicadores y metas.',
                ]),
            ],
            [
                'nombre' => 'JEFE DE OPERACIONES',
                'perfil' => implode("\n", [
                    '2.1 Llevar a la empresa a alcanzar los objetivos trazados, utilizando como medio el trabajo en equipo de nuestro recurso humano.',
                    '2.2 Garantizar la ejecución de entrega del 100% de las rutas diarias (a tiempo y completo).',
                ]),
            ],
        ];

        foreach ($cargos as $cargo) {
            Cargo::updateOrCreate(
                ['nombre' => $cargo['nombre']],
                ['perfil'  => $cargo['perfil']],
            );
        }
    }
}
