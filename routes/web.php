<?php

use App\Http\Controllers\ChatbotController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Gente\SeguimientoPruebasController;
use App\Http\Controllers\NotificacionesController;
use App\Http\Controllers\Reparto\CompensacionVariableController;
use App\Http\Controllers\Reparto\ModulacionController;
use App\Http\Controllers\Seguridad\RutaCriticaController;
use App\Services\Seguridad\RutasCriticasDatosAbiertosService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

require __DIR__.'/seguridad.php';
require __DIR__.'/colaborador.php';
require __DIR__.'/flota.php';
require __DIR__.'/capacitaciones.php';
require __DIR__.'/reparto.php';
require __DIR__.'/gente.php';
require __DIR__.'/cinco-porques.php';

Route::middleware(['auth', 'active'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Chatbot interno (Groq): disponible para todos los roles autenticados,
    // no requiere el middleware module.access porque no pertenece a un solo
    // pilar — se monta como widget flotante en AppSidebarLayout.
    Route::post('chatbot/mensaje', [ChatbotController::class, 'send'])
        ->middleware('throttle:20,1')
        ->name('chatbot.send');

    // Campana de notificaciones del header: feed unificado por rol.
    Route::get('notificaciones', [NotificacionesController::class, 'index'])->name('notificaciones.index');

    Route::middleware('module.access')->group(function () {
        Route::get('modules/{module}', function (string $module) {
            return Inertia::render('modules/show', ['module' => $module]);
        })->whereIn('module', ['seguridad', 'reparto', 'gente', 'flota'])->name('modules.show');

        Route::get('modules/{module}/{submodule}', function (string $module, string $submodule, Request $request) {
            if ($module === 'seguridad' && $submodule === 'rutas-criticas') {
                return (new RutaCriticaController)->index(
                    app(RutasCriticasDatosAbiertosService::class)
                );
            }
            if ($module === 'reparto' && $submodule === 'compensacion-variable') {
                return (new CompensacionVariableController)->index($request);
            }
            if ($module === 'reparto' && $submodule === 'modulacion') {
                return (new ModulacionController)->index($request);
            }
            if ($module === 'gente' && ($submodule === 'plan-padrinos' || $submodule === 'seguimiento-pruebas')) {
                return (new SeguimientoPruebasController)->index($request);
            }

            return Inertia::render('modules/submodule', ['module' => $module, 'submodule' => $submodule]);
        })->whereIn('module', ['seguridad', 'reparto', 'gente', 'flota'])->name('modules.submodule');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
require __DIR__.'/admin.php';

// ── DIAGNÓSTICO TEMPORAL — eliminar después ─────────────────────────────────
Route::get('/diagnostico-cvd', function () {
    $meses = [
        1 => 'Enero', 2 => 'Febrero', 3 => 'Marzo', 4 => 'Abril',
        5 => 'Mayo',  6 => 'Junio',   7 => 'Julio',  8 => 'Agosto',
        9 => 'Septiembre', 10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre',
    ];
    $resultado = [
        'app_timezone'  => config('app.timezone'),
        'php_date_now'  => now()->toDateTimeString(),
        'mysql_now'     => DB::selectOne('SELECT NOW() as now')->now,
        'total_eventos' => DB::table('eventos_tripulacion')->count(),
        'por_mes'       => [],
    ];
    foreach (range(1, 9) as $m) {
        $desde = \Carbon\Carbon::create(2026, $m, 1)->startOfMonth()->format('Y-m-d');
        $hasta = \Carbon\Carbon::create(2026, $m, 1)->endOfMonth()->format('Y-m-d');
        $resultado['por_mes'][] = [
            'mes'    => $meses[$m] . " 2026 ($desde → $hasta)",
            'total'  => DB::table('eventos_tripulacion')
                ->whereNotNull('documento')->where('documento', '!=', '')
                ->whereNotNull('rechazos')
                ->where('fecha', '>=', $desde)->where('fecha', '<=', $hasta)
                ->count(),
        ];
    }
    return response()->json($resultado, 200, [], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
});
// ── FIN DIAGNÓSTICO ─────────────────────────────────────────────────────────
