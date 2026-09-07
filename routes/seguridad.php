<?php

use App\Http\Controllers\Seguridad\AciConsultaSkapController;
use App\Http\Controllers\Seguridad\AciController;
use App\Http\Controllers\Seguridad\AciImportController;
use App\Http\Controllers\Seguridad\AciIndicadorController;
use App\Http\Controllers\Seguridad\AlcoholimetroController;
use App\Http\Controllers\Seguridad\AlertaController;
use App\Http\Controllers\Seguridad\AsignacionConductorController;
use App\Http\Controllers\Seguridad\CargoExamenController;
use App\Http\Controllers\Seguridad\ConceptoAptitudController;
use App\Http\Controllers\Seguridad\CondicionSaludController;
use App\Http\Controllers\Seguridad\EvaluacionMedicaController;
use App\Http\Controllers\Seguridad\EvaluacionMedicaExportController;
use App\Http\Controllers\Seguridad\EvaluacionOwdController;
use App\Http\Controllers\Seguridad\EvaluacionOwdCumplimientoController;
use App\Http\Controllers\Seguridad\EvaluacionOwdExportController;
use App\Http\Controllers\Seguridad\EvaluacionOwdImportacionController;
use App\Http\Controllers\Seguridad\EvaluacionOwdImportController;
use App\Http\Controllers\Seguridad\EvaluacionOwdIndicadorController;
use App\Http\Controllers\Seguridad\EncuestaMorbilidadController;
use App\Http\Controllers\Seguridad\EncuestaMorbilidadPreguntaController;
use App\Http\Controllers\Seguridad\EncuestaMorbilidadSeccionController;
use App\Http\Controllers\Seguridad\ExamenCatalogoController;
use App\Http\Controllers\Seguridad\EstadoColaboradorController;
use App\Http\Controllers\Seguridad\EvaluacionRecomendacionController;
use App\Http\Controllers\Seguridad\ExamenMedicoIndicadorController;
use App\Http\Controllers\Seguridad\PlanAccionOwdController;
use App\Http\Controllers\Seguridad\PlanAccionOwdSeguimientoController;
use App\Http\Controllers\Seguridad\PruebaAlcoholemiaController;
use App\Http\Controllers\Seguridad\PublicVerificationController;
use App\Http\Controllers\Seguridad\RecomendacionCatalogoController;
use App\Http\Controllers\Seguridad\RecomendacionSeguimientoController;
use App\Http\Controllers\Seguridad\RutaCriticaController;
use App\Http\Controllers\Seguridad\GlossaryTermController;
use Illuminate\Support\Facades\Route;

// HU037: verificación pública del QR — intencionalmente fuera del grupo `auth`.
Route::get('verificar-prueba/{prueba}/{token}', [PublicVerificationController::class, 'show'])->name('seguridad.verificacion');

// Las rutas de colaboradores viven en routes/gente.php: el módulo es
// propiedad de Gente (crear/importar/editar/eliminar), con acceso de solo
// lectura para Administrador, Seguridad, Reparto y Flota.

