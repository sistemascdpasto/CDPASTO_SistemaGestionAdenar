import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { CheckCircle2, ChevronDown, ChevronUp, LoaderCircle, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import NovedadesEditor, { type NovedadLocal } from './components/NovedadesEditor';
import SeccionFirmas from './components/SeccionFirmas';
import { type FirmaPadHandle } from './firma-pad';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Actas de Taller', href: '/modules/flota/actas-taller' },
    { title: 'Nueva Acta', href: '/modules/flota/actas-taller/create' },
];

interface Colaborador { id: number; nombre_completo: string; cargo: string; cedula: string; celular: string }

interface Props {
    vehiculos: string[];
    colaboradores: Colaborador[];
    numero_acta: string;
    fecha_actual: string;
    usuario_nombre: string;
}

// ─── Helpers locales ──────────────────────────────────────────────────────────

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

function Seccion({ titulo, children, defaultOpen = true }: {
    titulo: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
            <button type="button" onClick={() => setOpen(v => !v)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-muted/60 transition-colors">
                <p className="text-sm font-semibold text-foreground">{titulo}</p>
                {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>
            {open && <div className="border-t border-sidebar-border/70 dark:border-sidebar-border px-5 py-4">{children}</div>}
        </div>
    );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ActasTallerCreate({ vehiculos, colaboradores, numero_acta, fecha_actual, usuario_nombre }: Props) {

    // Flash
    const { props } = usePage<{ flash?: { status?: string } }>();
    const flashStatus = (props as any).flash?.status ?? (props as any).status ?? null;
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    useEffect(() => {
        if (flashStatus) { setSuccessMsg(flashStatus); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }, [flashStatus]);

    // Campos del acta
    const [placa,          setPlaca]          = useState('');
    const [fechaEntrega,   setFechaEntrega]   = useState(fecha_actual);
    const [fechaEstimada,  setFechaEstimada]  = useState('');
    const [kilometraje,    setKilometraje]    = useState('');
    const [combustible,    setCombustible]    = useState('');
    const [motivoIngreso,  setMotivoIngreso]  = useState('');
    const [quienReporta,   setQuienReporta]   = useState(usuario_nombre);
    const [estadoActa,     setEstadoActa]     = useState('pendiente');
    const [nombreEntrega,  setNombreEntrega]  = useState(usuario_nombre);
    const [cargoEntrega,   setCargoEntrega]   = useState('');
    const [idEntrega,      setIdEntrega]      = useState('');
    const [telefonoEntrega,setTelefonoEntrega]= useState('');
    const [nombreRecibe,   setNombreRecibe]   = useState('');

    // Novedades
    const [novedades, setNovedades] = useState<NovedadLocal[]>([]);
    const [processing, setProcessing] = useState(false);
    const [errors,     setErrors]     = useState<Record<string, string>>({});

    const novVacia = (): NovedadLocal => ({
        titulo: '', descripcion: '', categoria: '', prioridad: 'media',
        estado: 'pendiente', responsable: '',
        fecha_reporte: new Date().toISOString().split('T')[0],
        fecha_solucion: '', realizada: false, observacion_solucion: '', evidencias: [],
    });

    const agregarNovedad  = () => setNovedades(prev => [...prev, novVacia()]);
    const quitarNovedad   = (i: number) => setNovedades(prev => prev.filter((_, idx) => idx !== i));
    const actualizarNovedad = (i: number, campo: keyof Omit<NovedadLocal, 'evidencias'>, valor: string) =>
        setNovedades(prev => { const c = [...prev]; c[i] = { ...c[i], [campo]: valor }; return c; });
    const toggleRealizada = (i: number) =>
        setNovedades(prev => { const c = [...prev]; c[i] = { ...c[i], realizada: !c[i].realizada }; return c; });
    const actualizarObservacion = (i: number, valor: string) =>
        setNovedades(prev => { const c = [...prev]; c[i] = { ...c[i], observacion_solucion: valor }; return c; });
    const agregarEvidencia = (i: number, file: File) => {
        const preview = URL.createObjectURL(file);
        setNovedades(prev => { const c = [...prev]; c[i] = { ...c[i], evidencias: [...c[i].evidencias, { file, preview, etiqueta: '' }] }; return c; });
    };
    const quitarEvidencia = (i: number, ei: number) =>
        setNovedades(prev => { const c = [...prev]; c[i] = { ...c[i], evidencias: c[i].evidencias.filter((_, idx) => idx !== ei) }; return c; });

    // Sincroniza estado acta con novedades
    useEffect(() => {
        const todas = novedades.length > 0 && novedades.every(n => n.realizada);
        setEstadoActa(todas ? 'cerrada' : 'pendiente');
    }, [novedades]);

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

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        setErrors({});

        const fd = new FormData();
        fd.append('placa',                   placa);
        fd.append('fecha_entrega',           fechaEntrega);
        fd.append('fecha_estimada_solucion', fechaEstimada);
        fd.append('kilometraje_entrada',     kilometraje);
        fd.append('combustible',             combustible);
        fd.append('motivo_ingreso',          motivoIngreso);
        fd.append('quien_reporta',           quienReporta);
        fd.append('estado_acta',             estadoActa);
        fd.append('nombre_entrega',          nombreEntrega);
        fd.append('cargo_entrega',           cargoEntrega);
        fd.append('identificacion_entrega',  idEntrega);
        fd.append('telefono_entrega',        telefonoEntrega);
        fd.append('nombre_recibe',           nombreRecibe);

        novedades.forEach((nov, i) => {
            (['titulo', 'descripcion', 'categoria', 'prioridad', 'responsable', 'fecha_reporte', 'fecha_solucion'] as const)
                .forEach(k => fd.append(`novedades[${i}][${k}]`, nov[k] ?? ''));
            fd.append(`novedades[${i}][estado]`,    nov.realizada ? 'solucionado' : 'pendiente');
            fd.append(`novedades[${i}][realizada]`, nov.realizada ? '1' : '0');
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

        router.post(route('flota.actas-taller.store'), fd as any, {
            forceFormData: true,
            onError:  (errs) => { setErrors(errs); setProcessing(false); },
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Nueva Acta de Taller" />
            <form onSubmit={submit} encType="multipart/form-data">
                <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">

                    {/* Banner éxito */}
                    {successMsg && (
                        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4 dark:border-green-800/40 dark:bg-green-900/10">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-700">
                                <CheckCircle2 className="size-4 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-green-800 dark:text-green-300">{successMsg}</p>
                                <p className="text-[11px] text-green-600 dark:text-green-400">El formulario está listo para una nueva acta.</p>
                            </div>
                            <button type="button" onClick={() => setSuccessMsg(null)}
                                className="text-green-400 hover:text-green-600 transition-colors">
                                <XCircle className="size-4" />
                            </button>
                        </div>
                    )}

                    {/* Título */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Nueva Acta de Taller</h1>
                            <p className="mt-0.5 text-sm text-muted-foreground">Nº {numero_acta}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                                <Link href={route('flota.actas-taller.index')}>Cancelar</Link>
                            </Button>
                            <Button type="submit" size="sm" disabled={processing}
                                className="gap-1.5 bg-green-700 hover:bg-green-800 text-white">
                                {processing && <LoaderCircle className="size-4 animate-spin" />}
                                Guardar Acta
                            </Button>
                        </div>
                    </div>

                    {/* Información del vehículo */}
                    <Seccion titulo="Información del Vehículo">
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
                                    className="h-9 text-sm" placeholder="Describe el motivo de ingreso al taller..." />
                            </Campo>
                            <Campo label="Quien reporta" error={errors['quien_reporta']}>
                                <select
                                    value={quienReporta}
                                    onChange={e => {
                                        const col = colaboradores.find(c => c.nombre_completo === e.target.value);
                                        setQuienReporta(e.target.value);
                                        if (col) {
                                            setNombreEntrega(col.nombre_completo);
                                            setCargoEntrega(col.cargo);
                                            setIdEntrega(col.cedula);
                                            setTelefonoEntrega(col.celular);
                                        }
                                    }}
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                                    <option value="">Seleccionar colaborador</option>
                                    {colaboradores.map(c => (
                                        <option key={c.id} value={c.nombre_completo}>
                                            {c.nombre_completo} · {c.cargo}
                                        </option>
                                    ))}
                                </select>
                            </Campo>                            <Campo label="Fecha estimada solución" error={errors['fecha_estimada_solucion']}>
                                <Input type="datetime-local" value={fechaEstimada}
                                    onChange={e => setFechaEstimada(e.target.value)} className="h-9 text-sm" />
                            </Campo>
                        </div>
                    </Seccion>

                    {/* Novedades */}
                    <Seccion titulo={`Novedades Reportadas (${novedades.length})`}>
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
                    </Seccion>

                    {/* Estado del acta */}
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
                                    {estadoActa === 'cerrada' ? 'Cerrada' : 'Pendiente'}
                                </span>
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                {estadoActa === 'cerrada'
                                    ? 'Todas las novedades están realizadas.'
                                    : 'El acta se cerrará automáticamente cuando todas las novedades estén marcadas como realizadas.'}
                            </p>
                        </div>
                    </div>

                    {/* Firmas */}
                    <Seccion titulo="Firmas">
                        <SeccionFirmas
                            mode="edit"
                            nombreEntrega={nombreEntrega}
                            onNombreEntrega={setNombreEntrega}
                            cargoEntrega={cargoEntrega}
                            onCargoEntrega={setCargoEntrega}
                            idEntrega={idEntrega}
                            onIdEntrega={setIdEntrega}
                            telefonoEntrega={telefonoEntrega}
                            onTelefonoEntrega={setTelefonoEntrega}
                            nombreRecibe={nombreRecibe}
                            onNombreRecibe={setNombreRecibe}
                            firmaEntregaRef={firmaEntregaRef}
                            firmaRecibeRef={firmaRecibeRef}
                            errors={errors}
                        />
                    </Seccion>

                    {/* Botones */}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link href={route('flota.actas-taller.index')}>Cancelar</Link>
                        </Button>
                        <Button type="submit" size="sm" disabled={processing}
                            className="gap-1.5 bg-green-700 hover:bg-green-800 text-white px-6">
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Guardar Acta
                        </Button>
                    </div>

                </div>
            </form>
        </AppLayout>
    );
}
