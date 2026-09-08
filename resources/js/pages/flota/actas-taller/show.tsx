import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { CheckCircle2, Download, LoaderCircle, Pencil, Trash2, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import NovedadesEditor, { type NovedadLocal } from './components/NovedadesEditor';
import NovedadesTabla from './components/NovedadesTabla';
import SeccionFirmas from './components/SeccionFirmas';
import { type FirmaPadHandle } from './firma-pad';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Actas de Taller', href: '/modules/flota/actas-taller' },
    { title: 'Detalle', href: '#' },
];

const ESTADO_BADGE: Record<string, string> = {
    en_taller: 'bg-amber-100 text-amber-700',
    cerrada:   'bg-green-700 text-white',
    cancelada: 'bg-muted text-muted-foreground',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Fila({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid gap-0.5">
            <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
            <p className="text-sm font-medium text-foreground">{value ?? '—'}</p>
        </div>
    );
}

function Campo({ label, required, error, children }: {
    label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
    return (
        <div className="grid gap-1.5">
            <Label className="text-xs font-medium text-foreground">
                {label}{required && <span className="ml-0.5 text-red-500">*</span>}
            </Label>
            {children}
            {error && <p className="text-[11px] text-red-500">{error}</p>}
        </div>
    );
}

function SeccionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
            <div className="border-b border-sidebar-border/70 px-5 py-3.5 dark:border-sidebar-border">
                <p className="text-sm font-semibold text-foreground">{title}</p>
            </div>
            <div className="px-5 py-4">{children}</div>
        </div>
    );
}

// ─── Mapeo novedad del backend → NovedadLocal ─────────────────────────────────

function toLocal(nov: any): NovedadLocal {
    return {
        id:                   nov.id ?? null,
        titulo:               nov.titulo ?? '',
        descripcion:          nov.descripcion ?? '',
        categoria:            nov.categoria ?? '',
        prioridad:            nov.prioridad ?? 'media',
        estado:               nov.estado ?? 'pendiente',
        responsable:          nov.responsable ?? '',
        fecha_reporte:        nov.fecha_reporte ?? '',
        fecha_solucion:       nov.fecha_solucion ?? '',
        realizada:            nov.estado === 'solucionado',
        observacion_solucion: nov.observacion_solucion ?? '',
        evidencias:           [],
    };
}

// ─── Página ───────────────────────────────────────────────────────────────────

interface Props { acta: any; vehiculos: string[]; colaboradores: any[] }

