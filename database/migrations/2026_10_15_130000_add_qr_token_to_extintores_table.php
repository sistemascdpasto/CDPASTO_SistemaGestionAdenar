<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('extintores', function (Blueprint $table) {
            $table->string('qr_token', 64)->nullable()->unique()->after('numero_serie');
        });

        // Generar token para extintores existentes
        \DB::table('extintores')->whereNull('qr_token')->get()->each(function ($e) {
            \DB::table('extintores')
                ->where('id', $e->id)
                ->update(['qr_token' => Str::random(32)]);
        });
    }

    public function down(): void
    {
        Schema::table('extintores', function (Blueprint $table) {
            $table->dropColumn('qr_token');
        });
    }
};
