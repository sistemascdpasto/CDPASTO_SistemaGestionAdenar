<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('dpo_academy', function (Blueprint $table) {
            $table->unsignedTinyInteger('mes')->nullable()->after('colaborador_id')->index();
            $table->unsignedSmallInteger('anio')->nullable()->after('mes')->index();
            $table->index(['mes', 'anio']);
        });

        $isSqlite = DB::connection()->getDriverName() === 'sqlite';
        if ($isSqlite) {
            DB::statement("UPDATE dpo_academy SET mes = CAST(strftime('%m', created_at) AS INTEGER), anio = CAST(strftime('%Y', created_at) AS INTEGER) WHERE mes IS NULL");
        } else {
            DB::statement("UPDATE dpo_academy SET mes = MONTH(created_at), anio = YEAR(created_at) WHERE mes IS NULL");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dpo_academy', function (Blueprint $table) {
            $table->dropIndex(['mes', 'anio']);
            $table->dropColumn(['mes', 'anio']);
        });
    }
};

