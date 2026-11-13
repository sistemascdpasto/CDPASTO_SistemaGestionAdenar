<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('colaborador_contratos')) {
            Schema::table('colaborador_contratos', function (Blueprint $table) {
                if (! Schema::hasColumn('colaborador_contratos', 'cargo')) {
                    $table->string('cargo', 100)->nullable()->after('tipo_contrato_otro');
                }
                if (! Schema::hasColumn('colaborador_contratos', 'area')) {
                    $table->string('area', 100)->nullable()->after('cargo');
                }
            });
        }

        if (Schema::hasTable('colaborador_cargos')) {
            Schema::table('colaborador_cargos', function (Blueprint $table) {
                if (! Schema::hasColumn('colaborador_cargos', 'area')) {
                    $table->string('area', 100)->nullable()->after('cargo');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('colaborador_contratos')) {
            Schema::table('colaborador_contratos', function (Blueprint $table) {
                $table->dropColumn(['cargo', 'area']);
            });
        }

        if (Schema::hasTable('colaborador_cargos')) {
            Schema::table('colaborador_cargos', function (Blueprint $table) {
                $table->dropColumn(['area']);
            });
        }
    }
};
