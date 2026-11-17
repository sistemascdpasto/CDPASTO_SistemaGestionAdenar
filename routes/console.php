<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('seguridad:revisar-calibraciones')->daily();
// Vencimiento de contratos (Gente / Contratos):
// 07:00: Correo agrupado a Administrador + usuarios con rol Contratos
// 12:00: Ídem, solo a quienes tienen alertas_contratos_tres_veces_dia = true
// 17:00: Ídem, solo a quienes tienen alertas_contratos_tres_veces_dia = true
// Solo se incluyen colaboradores cuya alerta retiro_proximo esté pendiente (atendida = false).
Schedule::command('seguridad:revisar-vencimiento-contratos')->dailyAt('07:00');
Schedule::command('seguridad:revisar-vencimiento-contratos --solo-frecuentes')->dailyAt('12:00');
Schedule::command('seguridad:revisar-vencimiento-contratos --solo-frecuentes')->dailyAt('17:00');
Schedule::command('flota:revisar-vencimiento-documentos')->dailyAt('07:00');
Schedule::command('seguridad:recordatorios-pruebas')->hourly();
Schedule::command('gente:notificar-pruebas-periodo')->dailyAt('07:00');

// Primer comando con cadencia de minutos en el proyecto: el scheduler ya
// corre confiable en Railway (worker dedicado, ver memoria del proyecto),
// así que no hay motivo para no usarlo igual que los demás.
Schedule::command('reparto:detectar-vehiculos-detenidos')->everyTwoMinutes();

// `glossary:scrape` NO se programa: invias.gov.co bloquea por IP los
// datacenters extranjeros (Railway está en NL → HTTP 403). El glosario se
// scrapea desde una IP colombiana y se versiona en
// database/data/glosario_invias.json (ver GlosarioInviasSeeder).
