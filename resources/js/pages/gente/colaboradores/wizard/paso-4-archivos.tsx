import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PillToggle, SeccionCard } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { useForm } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FolderOpen, LoaderCircle } from 'lucide-react';
import { FormEventHandler, useEffect, useMemo } from 'react';
import { DocumentoGrupo, type DocumentoGrupoItem } from './components/documento-grupo';
import { LicenciaConduccionCategorias } from './components/licencia-conduccion-categorias';
import { SimpleFileField } from './components/simple-file-field';
import { type ColaboradorRecord, type Paso4FormData } from './types';
import { errorDeArchivo } from './utils';

const GRUPOS: { numero: string; titulo: string; items: DocumentoGrupoItem[] }[] = [
    {
        numero: '4.1',
        titulo: 'Documentos personales',
        items: [
            { key: 'documento_cedula', label: 'Cédula' },
            { key: 'documento_hoja_vida', label: 'Hoja de vida' },
            { key: 'documento_titulo_bachiller', label: 'Título — Bachiller' },
            { key: 'documento_titulo_tecnico', label: 'Título — Técnico' },
            { key: 'documento_titulo_tecnologo', label: 'Título — Tecnólogo' },
            { key: 'documento_titulo_profesional', label: 'Título — Profesional' },
            { key: 'documento_titulo_academico', label: 'Título — Otro' },
            { key: 'documento_antecedentes_procuraduria', label: 'Antecedentes — Procuraduría' },
            { key: 'documento_antecedentes_contraloria', label: 'Antecedentes — Contraloría' },
            { key: 'documento_antecedentes_policia', label: 'Antecedentes — Policía Nacional' },
            { key: 'documento_certificado_bancario', label: 'Certificado bancario' },
            { key: 'documento_runt', label: 'RUNT' },
        ],
    },
    {
        numero: '4.2',
        titulo: 'Documentos de salud',
        items: [
            { key: 'documento_examen_medico_ocupacional', label: 'Examen médico ocupacional' },
            { key: 'documento_arl', label: 'Documento ARL' },
            { key: 'documento_certificado_comfamiliar', label: 'Certificado Comfamiliar' },
            { key: 'documento_afiliacion_comfamiliar', label: 'Afiliación Comfamiliar' },
            { key: 'documento_eps', label: 'Afiliación a EPS' },
        ],
    },
    {
        numero: '4.3',
        titulo: 'Requerimientos de tránsito',
        items: [
            { key: 'documento_licencia_conduccion', label: 'Licencia de conducción (documento general)' },
            { key: 'documento_carnet_manejo_defensivo', label: 'Carnet de manejo defensivo' },
            { key: 'documento_certificado_manejo_defensivo', label: 'Certificado de manejo defensivo' },
            { key: 'documento_certificado_carga_pesada', label: 'Certificado de conducción de carga pesada' },
            { key: 'documento_simit', label: 'Documento SIMIT' },
            { key: 'documento_recordatorio_vehiculo_licencia_conduccion', label: 'Recordatorio de vehículo / licencia' },
        ],
    },
    {
        numero: '4.4',
        titulo: 'Documentación contrato',
        items: [
            { key: 'documento_contrato', label: 'Contrato' },
            { key: 'documento_carnet_ingreso_cd', label: 'Carnet de ingreso empresarial' },
            { key: 'documento_preaviso_terminacion', label: 'Preaviso de terminación de relación laboral' },
            { key: 'documento_prorroga', label: 'Prórroga' },
        ],
    },
    {
        numero: '4.6',
        titulo: 'Documentación People',
        items: [
            { key: 'documento_induccion', label: 'Inducción' },
            { key: 'documento_reinduccion', label: 'Reinducción' },
            { key: 'documento_induccion_pilares', label: 'Inducción pilares' },
        ],
    },
    {
        numero: '4.8',
        titulo: 'Llamado de atención',
        items: [{ key: 'documento_llamado_atencion', label: 'Llamado de atención' }],
    },
    {
        numero: '4.9',
        titulo: 'Compromisos',
        items: [{ key: 'documento_compromisos', label: 'Compromisos' }],
    },
    {
        numero: '4.10',
        titulo: 'Certificados de aprendizaje',
        items: [
            { key: 'documento_escuela_pilotos', label: 'Certificado escuela de pilotos' },
            { key: 'documento_certificado_brigadista', label: 'Certificado de Brigadista' },
        ],
    },
];

const TODOS_LOS_DOCUMENTOS = GRUPOS.flatMap((g) => g.items.map((i) => i.key));

interface Paso4Props {
    colaborador: ColaboradorRecord;
    onBack: () => void;
}

