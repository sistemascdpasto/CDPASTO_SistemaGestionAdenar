<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('colaboradores', function (Blueprint $table) {
            // Información personal
            $table->string('nombre_pareja')->nullable()->after('estado_civil_otro');
            $table->json('hijos')->nullable()->after('nombre_pareja'); // [{nombre, edad}]

            // Contactos de emergencia
            $table->string('emergencia_parentezco_1')->nullable()->after('hijos');
            $table->string('emergencia_nombre_1')->nullable()->after('emergencia_parentezco_1');
            $table->string('emergencia_telefono_1', 20)->nullable()->after('emergencia_nombre_1');
            $table->string('emergencia_parentezco_2')->nullable()->after('emergencia_telefono_1');
            $table->string('emergencia_nombre_2')->nullable()->after('emergencia_parentezco_2');
            $table->string('emergencia_telefono_2', 20)->nullable()->after('emergencia_nombre_2');
        });
    }

    public function down(): void
    {
        Schema::table('colaboradores', function (Blueprint $table) {
            $table->dropColumn([
                'nombre_pareja',
                'hijos',
                'emergencia_parentezco_1',
                'emergencia_nombre_1',
                'emergencia_telefono_1',
                'emergencia_parentezco_2',
                'emergencia_nombre_2',
                'emergencia_telefono_2',
            ]);
        });
    }
};
