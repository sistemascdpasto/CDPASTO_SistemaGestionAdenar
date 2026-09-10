<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('checklist_plan_premiacion', function (Blueprint $table) {
            // Default true = 100% (aprobado). Se pone en false manualmente para marcar 0%.
            $table->boolean('ausentismo_ok')->default(true)->after('cl_post');
        });
    }

    public function down(): void
    {
        Schema::table('checklist_plan_premiacion', function (Blueprint $table) {
            $table->dropColumn('ausentismo_ok');
        });
    }
};
