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

// `glossary:scrape` NO se programa: invias.gov.co bloquea por IP los
// datacenters extranjeros (Railway está en NL → HTTP 403). El glosario se
// scrapea desde una IP colombiana y se versiona en
// database/data/glosario_invias.json (ver GlosarioInviasSeeder).
