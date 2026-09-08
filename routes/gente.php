<?php

use App\Http\Controllers\Gente\AusentismoController;
use App\Http\Controllers\Gente\ColaboradorCalificacionController;
use App\Http\Controllers\Gente\ColaboradorController;
use App\Http\Controllers\Gente\ColaboradorEntrenamientoController;
use App\Http\Controllers\Gente\ColaboradorImportController;
use App\Http\Controllers\Gente\CorreccionMarcacionController;
use App\Http\Controllers\Gente\DpoAcademyController;
use App\Http\Controllers\Gente\FestivoCustomController;
use App\Http\Controllers\Gente\GeovictoriaAsistenciaController;
use App\Http\Controllers\Gente\LlamadoAtencionController;
use App\Http\Controllers\Gente\PlanPremiacionController;
use App\Http\Controllers\Gente\ReferenciaExternaController;
use App\Http\Controllers\Gente\SacController;
use App\Http\Controllers\Gente\SeguimientoPruebasController;
use Illuminate\Support\Facades\Route;

// Colaboradores es propiedad de Gente (crear/importar/editar/eliminar),
// mientras que Administrador, Seguridad, Reparto y Flota conservan acceso
// de solo lectura al listado y al detalle.
//
// El grupo con "create" se registra ANTES que el de solo lectura (que trae
// "show", ruta comodín colaboradores/{colaborador}) para que Laravel no
// intente resolver GET colaboradores/create como si "create" fuera un id.
Route::middleware(['auth', 'active', 'role:Administrador|Gente'])
    ->prefix('modules/gente')
    ->name('gente.')
    ->group(function () {
        // Rutas específicas de "colaboradores" antes del resource para que no
        // choquen con la ruta comodín colaboradores/{colaborador}.
        Route::get('colaboradores/referencias/departamentos', [ReferenciaExternaController::class, 'departamentos'])
            ->name('colaboradores.referencias.departamentos');
        Route::get('colaboradores/referencias/ciudades', [ReferenciaExternaController::class, 'ciudades'])
            ->name('colaboradores.referencias.ciudades');
        Route::get('colaboradores/referencias/instituciones-sena', [ReferenciaExternaController::class, 'institucionesSena'])
            ->name('colaboradores.referencias.instituciones-sena');

        // Carga masiva desde el Excel de nómina ("BASE ACTUALIZADA").
        Route::post('colaboradores/importar', [ColaboradorImportController::class, 'store'])
            ->name('colaboradores.importar');

        // El pluralizador en inglés de Laravel no singulariza bien "colaboradores"
        // (produce "colaboradore"), así que se fuerza el nombre del parámetro.
        Route::resource('colaboradores', ColaboradorController::class)
            ->parameters(['colaboradores' => 'colaborador'])
            ->only(['create', 'store', 'edit', 'update', 'destroy']);

        // Wizard multipaso de colaboradores (HU01/HU02): cada paso persiste su
        // porción de datos por separado; el paso 4 marca el registro completo.
        // También es la vista de "editar" (ColaboradorController::edit delega
        // en wizard()), así que va en el grupo de escritura.
        Route::get('colaboradores/{colaborador}/wizard', [ColaboradorController::class, 'wizard'])
            ->name('colaboradores.wizard');
        Route::patch('colaboradores/{colaborador}/paso-1', [ColaboradorController::class, 'updatePaso1'])
            ->name('colaboradores.paso1.update');
        Route::patch('colaboradores/{colaborador}/paso-2', [ColaboradorController::class, 'updatePaso2'])
            ->name('colaboradores.paso2.update');
        Route::patch('colaboradores/{colaborador}/paso-3', [ColaboradorController::class, 'updatePaso3'])
            ->name('colaboradores.paso3.update');
        Route::patch('colaboradores/{colaborador}/paso-4', [ColaboradorController::class, 'updatePaso4'])
            ->name('colaboradores.paso4.update');

        // HU04: activar/desactivar desde la vista de detalle.
        Route::patch('colaboradores/{colaborador}/toggle-activo', [ColaboradorController::class, 'toggleActivo'])
            ->name('colaboradores.toggle-activo');

        // Paso 5/6: registros que se acumulan durante la relación laboral,
        // gestionados desde la vista de detalle (show), no desde el wizard.
        Route::post('colaboradores/{colaborador}/llamados-atencion', [LlamadoAtencionController::class, 'store'])
            ->name('colaboradores.llamados-atencion.store');
        Route::post('colaboradores/{colaborador}/entrenamientos', [ColaboradorEntrenamientoController::class, 'store'])
            ->name('colaboradores.entrenamientos.store');

        // Plan Premiación — toggle manual de checklist
        Route::post('plan-premiacion/toggle-checklist', [PlanPremiacionController::class, 'toggleChecklist'])
            ->name('plan-premiacion.toggle-checklist');

        // Seguimiento de Pruebas y Plan Padrino (7, 30 y 90 días)
        Route::get('plan-padrinos', [SeguimientoPruebasController::class, 'index'])
            ->name('plan-padrinos.index');
        Route::post('plan-padrinos/toggle', [SeguimientoPruebasController::class, 'toggle'])
            ->name('plan-padrinos.toggle');

        // Calificaciones de Módulos (Escritura: Importar / Limpiar)
        Route::post('calificaciones/importar', [ColaboradorCalificacionController::class, 'importar'])
            ->name('calificaciones.importar');
        Route::post('calificaciones/limpiar', [ColaboradorCalificacionController::class, 'limpiar'])
            ->name('calificaciones.limpiar');

        // DPO Academy (Escritura: Importar / Limpiar)
        Route::post('dpo-academy/importar', [DpoAcademyController::class, 'importar'])
            ->name('dpo-academy.importar');
        Route::post('dpo-academy/limpiar', [DpoAcademyController::class, 'limpiar'])
            ->name('dpo-academy.limpiar');

        // Ausentismo (Escritura: Importar / Limpiar)
        Route::post('ausentismo/importar', [AusentismoController::class, 'importar'])
            ->name('ausentismo.importar');
        Route::post('ausentismo/limpiar', [AusentismoController::class, 'limpiar'])
            ->name('ausentismo.limpiar');

        // SAC (Escritura: Importar / Limpiar)
        Route::post('sac/importar', [SacController::class, 'importar'])
            ->name('sac.importar');
        Route::post('sac/limpiar', [SacController::class, 'limpiar'])
            ->name('sac.limpiar');

        // Festivos custom — toggle (agregar/eliminar un día como festivo)
        Route::post('festivos-custom/toggle', [FestivoCustomController::class, 'toggle'])
            ->name('festivos-custom.toggle');
    });

