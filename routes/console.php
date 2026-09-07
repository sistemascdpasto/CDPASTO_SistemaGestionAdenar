<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('seguridad:revisar-calibraciones')->daily();
Schedule::command('seguridad:revisar-vencimiento-contratos')->daily();
Schedule::command('flota:revisar-vencimiento-documentos')->dailyAt('07:00');
Schedule::command('seguridad:recordatorios-pruebas')->hourly();
Schedule::command('gente:notificar-pruebas-periodo')->dailyAt('07:00');
Schedule::command('glossary:scrape')->daily()->withoutOverlapping();