export default function ActasTallerShow({ acta, vehiculos }: Props) {

    const [editando,        setEditando]        = useState(false);
    const [confirmEliminar, setConfirmEliminar] = useState(false);
    const [processing,      setProcessing]      = useState(false);
    const [errors,          setErrors]          = useState<Record<string, string>>({});

    // Flash
    const { props } = usePage<{ flash?: { status?: string } }>();
    const flashStatus = (props as any).flash?.status ?? (props as any).status ?? null;
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    useEffect(() => {
        if (flashStatus) {
            setSuccessMsg(flashStatus);
            setEditando(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [flashStatus]);

    // Campos editables
    const [placa,         setPlaca]         = useState(acta.placa ?? '');
    const [fechaEntrega,  setFechaEntrega]  = useState(acta.fecha_entrega_raw ?? acta.fecha_entrega ?? '');
    const [fechaEstimada, setFechaEstimada] = useState(acta.fecha_estimada_solucion_raw ?? acta.fecha_estimada_solucion ?? '');
    const [kilometraje,   setKilometraje]   = useState(String(acta.kilometraje_entrada ?? ''));
    const [combustible,   setCombustible]   = useState(String(acta.combustible ?? ''));
    const [motivoIngreso, setMotivoIngreso] = useState(acta.motivo_ingreso ?? '');
    const [quienReporta,  setQuienReporta]  = useState(acta.quien_reporta ?? '');
    const [estadoActa,    setEstadoActa]    = useState(acta.estado_acta ?? 'en_taller');
    const [nombreEntrega, setNombreEntrega] = useState(acta.nombre_entrega ?? '');
    const [cargoEntrega,  setCargoEntrega]  = useState(acta.cargo_entrega ?? '');
    const [idEntrega,     setIdEntrega]     = useState(acta.identificacion_entrega ?? '');
    const [telEntrega,    setTelEntrega]    = useState(acta.telefono_entrega ?? '');
    const [nombreRecibe,  setNombreRecibe]  = useState(acta.nombre_recibe ?? '');
    const [novedades,     setNovedades]     = useState<NovedadLocal[]>((acta.novedades ?? []).map(toLocal));

    // Sincroniza estado_acta cuando cambian las novedades
    useEffect(() => {
        if (!editando) return;
        const todas = novedades.length > 0 && novedades.every(n => n.realizada);
        setEstadoActa(todas ? 'cerrada' : 'en_taller');
    }, [novedades, editando]);

    // Novedades helpers
    const novVacia = (): NovedadLocal => ({
        id: null, titulo: '', descripcion: '', categoria: '', prioridad: 'media',
        estado: 'pendiente', responsable: '',
        fecha_reporte: new Date().toISOString().split('T')[0],
        fecha_solucion: '', realizada: false, observacion_solucion: '', evidencias: [],
    });
    const agregarNovedad       = () => setNovedades(p => [...p, novVacia()]);
    const quitarNovedad        = (i: number) => setNovedades(p => p.filter((_, idx) => idx !== i));
    const actualizarNovedad    = (i: number, campo: keyof Omit<NovedadLocal, 'evidencias'>, valor: string) =>
        setNovedades(p => { const c = [...p]; c[i] = { ...c[i], [campo]: valor }; return c; });
    const toggleRealizada      = (i: number) =>
        setNovedades(p => { const c = [...p]; c[i] = { ...c[i], realizada: !c[i].realizada }; return c; });
    const actualizarObservacion = (i: number, valor: string) =>
        setNovedades(p => { const c = [...p]; c[i] = { ...c[i], observacion_solucion: valor }; return c; });
    const agregarEvidencia     = (i: number, file: File) => {
        const preview = URL.createObjectURL(file);
        setNovedades(p => { const c = [...p]; c[i] = { ...c[i], evidencias: [...c[i].evidencias, { file, preview, etiqueta: '' }] }; return c; });
    };
    const quitarEvidencia      = (i: number, ei: number) =>
        setNovedades(p => { const c = [...p]; c[i] = { ...c[i], evidencias: c[i].evidencias.filter((_, idx) => idx !== ei) }; return c; });

    // Refs firmas
    const firmaEntregaRef = useRef<FirmaPadHandle>(null);
    const firmaRecibeRef  = useRef<FirmaPadHandle>(null);

    const canvasToBase64 = async (ref: React.RefObject<FirmaPadHandle | null>): Promise<string | null> => {
        const file = await ref.current?.getFile();
        if (!file) return null;
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });
    };

    const cancelarEdicion = () => {
        // Restaura valores originales
        setPlaca(acta.placa ?? '');
        setFechaEntrega(acta.fecha_entrega_raw ?? acta.fecha_entrega ?? '');
        setFechaEstimada(acta.fecha_estimada_solucion_raw ?? acta.fecha_estimada_solucion ?? '');
        setKilometraje(String(acta.kilometraje_entrada ?? ''));
        setCombustible(String(acta.combustible ?? ''));
        setMotivoIngreso(acta.motivo_ingreso ?? '');
        setQuienReporta(acta.quien_reporta ?? '');
        setEstadoActa(acta.estado_acta ?? 'en_taller');
        setNombreEntrega(acta.nombre_entrega ?? '');
        setNombreRecibe(acta.nombre_recibe ?? '');
        setNovedades((acta.novedades ?? []).map(toLocal));
        setErrors({});
        setEditando(false);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        setErrors({});

        const fd = new FormData();
        fd.append('_method',                 'PUT');
        fd.append('placa',                   placa);
        fd.append('fecha_entrega',           fechaEntrega);
        fd.append('fecha_estimada_solucion', fechaEstimada);
        fd.append('kilometraje_entrada',     kilometraje);
        fd.append('combustible',             combustible);
        fd.append('motivo_ingreso',          motivoIngreso);
        fd.append('quien_reporta',           quienReporta);
        fd.append('estado_acta',             estadoActa);
        fd.append('nombre_entrega',          nombreEntrega);
        fd.append('nombre_recibe',           nombreRecibe);

        novedades.forEach((nov, i) => {
            if (nov.id) fd.append(`novedades[${i}][id]`, String(nov.id));
            (['titulo', 'descripcion', 'categoria', 'prioridad', 'responsable', 'fecha_reporte', 'fecha_solucion'] as const)
                .forEach(k => fd.append(`novedades[${i}][${k}]`, nov[k] ?? ''));
            fd.append(`novedades[${i}][estado]`,               nov.realizada ? 'solucionado' : 'pendiente');
            fd.append(`novedades[${i}][observacion_solucion]`, nov.observacion_solucion ?? '');
            nov.evidencias.forEach((ev, ei) => {
                fd.append(`evidencias_novedad_${i}[${ei}]`, ev.file);
                fd.append(`etiquetas_novedad_${i}[${ei}]`,  ev.etiqueta);
            });
        });

        const b64Entrega = await canvasToBase64(firmaEntregaRef);
        const b64Recibe  = await canvasToBase64(firmaRecibeRef);
        if (b64Entrega) fd.append('firma_entrega', b64Entrega);
        if (b64Recibe)  fd.append('firma_recibe',  b64Recibe);

        router.post(route('flota.actas-taller.update', acta.id), fd as any, {
            forceFormData: true,
            onError:  (errs) => { setErrors(errs); setProcessing(false); },
            onFinish: () => setProcessing(false),
        });
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Acta ${acta.numero_acta}`} />
            <form onSubmit={submit}>
                <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">

                    {/* Banner éxito */}
                    {successMsg && (
                        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4 dark:border-green-800/40 dark:bg-green-900/10">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-700">
                                <CheckCircle2 className="size-4 text-white" />
                            </div>
                            <p className="flex-1 text-sm font-semibold text-green-800 dark:text-green-300">{successMsg}</p>
                            <button type="button" onClick={() => setSuccessMsg(null)} className="text-green-400 hover:text-green-600">
                                <XCircle className="size-4" />
                            </button>
                        </div>
                    )}

                    {/* Cabecera */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-foreground">Acta {acta.numero_acta}</h1>
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${ESTADO_BADGE[estadoActa] ?? 'bg-muted text-muted-foreground'}`}>
                                    {estadoActa === 'cerrada' ? 'Cerrada' : estadoActa === 'en_taller' ? 'En taller' : 'Cancelada'}
                                </span>
                            </div>
                            <p className="mt-0.5 text-sm text-muted-foreground">Gestión de mantenimiento · Vehículo {acta.placa}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('flota.actas-taller.index')}>← Volver</Link>
                            </Button>
                            <Button variant="outline" size="sm" asChild className="gap-1.5">
                                <a href={route('flota.actas-taller.exportar-acta-pdf', acta.id)}>
                                    <Download className="size-3.5" /> PDF
                                </a>
                            </Button>
                            {!editando ? (
                                <Button type="button" size="sm" onClick={() => setEditando(true)}
                                    className="gap-1.5 bg-green-700 hover:bg-green-800 text-white">
                                    <Pencil className="size-3.5" /> Editar
                                </Button>
                            ) : (
                                <>
                                    <Button type="button" variant="outline" size="sm" onClick={cancelarEdicion} className="gap-1.5">
                                        <X className="size-3.5" /> Cancelar
                                    </Button>
                                    <Button type="submit" size="sm" disabled={processing}
                                        className="gap-1.5 bg-green-700 hover:bg-green-800 text-white">
                                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                                        Guardar cambios
                                    </Button>
                                </>
                            )}
                            <Button type="button" variant="outline" size="sm"
                                className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setConfirmEliminar(true)}>
                                <Trash2 className="size-3.5" /> Eliminar
                            </Button>
                        </div>
                    </div>

                    {/* Información del vehículo */}
                    <SeccionCard title="Información del Vehículo">
                        {editando ? (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <Campo label="Placa" required error={errors['placa']}>
                                    <select value={placa} onChange={e => setPlaca(e.target.value)}
                                        className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                                        <option value="">Seleccionar placa</option>
                                        {vehiculos.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </Campo>
                                <Campo label="Fecha de reporte" required error={errors['fecha_entrega']}>
                                    <Input type="datetime-local" value={fechaEntrega}
                                        onChange={e => setFechaEntrega(e.target.value)} className="h-9 text-sm" />
                                </Campo>
                                <Campo label="Kilometraje entrada" error={errors['kilometraje_entrada']}>
                                    <Input type="number" min={0} value={kilometraje}
                                        onChange={e => setKilometraje(e.target.value)} className="h-9 text-sm" placeholder="Ej: 125000" />
                                </Campo>
                                <Campo label="Combustible (%)" error={errors['combustible']}>
                                    <Input type="number" min={0} max={100} value={combustible}
                                        onChange={e => setCombustible(e.target.value)} className="h-9 text-sm" placeholder="0-100" />
                                </Campo>
                                <Campo label="Motivo de ingreso" error={errors['motivo_ingreso']}>
                                    <Input value={motivoIngreso} onChange={e => setMotivoIngreso(e.target.value)}
                                        className="h-9 text-sm" placeholder="Describe el motivo..." />
                                </Campo>
                                <Campo label="Quien reporta" error={errors['quien_reporta']}>
                                    <Input value={quienReporta} onChange={e => setQuienReporta(e.target.value)}
                                        className="h-9 text-sm" placeholder="Nombre de quien reporta..." />
                                </Campo>
                                <Campo label="Fecha estimada solución" error={errors['fecha_estimada_solucion']}>
                                    <Input type="datetime-local" value={fechaEstimada}
                                        onChange={e => setFechaEstimada(e.target.value)} className="h-9 text-sm" />
                                </Campo>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <Fila label="Placa" value={<span className="font-mono font-bold text-green-700">{acta.placa}</span>} />
                                <Fila label="Fecha de entrega"        value={acta.fecha_entrega} />
                                <Fila label="Kilometraje entrada"     value={acta.kilometraje_entrada ? `${Number(acta.kilometraje_entrada).toLocaleString()} km` : '—'} />
                                <Fila label="Combustible"             value={acta.combustible !== null ? `${acta.combustible}%` : '—'} />
                                <Fila label="Taller"                  value={acta.taller} />
                                <Fila label="Motivo de ingreso"       value={acta.motivo_ingreso} />
                                <Fila label="Quien reporta"           value={acta.quien_reporta} />
                                <Fila label="Fecha estimada solución" value={acta.fecha_estimada_solucion} />
                                {acta.fecha_cierre       && <Fila label="Fecha de cierre"     value={acta.fecha_cierre} />}
                                {acta.kilometraje_salida && <Fila label="Kilometraje salida"  value={`${Number(acta.kilometraje_salida).toLocaleString()} km`} />}
                            </div>
                        )}
                    </SeccionCard>

                    {/* Novedades */}
                    <SeccionCard title={`Novedades Reportadas (${novedades.length})`}>
                        {editando ? (
                            <NovedadesEditor
                                novedades={novedades}
                                onAgregar={agregarNovedad}
                                onQuitar={quitarNovedad}
                                onActualizar={actualizarNovedad}
                                onToggleRealizada={toggleRealizada}
                                onActualizarObservacion={actualizarObservacion}
                                onAgregarEvidencia={agregarEvidencia}
                                onQuitarEvidencia={quitarEvidencia}
                                errors={errors}
                            />
                        ) : (
                            novedades.length > 0
                                ? <NovedadesTabla novedades={novedades} />
                                : <p className="text-sm text-muted-foreground">Sin novedades registradas.</p>
                        )}
                    </SeccionCard>

                    {/* Estado del acta (solo edición) */}
                    {editando && (
                        <div className={`flex items-center gap-3 rounded-xl border px-5 py-3 ${
                            estadoActa === 'cerrada'
                                ? 'border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10'
                                : 'border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10'
                        }`}>
                            <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${estadoActa === 'cerrada' ? 'bg-green-700' : 'bg-amber-500'}`}>
                                <svg className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                    {estadoActa === 'cerrada'
                                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        : <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-foreground">
                                    Estado del acta:{' '}
                                    <span className={estadoActa === 'cerrada' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>
                                        {estadoActa === 'cerrada' ? 'Cerrada' : 'En taller'}
                                    </span>
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                    {estadoActa === 'cerrada'
                                        ? 'Todas las novedades están realizadas.'
                                        : 'Se cerrará cuando todas las novedades estén marcadas como realizadas.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Firmas */}
                    <SeccionCard title="Firmas">
                        {editando ? (
                            <SeccionFirmas
                                mode="edit"
                                nombreEntrega={nombreEntrega}
                                onNombreEntrega={setNombreEntrega}
                                nombreRecibe={nombreRecibe}
                                onNombreRecibe={setNombreRecibe}
                                firmaEntregaRef={firmaEntregaRef}
                                firmaRecibeRef={firmaRecibeRef}
                                errors={errors}
                            />
                        ) : (
                            <SeccionFirmas
                                mode="read"
                                nombreEntrega={acta.nombre_entrega}
                                cargoEntrega={acta.cargo_entrega}
                                idEntrega={acta.identificacion_entrega}
                                telefonoEntrega={acta.telefono_entrega}
                                firmaEntrega={acta.firma_entrega}
                                nombreRecibe={acta.nombre_recibe}
                                cargoRecibe={acta.cargo_recibe}
                                firmaRecibe={acta.firma_recibe}
                            />
                        )}
                    </SeccionCard>

                    {/* Diagnóstico y solución (solo lectura) */}
                    {!editando && (acta.diagnostico_taller || acta.solucion_realizada) && (
                        <SeccionCard title="Diagnóstico y Solución">
                            <div className="grid gap-4 sm:grid-cols-2">
                                {acta.diagnostico_taller && (
                                    <div>
                                        <p className="mb-1 text-[10px] font-semibold text-muted-foreground">Diagnóstico del taller</p>
                                        <p className="whitespace-pre-line text-sm text-foreground">{acta.diagnostico_taller}</p>
                                    </div>
                                )}
                                {acta.solucion_realizada && (
                                    <div>
                                        <p className="mb-1 text-[10px] font-semibold text-muted-foreground">Solución realizada</p>
                                        <p className="whitespace-pre-line text-sm text-foreground">{acta.solucion_realizada}</p>
                                    </div>
                                )}
                            </div>
                            {acta.observaciones && (
                                <div className="mt-4 border-t border-sidebar-border/70 pt-3 dark:border-sidebar-border">
                                    <p className="mb-1 text-[10px] font-semibold text-muted-foreground">Observaciones</p>
                                    <p className="text-sm text-foreground">{acta.observaciones}</p>
                                </div>
                            )}
                        </SeccionCard>
                    )}

                    {/* Evidencias */}
                    {acta.evidencias?.length > 0 && (
                        <SeccionCard title={`Evidencia Fotográfica (${acta.evidencias.length})`}>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                                {acta.evidencias.map((ev: any) => (
                                    <div key={ev.id}>
                                        <img src={ev.url} alt={ev.etiqueta ?? 'Evidencia'}
                                            className="h-28 w-full rounded-xl object-cover border border-sidebar-border/70 shadow-sm" />
                                        {ev.etiqueta && <p className="mt-1 text-center text-[10px] text-muted-foreground">{ev.etiqueta}</p>}
                                    </div>
                                ))}
                            </div>
                        </SeccionCard>
                    )}

                </div>
            </form>

            {/* Modal eliminar */}
            {confirmEliminar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-sm rounded-xl border border-sidebar-border/70 bg-popover p-6 shadow-md dark:border-sidebar-border">
                        <p className="text-sm font-semibold text-foreground">¿Eliminar el acta {acta.numero_acta}?</p>
                        <p className="mt-1 text-xs text-muted-foreground">Esta acción no se puede deshacer.</p>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setConfirmEliminar(false)}>Cancelar</Button>
                            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => router.delete(route('flota.actas-taller.destroy', acta.id))}>
                                Eliminar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