Route::middleware(['auth', 'active', 'role:Administrador|Seguridad|Reparto|Flota|Gente'])
    ->prefix('modules/gente')
    ->name('gente.')
    ->group(function () {
        // Solo lectura: todos los roles de módulo pueden ver el listado y el
        // detalle de colaboradores, pero no crear/editar/importar/eliminar
        // (ver grupo role:Administrador|Gente arriba).
        Route::resource('colaboradores', ColaboradorController::class)
            ->parameters(['colaboradores' => 'colaborador'])
            ->only(['index', 'show']);

        Route::get('plan-padrinos/alertas-bell', [SeguimientoPruebasController::class, 'alertasBell'])
            ->name('plan-padrinos.alertas-bell');

        // Plan Premiación ACI (32 ACI = 100%)
        Route::get('plan-premiacion', [PlanPremiacionController::class, 'index'])
            ->name('plan-premiacion.index');
        Route::get('plan-premiacion/exportar', [PlanPremiacionController::class, 'exportar'])
            ->name('plan-premiacion.exportar');
        Route::get('plan-premiacion/{colaborador}', [PlanPremiacionController::class, 'show'])
            ->name('plan-premiacion.show');

        // Festivos custom — lectura (disponible para todos los roles que ven plan premiación)
        Route::get('festivos-custom', [FestivoCustomController::class, 'index'])
            ->name('festivos-custom.index');

        // Calificaciones (Lectura & Exportar)
        Route::get('calificaciones', [ColaboradorCalificacionController::class, 'index'])
            ->name('calificaciones.index');
        Route::get('calificaciones/exportar', [ColaboradorCalificacionController::class, 'exportar'])
            ->name('calificaciones.exportar');

        // DPO Academy (Lectura & Exportar)
        Route::get('dpo-academy', [DpoAcademyController::class, 'index'])
            ->name('dpo-academy.index');
        Route::get('dpo-academy/exportar', [DpoAcademyController::class, 'exportar'])
            ->name('dpo-academy.exportar');

        // Ausentismo (Lectura & Exportar)
        Route::get('ausentismo', [AusentismoController::class, 'index'])
            ->name('ausentismo.index');
        Route::get('ausentismo/exportar', [AusentismoController::class, 'exportar'])
            ->name('ausentismo.exportar');

        // SAC (Lectura, Plantilla & Exportar)
        Route::get('sac', [SacController::class, 'index'])
            ->name('sac.index');
        Route::get('sac/exportar', [SacController::class, 'exportar'])
            ->name('sac.exportar');
        Route::get('sac/plantilla', [SacController::class, 'plantilla'])
            ->name('sac.plantilla');
    });