Route::middleware(['auth', 'active', 'role:Administrador|Seguridad'])
    ->prefix('modules/seguridad')
    ->name('seguridad.')
    ->group(function () {
        Route::resource('dispositivos', AlcoholimetroController::class);
        Route::post('dispositivos/{dispositivo}/mantenimientos', [AlcoholimetroController::class, 'storeMantenimiento'])
            ->name('dispositivos.mantenimientos.store');

        // Rutas específicas de "pruebas" antes del resource para que no choquen
        // con la ruta comodín pruebas/{prueba}.
        Route::get('pruebas/calendario', [PruebaAlcoholemiaController::class, 'calendario'])->name('pruebas.calendario');
        Route::get('pruebas/exportar/pdf', [PruebaAlcoholemiaController::class, 'exportarPdf'])->name('pruebas.exportar-pdf');
        Route::get('pruebas/exportar/excel', [PruebaAlcoholemiaController::class, 'exportarExcel'])->name('pruebas.exportar-excel');
        Route::resource('pruebas', PruebaAlcoholemiaController::class)->only(['index', 'create', 'store', 'show', 'edit', 'update']);

        Route::get('condiciones-salud', [CondicionSaludController::class, 'index'])->name('condiciones-salud.index');
        Route::post('condiciones-salud', [CondicionSaludController::class, 'store'])->name('condiciones-salud.store');
        Route::post('condiciones-salud/{condicion}/firmar', [CondicionSaludController::class, 'firmar'])->name('condiciones-salud.firmar');

        Route::get('alertas', [AlertaController::class, 'index'])->name('alertas.index');
        Route::get('alertas/bell', [AlertaController::class, 'bell'])->name('alertas.bell');
        Route::patch('alertas/{alerta}/atender', [AlertaController::class, 'atender'])->name('alertas.atender');

        Route::resource('asignaciones-conductores', AsignacionConductorController::class)->except(['show', 'update', 'destroy']);

        Route::get('indicador', [EstadoColaboradorController::class, 'index'])->name('indicador.index');
        Route::resource('glosario', GlossaryTermController::class);

        Route::get('rutas-criticas', [RutaCriticaController::class, 'index'])
            ->name('rutas-criticas.index');

        // Rutas específicas de "acis" antes del resource-like get('acis/{aci}')
        // para que no choquen con la ruta comodín.
        Route::post('acis/importar', [AciImportController::class, 'store'])->name('acis.importar');
        Route::get('acis-consultar-qr', [AciConsultaSkapController::class, 'index'])->name('acis.consultar-qr');
        Route::get('acis-indicadores', [AciIndicadorController::class, 'index'])->name('acis.indicadores');
        Route::get('acis', [AciController::class, 'index'])->name('acis.index');
        Route::get('acis/{aci}', [AciController::class, 'show'])->name('acis.show');

        // Rutas específicas de "evaluaciones-owd" antes del comodín
        // evaluaciones-owd/{evaluacionOwd} (HU-030 a HU-043).
        Route::post('evaluaciones-owd/importar', [EvaluacionOwdImportController::class, 'store'])->name('evaluaciones-owd.importar');
        Route::get('evaluaciones-owd/exportar', [EvaluacionOwdExportController::class, 'evaluaciones'])->name('evaluaciones-owd.exportar');
        Route::get('evaluaciones-owd-indicadores', [EvaluacionOwdIndicadorController::class, 'index'])->name('evaluaciones-owd.indicadores');
        Route::get('evaluaciones-owd-incumplimientos', [EvaluacionOwdController::class, 'incumplimientos'])->name('evaluaciones-owd.incumplimientos');
        Route::get('evaluaciones-owd-importaciones', [EvaluacionOwdImportacionController::class, 'index'])->name('evaluaciones-owd.importaciones');
        Route::get('evaluaciones-owd-cumplimiento/{colaborador}/historial', [EvaluacionOwdCumplimientoController::class, 'historial'])
            ->name('evaluaciones-owd.cumplimiento.historial');
        Route::get('evaluaciones-owd-cumplimiento/{colaborador}', [EvaluacionOwdCumplimientoController::class, 'show'])
            ->name('evaluaciones-owd.cumplimiento.show');
        Route::get('evaluaciones-owd-cumplimiento/exportar', [EvaluacionOwdExportController::class, 'cumplimiento'])
            ->name('evaluaciones-owd.cumplimiento.exportar');
        Route::get('evaluaciones-owd', [EvaluacionOwdController::class, 'index'])->name('evaluaciones-owd.index');
        Route::get('evaluaciones-owd/{evaluacionOwd}', [EvaluacionOwdController::class, 'show'])->name('evaluaciones-owd.show');

        // Planes de acción generados a partir de incumplimientos OWD (HU-039/042).
        Route::get('planes-accion-owd/priorizacion', [PlanAccionOwdController::class, 'priorizacion'])->name('planes-accion-owd.priorizacion');
        Route::get('planes-accion-owd/exportar', [EvaluacionOwdExportController::class, 'planesAccion'])->name('planes-accion-owd.exportar');
        Route::get('planes-accion-owd', [PlanAccionOwdController::class, 'index'])->name('planes-accion-owd.index');
        Route::patch('planes-accion-owd/{planAccionOwd}', [PlanAccionOwdController::class, 'update'])->name('planes-accion-owd.update');
        Route::post('planes-accion-owd/{planAccionOwd}/seguimientos', [PlanAccionOwdSeguimientoController::class, 'store'])
            ->name('planes-accion-owd.seguimientos.store');

        // Vista de consulta de SST para la Encuesta de Morbilidad Sentida
        // (HU-01 a HU-10). La sección psicosocial (9) solo es visible aquí
        // porque esta pantalla ya vive dentro del grupo role:Administrador|Seguridad.
        Route::get('encuestas-morbilidad', [EncuestaMorbilidadController::class, 'index'])->name('encuestas-morbilidad.index');
        Route::get('encuestas-morbilidad/{encuestaMorbilidad}', [EncuestaMorbilidadController::class, 'show'])->name('encuestas-morbilidad.show');

        // Gestión dinámica del catálogo de preguntas de morbilidad (solo Administrador | Seguridad)
        Route::get('encuestas-morbilidad-preguntas', [EncuestaMorbilidadPreguntaController::class, 'index'])->name('encuestas-morbilidad.preguntas.index');
        Route::post('encuestas-morbilidad-preguntas', [EncuestaMorbilidadPreguntaController::class, 'store'])->name('encuestas-morbilidad.preguntas.store');
        Route::patch('encuestas-morbilidad-preguntas/{pregunta}', [EncuestaMorbilidadPreguntaController::class, 'update'])->name('encuestas-morbilidad.preguntas.update');
        Route::delete('encuestas-morbilidad-preguntas/{pregunta}', [EncuestaMorbilidadPreguntaController::class, 'destroy'])->name('encuestas-morbilidad.preguntas.destroy');

        // Gestión de secciones (imagen de portada)
        Route::get('encuestas-morbilidad-secciones', [EncuestaMorbilidadSeccionController::class, 'index'])->name('encuestas-morbilidad.secciones.index');
        Route::post('encuestas-morbilidad-secciones/{seccion}/portada', [EncuestaMorbilidadSeccionController::class, 'subirPortada'])->name('encuestas-morbilidad.secciones.portada');
        Route::delete('encuestas-morbilidad-secciones/{seccion}/portada', [EncuestaMorbilidadSeccionController::class, 'eliminarPortada'])->name('encuestas-morbilidad.secciones.portada.destroy');

        // Exámenes médicos ocupacionales (HU-045 y siguientes, Fase 1).
        Route::get('examenes-medicos-indicadores', [ExamenMedicoIndicadorController::class, 'index'])->name('examenes-medicos.indicadores');
        Route::get('examenes-medicos-catalogo', [ExamenCatalogoController::class, 'index'])->name('examenes-medicos.catalogo.index');
        Route::post('examenes-medicos-catalogo', [ExamenCatalogoController::class, 'store'])->name('examenes-medicos.catalogo.store');
        Route::patch('examenes-medicos-catalogo/{examen}', [ExamenCatalogoController::class, 'update'])->name('examenes-medicos.catalogo.update');

        Route::get('examenes-medicos-matriz', [CargoExamenController::class, 'index'])->name('examenes-medicos.matriz.index');
        Route::post('examenes-medicos-matriz', [CargoExamenController::class, 'update'])->name('examenes-medicos.matriz.update');

        Route::get('examenes-medicos-conceptos', [ConceptoAptitudController::class, 'index'])->name('examenes-medicos.conceptos.index');
        Route::post('examenes-medicos-conceptos', [ConceptoAptitudController::class, 'store'])->name('examenes-medicos.conceptos.store');
        Route::patch('examenes-medicos-conceptos/{conceptoAptitud}', [ConceptoAptitudController::class, 'update'])->name('examenes-medicos.conceptos.update');

        // Catálogo de recomendaciones (HU-054, Fase 2).
        Route::get('examenes-medicos-recomendaciones', [RecomendacionCatalogoController::class, 'index'])->name('examenes-medicos.recomendaciones.catalogo.index');
        Route::post('examenes-medicos-recomendaciones', [RecomendacionCatalogoController::class, 'store'])->name('examenes-medicos.recomendaciones.catalogo.store');
        Route::patch('examenes-medicos-recomendaciones/{recomendacion}', [RecomendacionCatalogoController::class, 'update'])->name('examenes-medicos.recomendaciones.catalogo.update');

        // Rutas específicas antes del comodín examenes-medicos/{evaluacion}.
        Route::get('examenes-medicos/exportar/basica', [EvaluacionMedicaExportController::class, 'basica'])->name('examenes-medicos.exportar.basica');
        Route::get('examenes-medicos/exportar/completa', [EvaluacionMedicaExportController::class, 'completa'])->name('examenes-medicos.exportar.completa');
        Route::get('examenes-medicos/crear', [EvaluacionMedicaController::class, 'create'])->name('examenes-medicos.create');
        Route::post('examenes-medicos', [EvaluacionMedicaController::class, 'store'])->name('examenes-medicos.store');
        Route::get('examenes-medicos', [EvaluacionMedicaController::class, 'index'])->name('examenes-medicos.index');
        Route::get('examenes-medicos/{evaluacion}', [EvaluacionMedicaController::class, 'show'])->name('examenes-medicos.show');
        Route::post('examenes-medicos/{evaluacion}/iniciar', [EvaluacionMedicaController::class, 'iniciar'])->name('examenes-medicos.iniciar');
        Route::patch('examenes-medicos/{evaluacion}/examenes/programar-todos', [EvaluacionMedicaController::class, 'programarTodos'])
            ->name('examenes-medicos.examenes.programar-todos');
        Route::post('examenes-medicos/{evaluacion}/examenes/ejecutar-todos', [EvaluacionMedicaController::class, 'ejecutarTodos'])
            ->name('examenes-medicos.examenes.ejecutar-todos');
        Route::patch('examenes-medicos/{evaluacion}/examenes/{examenEvaluacion}/programar', [EvaluacionMedicaController::class, 'programarExamen'])
            ->name('examenes-medicos.examenes.programar');
        Route::post('examenes-medicos/{evaluacion}/examenes/{examenEvaluacion}/ejecutar', [EvaluacionMedicaController::class, 'ejecutarExamen'])
            ->name('examenes-medicos.examenes.ejecutar');
        Route::post('examenes-medicos/{evaluacion}/examenes/adicional', [EvaluacionMedicaController::class, 'agregarExamenAdicional'])
            ->name('examenes-medicos.examenes.adicional');
        Route::patch('examenes-medicos/{evaluacion}/concepto-aptitud', [EvaluacionMedicaController::class, 'actualizarConceptoAptitud'])
            ->name('examenes-medicos.concepto-aptitud');

        // Recomendaciones de una evaluación y su seguimiento (HU-054/055).
        Route::post('examenes-medicos/{evaluacion}/recomendaciones', [EvaluacionRecomendacionController::class, 'store'])
            ->name('examenes-medicos.recomendaciones.store');
        Route::patch('examenes-medicos/{evaluacion}/recomendaciones/{evaluacionRecomendacion}/activa', [EvaluacionRecomendacionController::class, 'toggleActiva'])
            ->withoutScopedBindings()
            ->name('examenes-medicos.recomendaciones.toggle-activa');
        Route::delete('examenes-medicos/{evaluacion}/recomendaciones/{evaluacionRecomendacion}', [EvaluacionRecomendacionController::class, 'destroy'])
            ->withoutScopedBindings()
            ->name('examenes-medicos.recomendaciones.destroy');
        Route::post('examenes-medicos/{evaluacion}/recomendaciones/{evaluacionRecomendacion}/seguimientos', [RecomendacionSeguimientoController::class, 'store'])
            ->withoutScopedBindings()
            ->name('examenes-medicos.recomendaciones.seguimientos.store');
        Route::put('examenes-medicos/{evaluacion}/recomendaciones/{evaluacionRecomendacion}/seguimientos/{seguimiento}', [RecomendacionSeguimientoController::class, 'update'])
            ->withoutScopedBindings()
            ->name('examenes-medicos.recomendaciones.seguimientos.update');
        Route::delete('examenes-medicos/{evaluacion}/recomendaciones/{evaluacionRecomendacion}/seguimientos/{seguimiento}', [RecomendacionSeguimientoController::class, 'destroy'])
            ->withoutScopedBindings()
            ->name('examenes-medicos.recomendaciones.seguimientos.destroy');

        // Egreso (HU no numerada, Fase 3): flujo simplificado sin matriz.
        Route::patch('examenes-medicos/{evaluacion}/egreso/programar', [EvaluacionMedicaController::class, 'programarEgreso'])
            ->name('examenes-medicos.egreso.programar');
        Route::patch('examenes-medicos/{evaluacion}/egreso/ejecutar', [EvaluacionMedicaController::class, 'ejecutarEgreso'])
            ->name('examenes-medicos.egreso.ejecutar');
        Route::patch('examenes-medicos/{evaluacion}/egreso/rechazar', [EvaluacionMedicaController::class, 'rechazarEgreso'])
            ->name('examenes-medicos.egreso.rechazar');
        Route::patch('examenes-medicos/{evaluacion}/egreso/seguimiento', [EvaluacionMedicaController::class, 'actualizarSeguimientoEgreso'])
            ->name('examenes-medicos.egreso.seguimiento');
    });