export function Paso4Archivos({ colaborador, onBack }: Paso4Props) {
    const cargoActual = (colaborador.cargo as string | null) ?? '';
    const esAprendizSena = cargoActual === 'APRENDIZ SENA';

    const documentosIniciales = Object.fromEntries(TODOS_LOS_DOCUMENTOS.map((key) => [key, [] as File[]]));
    const licenciaKeys = ['a1', 'a2', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3'].map((c) => `documento_licencia_${c}`);
    const licenciaIniciales = Object.fromEntries(licenciaKeys.map((key) => [key, [] as File[]]));

    const { data, setData, post, processing, errors, transform, clearErrors } = useForm<Paso4FormData>({
        ...documentosIniciales,
        ...licenciaIniciales,
        documento_sena_carta_presentacion: [],
        documento_plan_padrino: [],
        licencia_conduccion_categorias: [],
        fecha_licencia: (colaborador.fecha_licencia as string | null) ?? '',
        fecha_vencimiento_licencia: (colaborador.fecha_vencimiento_licencia as string | null) ?? '',
        restricciones_licencia: (colaborador.restricciones_licencia as string | null) ?? '',
        es_padrino: (colaborador.es_padrino as Paso4FormData['es_padrino']) ?? '',
        tipo_padrino: (colaborador.tipo_padrino as Paso4FormData['tipo_padrino']) ?? '',
    });

    // Limpiar errores de pasos anteriores al montar este paso.
    useEffect(() => {
        clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Días que faltan desde hoy hasta la fecha de vencimiento. Negativo = ya venció. */
    const diasPendientesLicencia = useMemo(() => {
        if (!data.fecha_vencimiento_licencia) return null;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const vencimiento = new Date(data.fecha_vencimiento_licencia + 'T00:00:00');
        return Math.round((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    }, [data.fecha_vencimiento_licencia]);

    const existing = (key: string) => (colaborador[key] as { path: string; fecha: string | null }[]) ?? [];
    const existingMap = Object.fromEntries(TODOS_LOS_DOCUMENTOS.map((key) => [key, existing(key)]));

    const toggleLicenciaCategoria = (categoria: string) => {
        const actuales = data.licencia_conduccion_categorias;
        setData('licencia_conduccion_categorias', actuales.includes(categoria) ? actuales.filter((c) => c !== categoria) : [...actuales, categoria]);
    };

    const archivosLicenciaPorCategoria = Object.fromEntries(
        ['A1', 'A2', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'].map((c) => [c, (data[`documento_licencia_${c.toLowerCase()}`] as File[]) ?? []]),
    );

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        transform((formData) => {
            // Eliminar arrays de archivos vacíos para no sobrecargar el validador
            const cleaned: Record<string, unknown> = { _method: 'PATCH' };
            for (const [key, value] of Object.entries(formData)) {
                if (Array.isArray(value) && value.length === 0 && key.startsWith('documento_')) {
                    continue;
                }
                cleaned[key] = value;
            }
            return cleaned as typeof formData;
        });
        post(route('gente.colaboradores.paso4.update', colaborador.id), {
            forceFormData: true,
            onError: (errs) => console.error('[Paso4] Errores de validación:', JSON.stringify(errs, null, 2)),
        });
    };

    return (
        <form onSubmit={submit} className="grid gap-6">
            {Object.keys(errors).length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                    <AlertTriangle className="size-4 shrink-0" />
                    Hay archivos u opciones con error — revisa los grupos marcados en rojo antes de finalizar.
                </div>
            )}

            <SeccionCard icon={FolderOpen} titulo="Requerimientos de tránsito — licencia de conducción" tono="verde">
                <LicenciaConduccionCategorias
                    seleccionadas={data.licencia_conduccion_categorias}
                    onToggle={toggleLicenciaCategoria}
                    archivos={archivosLicenciaPorCategoria}
                    onArchivoChange={(categoria, files) => setData(`documento_licencia_${categoria.toLowerCase()}`, files)}
                    existingDocumentos={existingMap}
                    errors={errors}
                    disabled={processing}
                />

                {/* ── Fechas y días pendientes de licencia ── */}
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="grid gap-2">
                        <Label htmlFor="fecha_licencia">Fecha de licencia</Label>
                        <Input
                            id="fecha_licencia"
                            type="date"
                            value={data.fecha_licencia}
                            onChange={(e) => setData('fecha_licencia', e.target.value)}
                            disabled={processing}
                        />
                        <InputError message={errors.fecha_licencia} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="fecha_vencimiento_licencia">Fecha de vencimiento de licencia</Label>
                        <Input
                            id="fecha_vencimiento_licencia"
                            type="date"
                            value={data.fecha_vencimiento_licencia}
                            onChange={(e) => setData('fecha_vencimiento_licencia', e.target.value)}
                            disabled={processing}
                        />
                        <InputError message={errors.fecha_vencimiento_licencia} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Días ptes. licencia</Label>
                        <div
                            className={[
                                'flex h-9 items-center rounded-md border px-3 text-sm font-semibold',
                                diasPendientesLicencia === null
                                    ? 'border-input bg-muted text-muted-foreground'
                                    : diasPendientesLicencia < 0
                                      ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300'
                                      : diasPendientesLicencia <= 30
                                        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
                                        : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
                            ].join(' ')}
                        >
                            {diasPendientesLicencia === null
                                ? '—'
                                : diasPendientesLicencia < 0
                                  ? `Venció hace ${Math.abs(diasPendientesLicencia)} día${Math.abs(diasPendientesLicencia) === 1 ? '' : 's'}`
                                  : `${diasPendientesLicencia} día${diasPendientesLicencia === 1 ? '' : 's'}`}
                        </div>
                    </div>
                </div>

                {/* ── Restricciones de licencia ── */}
                <div className="mt-4 grid gap-2">
                    <Label htmlFor="restricciones_licencia">Restricciones</Label>
                    <Textarea
                        id="restricciones_licencia"
                        value={data.restricciones_licencia}
                        onChange={(e) => setData('restricciones_licencia', e.target.value)}
                        disabled={processing}
                        placeholder="Ej: No conducir de noche, requiere lentes, restricción de carga…"
                        rows={3}
                        maxLength={500}
                    />
                    <InputError message={errors.restricciones_licencia} />
                </div>
            </SeccionCard>

            {esAprendizSena && (
                <SeccionCard titulo="Documentación aprendiz — 4.5" tono="verde">
                    <SimpleFileField
                        label="Carta de presentación (Aprendiz SENA)"
                        files={data.documento_sena_carta_presentacion}
                        existing={existing('documento_sena_carta_presentacion')}
                        onChange={(files) => setData('documento_sena_carta_presentacion', files)}
                        error={errorDeArchivo(errors, 'documento_sena_carta_presentacion')}
                        disabled={processing}
                    />
                </SeccionCard>
            )}

            <SeccionCard titulo="Documentación Plan padrino — 4.7" tono="azul">
                <div className="grid gap-4">
                    <PillToggle
                        label="¿Es padrino?"
                        value={data.es_padrino}
                        onChange={(value) => setData('es_padrino', value)}
                        disabled={processing}
                        options={[{ value: 'no_aplica', label: 'No aplica' }, { value: 'aplica', label: 'Aplica' }]}
                    />
                    {data.es_padrino === 'aplica' && (
                        <div className="grid gap-3 border-l-2 border-emerald-300 pl-3 dark:border-emerald-500/30">
                            <div className="grid gap-2 sm:max-w-xs">
                                <Label htmlFor="tipo_padrino">Tipo</Label>
                                <Select value={data.tipo_padrino} onValueChange={(value) => setData('tipo_padrino', value as Paso4FormData['tipo_padrino'])} disabled={processing}>
                                    <SelectTrigger id="tipo_padrino">
                                        <SelectValue placeholder="Selecciona el tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="padrino">Padrino</SelectItem>
                                        <SelectItem value="plan_padrino_personal_nuevo">Plan padrino personal nuevo</SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.tipo_padrino} />
                            </div>
                            {data.tipo_padrino === 'plan_padrino_personal_nuevo' && (
                                <SimpleFileField
                                    files={data.documento_plan_padrino}
                                    existing={existing('documento_plan_padrino')}
                                    onChange={(files) => setData('documento_plan_padrino', files)}
                                    error={errorDeArchivo(errors, 'documento_plan_padrino')}
                                    disabled={processing}
                                />
                            )}
                        </div>
                    )}
                </div>
            </SeccionCard>

            {GRUPOS.map((grupo) => (
                <DocumentoGrupo
                    key={grupo.numero}
                    numero={grupo.numero}
                    titulo={grupo.titulo}
                    items={grupo.items}
                    files={data as unknown as Record<string, File[]>}
                    existingDocumentos={existingMap}
                    onChange={(key, files) => setData(key, files)}
                    errors={errors}
                    disabled={processing}
                />
            ))}

            <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={onBack} disabled={processing}>
                    <ArrowLeft className="size-4" />
                    Anterior
                </Button>
                <Button type="submit" disabled={processing}>
                    {processing ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Finalizar registro
                </Button>
            </div>
        </form>
    );
}