Route::middleware(['auth', 'active', 'role:Administrador|Gente|Reparto'])
    ->prefix('modules/gente')
    ->name('gente.')
    ->group(function () {
        // Solo lectura: los datos los genera la automatizacion GeoVictoria
        // (ver POST /api/geovictoria/asistencias), no se crean/editan desde
        // la web. Visible para Gente (dueño del módulo) y Reparto.
        Route::get('asistencia-geovictoria', [GeovictoriaAsistenciaController::class, 'index'])
            ->name('asistencia-geovictoria.index');
    });

// ─────────── Corrección de Marcaciones ────────────────────────────────────
// Escritura: solo Administrador / Gente pueden subir, confirmar la
// importación, eliminar registros y limpiar la tabla.
Route::middleware(['auth', 'active', 'role:Administrador|Gente|Seguridad'])
    ->prefix('modules/gente')
    ->name('gente.')
    ->group(function () {
        Route::post('correccion-marcaciones/preview',   [CorreccionMarcacionController::class, 'preview'])   ->name('correccion-marcaciones.preview');
        Route::post('correccion-marcaciones/importar',  [CorreccionMarcacionController::class, 'importar'])  ->name('correccion-marcaciones.importar');
        Route::post('correccion-marcaciones/limpiar',   [CorreccionMarcacionController::class, 'limpiar'])   ->name('correccion-marcaciones.limpiar');
        Route::delete('correccion-marcaciones/{id}',    [CorreccionMarcacionController::class, 'destroy'])   ->name('correccion-marcaciones.destroy');
    });

// Lectura + plantilla + exportación: visible para Gente, Reparto (ya que
// afecta nóminas del reparto), Administrador y Seguridad.
Route::middleware(['auth', 'active', 'role:Administrador|Seguridad|Reparto|Gente'])
    ->prefix('modules/gente')
    ->name('gente.')
    ->group(function () {
        Route::get('correccion-marcaciones',                    [CorreccionMarcacionController::class, 'index'])      ->name('correccion-marcaciones.index');
        Route::get('correccion-marcaciones/exportar.csv',       [CorreccionMarcacionController::class, 'exportar'])   ->name('correccion-marcaciones.exportar');
        Route::get('correccion-marcaciones/plantilla.csv',      [CorreccionMarcacionController::class, 'plantilla'])  ->name('correccion-marcaciones.plantilla');
    });
