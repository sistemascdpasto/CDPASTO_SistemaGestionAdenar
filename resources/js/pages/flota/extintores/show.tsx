import { Button } from '@/components/ui/button';
import { FirmaPad, type FirmaPadHandle } from '@/components/firma-pad';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    CalendarClock,
    Camera,
    CheckCircle2,
    ClipboardCheck,
    ClipboardList,
    ClipboardX,
    Download,
    FileDown,
    FileText,
    FlameKindling,
    History,
    Image,
    Loader2,
    LogIn,
    LogOut,
    Pencil,
    Plus,
    QrCode,
    Trash2,
    Upload,
    X,
    XCircle,
    ZoomIn,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ─── Clases y Types ────────────────────────────────────────────────────────────

const SELECT_CLS =
    'h-9 w-full rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring';

const TEXTAREA_CLS =
    'rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none';

const hoy = () => new Date().toISOString().slice(0, 10);

interface ExtintorDetalle {
    id: number;
    numero_serie: string;
    qr_token: string | null;
    qr_url: string | null;
    tipo_agente: string | null;
    capacidad_kg: string | null;
    marca: string | null;
    fecha_fabricacion: string | null;
    fecha_vencimiento: string | null;
    fecha_creacion?: string | null;
    observaciones: string | null;
    vencido: boolean;
    condicion: string | null;
    agente_impulsor: string | null;
    parte_mantenimiento: string | null;
    senalizacion: string | null;
    demarcacion: string | null;
    funcionamiento: string | null;
    acceso: string | null;
    placa_actual: string | null;
    asignacion_activa_id: number | null;
    fecha_colocacion_actual: string | null;
    ultima_recarga: string | null;
    foto_url?: string | null;
}

interface Asignacion {
    id: number;
    extintor_id: number;
    placa: string;
    fecha_colocacion: string | null;
    fecha_retiro: string | null;
    activo: boolean;
    responsable_colocacion: string | null;
    responsable_retiro: string | null;
    observaciones_colocacion: string | null;
    observaciones_retiro: string | null;
    checklist_colocacion: Record<string, string>;
    checklist_retiro: Record<string, string>;
    coloco_nombre: string | null;
    retiro_nombre: string | null;
}

interface Evidencia {
    id: number;
    url: string;
    nombre_original: string | null;
    tipo_mime: string | null;
    es_pdf: boolean;
}

interface Inspeccion {
    id: number;
    extintor_id: number;
    tipo: string;
    tipo_label: string;
    fecha_inspeccion: string | null;
    responsable_inicio: string | null;
    responsable_periodico: string | null;
    condicion: string | null;
    tipo_agente: string | null;
    agente_impulsor: string | null;
    capacidad_kg: string | null;
    marca: string | null;
    parte_mantenimiento: string | null;
    partes_mantenimiento_lista: string[];
    senalizacion: string | null;
    demarcacion: string | null;
    funcionamiento: string | null;
    acceso: string | null;
    observaciones_inspeccion: string | null;
    incluye_recarga: boolean;
    fecha_recarga: string | null;
    fecha_proxima_recarga: string | null;
    observaciones_recarga: string | null;
    creador_nombre: string | null;
    firma_url?: string | null;
    evidencias: Evidencia[];
}

interface ParteMantenimiento {
    codigo: string;
    nombre: string;
}

interface FilaHistorial {
    id: string;
    fecha: string;
    tipo: string;
    tipo_label: string;
    es_inspeccion: boolean;
    inspeccion_id: number | null;
    condicion: string | null;
    tipo_agente: string | null;
    agente_impulsor: string | null;
    senalizacion: string | null;
    demarcacion: string | null;
    funcionamiento: string | null;
    acceso: string | null;
    parte_mantenimiento: string | null;
    observaciones: string | null;
}

interface FormInspeccion {
    tipo: string;
    fecha_inspeccion: string;
    responsable_inicio: string;
    responsable_periodico: string;
    condicion: string;
    tipo_agente: string;
    agente_impulsor: string;
    capacidad_kg: string;
    marca: string;
    parte_mantenimiento: string[];
    senalizacion: string;
    demarcacion: string;
    funcionamiento: string;
    acceso: string;
    observaciones_inspeccion: string;
    incluye_recarga: boolean;
    fecha_recarga: string;
    fecha_proxima_recarga: string;
    observaciones_recarga: string;
    registra_vehiculo: boolean;
    nueva_placa: string;
    observaciones_vehiculo: string;
    desasociar_previos_insp: boolean;
}

type ExtintorEnPlaca = {
    id: number;
    numero_serie: string;
    tipo_agente: string | null;
    capacidad_kg: string | null;
    marca: string | null;
    foto_url: string | null;
};

interface Props {
    extintor: ExtintorDetalle;
    asignaciones: Asignacion[];
    inspecciones: Inspeccion[];
    columnas_extra: string[];
    placas: string[];
    colaboradores: { id: number; nombre: string; cargo: string }[];
    tiene_inspeccion_inicio: boolean;
    usuario_nombre: string;
    // Calculado en el backend
    tipo_inspeccion: 'inicio' | 'periodica';
    ultima_recarga: string | null;
    inspeccion_defaults: FormInspeccion;
    partes_mantenimiento: ParteMantenimiento[];
    historial: FilaHistorial[];
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

function useBreadcrumbs(serie: string): BreadcrumbItem[] {
    return [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Flota', href: '/modules/flota' },
        { title: 'Extintores', href: '/modules/flota/extintores' },
        { title: serie, href: '#' },
    ];
}

// ─── Modal genérico ───────────────────────────────────────────────────────────

function Modal({ open, onClose, title, wide = false, children }: {
    open: boolean; onClose: () => void; title: string; wide?: boolean; children: React.ReactNode;
}) {
    useEffect(() => {
        if (!open) return;
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-6">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative z-10 w-full ${wide ? 'max-w-6xl' : 'max-w-4xl'} max-h-[95vh] overflow-y-auto rounded-2xl border border-sidebar-border/70 bg-card shadow-2xl dark:border-sidebar-border mx-4`}>
                <div className="flex items-center justify-between border-b border-sidebar-border/70 px-6 py-4 dark:border-sidebar-border">
                    <h2 className="text-base font-semibold text-foreground">{title}</h2>
                    <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="size-5" />
                    </button>
                </div>
                <div className="px-6 py-5">{children}</div>
            </div>
        </div>
    );
}

// ─── Campo de error reutilizable ──────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
    return msg ? <p className="text-[10px] text-red-500">{msg}</p> : null;
}

// ─── Checklist dinámico ───────────────────────────────────────────────────────

function ChecklistSection({ columnas, values, onChange, label }: {
    columnas: string[]; values: Record<string, string>;
    onChange: (col: string, val: string) => void; label: string;
}) {
    if (columnas.length === 0) return null;
    return (
        <div className="rounded-xl border border-dashed border-sidebar-border/70 dark:border-sidebar-border p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <ClipboardCheck className="size-3.5" /> {label}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {columnas.map(col => (
                    <div key={col} className="grid gap-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground truncate" title={col}>{col}</Label>
                        <Input value={values[col] ?? ''} onChange={e => onChange(col, e.target.value)}
                            placeholder="—" className="h-9 text-sm" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Checklist solo lectura ───────────────────────────────────────────────────

function ChecklistReadonly({ data, label, icon }: {
    data: Record<string, string>; label: string; icon: React.ReactNode;
}) {
    const entries = Object.entries(data).filter(([, v]) => v);
    if (entries.length === 0) return null;
    return (
        <div className="mt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                {icon} {label}
            </p>
            <div className="flex flex-wrap gap-2">
                {entries.map(([k, v]) => (
                    <span key={k} className="inline-flex items-center gap-1 rounded-md border border-sidebar-border/50 dark:border-sidebar-border px-2 py-0.5 text-[11px] text-foreground">
                        <span className="text-muted-foreground">{k}:</span> {v}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ─── Galería de evidencias ────────────────────────────────────────────────────

function GaleriaEvidencias({ evidencias }: { evidencias: Evidencia[] }) {
    if (evidencias.length === 0) return null;
    return (
        <div className="mt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Evidencias ({evidencias.length})
            </p>
            <div className="flex flex-wrap gap-2">
                {evidencias.map(ev => (
                    <a key={ev.id} href={ev.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-sidebar-border/60 dark:border-sidebar-border bg-muted/40 px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted/70 transition-colors">
                        {ev.es_pdf
                            ? <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                            : <Image className="size-3.5 shrink-0 text-muted-foreground" />
                        }
                        <span className="max-w-[120px] truncate">{ev.nombre_original ?? 'Archivo'}</span>
                    </a>
                ))}
            </div>
        </div>
    );
}

// ─── Combobox colaboradores ───────────────────────────────────────────────────

function ComboColaborador({ colaboradores, value, onChange, placeholder = 'Buscar colaborador…' }: {
    colaboradores: { id: number; nombre: string; cargo: string }[];
    value: string; onChange: (nombre: string) => void; placeholder?: string;
}) {
    const [query, setQuery] = useState(value);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => { setQuery(value); }, [value]);
    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const filtrados = query.trim().length === 0
        ? colaboradores.slice(0, 50)
        : colaboradores.filter(c =>
            c.nombre.toLowerCase().includes(query.toLowerCase()) ||
            c.cargo.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 50);

    return (
        <div ref={ref} className="relative">
            <Input value={query} placeholder={placeholder} className="h-9 text-sm"
                onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)} autoComplete="off" />
            {open && filtrados.length > 0 && (
                <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-card shadow-xl">
                    {filtrados.map(c => (
                        <button key={c.id} type="button"
                            className="flex w-full flex-col px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                            onMouseDown={e => { e.preventDefault(); setQuery(c.nombre); onChange(c.nombre); setOpen(false); }}>
                            <span className="text-sm font-medium text-foreground">{c.nombre}</span>
                            {c.cargo && <span className="text-[11px] text-muted-foreground">{c.cargo}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Selector de archivos ─────────────────────────────────────────────────────

function FileSelector({ onChange }: { onChange: (files: File[]) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [selected, setSelected] = useState<File[]>([]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        setSelected(files); onChange(files);
    };
    const remove = (i: number) => {
        const next = selected.filter((_, idx) => idx !== i);
        setSelected(next); onChange(next);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sidebar-border/70 dark:border-sidebar-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                onClick={() => inputRef.current?.click()}>
                <Plus className="size-4" />
                <span>Agregar fotos o PDF (máx. 10 MB c/u)</span>
                <input ref={inputRef} type="file" multiple
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                    className="hidden" onChange={handleChange} />
            </div>
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selected.map((f, i) => (
                        <span key={i} className="flex items-center gap-1.5 rounded-lg border border-sidebar-border/50 dark:border-sidebar-border bg-muted/40 px-2.5 py-1 text-[11px] text-foreground">
                            {f.type.includes('pdf')
                                ? <FileText className="size-3.5 text-muted-foreground" />
                                : <Image className="size-3.5 text-muted-foreground" />
                            }
                            <span className="max-w-[120px] truncate">{f.name}</span>
                            <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="size-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Confirmación inline de eliminación ───────────────────────────────────────

function ConfirmarEliminar({ texto, onConfirm, onCancel }: {
    texto: string; onConfirm: () => void; onCancel: () => void;
}) {
    return (
        <span className="flex items-center gap-1">
            <span className="text-[10px] font-semibold text-red-600 whitespace-nowrap">{texto}</span>
            <button type="button" onClick={onConfirm}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-600 text-white hover:bg-red-700">
                Sí
            </button>
            <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
            </button>
        </span>
    );
}

// ─── Página de detalle ────────────────────────────────────────────────────────

export default function ExtintorShow({
    extintor, asignaciones, inspecciones, columnas_extra, placas, colaboradores,
    tipo_inspeccion, ultima_recarga: ultimaRecarga, inspeccion_defaults,
    partes_mantenimiento, historial,
}: Props) {
    const breadcrumbs = useBreadcrumbs(extintor.numero_serie);

    // Flash
    const { props } = usePage<{ flash?: { success?: string }; status?: string | { message?: string } }>();
    const flashMsg = (() => {
        const s = props.status;
        if (!s) return props.flash?.success ?? null;
        if (typeof s === 'string') return s;
        return s.message ?? null;
    })();

    // Próxima recarga — de la inspección más reciente que registró recarga
    const proximaRecarga = inspecciones
        .filter(i => i.fecha_recarga)
        .sort((a, b) => (b.fecha_recarga ?? '').localeCompare(a.fecha_recarga ?? ''))
        [0]?.fecha_proxima_recarga ?? null;
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    useEffect(() => { if (flashMsg) setSuccessMsg(flashMsg); }, [flashMsg]);

    const nombreParte = (codigo: string) =>
        partes_mantenimiento.find(p => p.codigo === codigo)?.nombre ?? codigo;

    // ── Formulario inspección (nuevo / editar) ────────────────────────────────
    const [modalInspeccion, setModalInspeccion] = useState(false);
    const [editInspeccion, setEditInspeccion] = useState<Inspeccion | null>(null);
    const [savingInspeccion, setSavingInspeccion] = useState(false);
    const [errorsInspeccion, setErrorsInspeccion] = useState<Record<string, string>>({});
    const [archivosInspeccion, setArchivosInspeccion] = useState<File[]>([]);

    const firmaPadRef = useRef<FirmaPadHandle>(null);
    const [firmaGuardadaUrl, setFirmaGuardadaUrl] = useState<string | null>(null);
    const [modalConfirmarFirma, setModalConfirmarFirma] = useState(false);
    const [modalFirmaManual, setModalFirmaManual] = useState(false);
    const [desplegarChecklist, setDesplegarChecklist] = useState(false);
    const [hayMantenimiento, setHayMantenimiento] = useState(false);
    const [modoEdicion, setModoEdicion] = useState<'condiciones' | 'inspeccion' | null>(null);

    // Advertencia de ocupación de placa dentro del formulario de inspección
    const [extintoresEnPlacaInsp, setExtintoresEnPlacaInsp] = useState<ExtintorEnPlaca[]>([]);
    const [cargandoPlacaInsp, setCargandoPlacaInsp] = useState(false);

    const [formInspeccion, setFormInspeccion] = useState<FormInspeccion>(inspeccion_defaults);
    const setInsp = (k: keyof FormInspeccion, v: string | boolean | string[]) =>
        setFormInspeccion(p => ({ ...p, [k]: v }));

    const formDesdeInspeccion = (ins: Inspeccion): FormInspeccion => ({
        ...inspeccion_defaults,
        tipo: ins.tipo,
        fecha_inspeccion: ins.fecha_inspeccion ?? '',
        responsable_inicio: ins.responsable_inicio ?? '',
        responsable_periodico: ins.responsable_periodico ?? '',
        condicion: ins.condicion ?? '',
        tipo_agente: ins.tipo_agente ?? '',
        agente_impulsor: ins.agente_impulsor ?? '',
        capacidad_kg: ins.capacidad_kg ?? '',
        marca: ins.marca ?? '',
        parte_mantenimiento: ins.partes_mantenimiento_lista,
        senalizacion: ins.senalizacion ?? '',
        demarcacion: ins.demarcacion ?? '',
        funcionamiento: ins.funcionamiento ?? '',
        acceso: ins.acceso ?? '',
        observaciones_inspeccion: ins.observaciones_inspeccion ?? '',
        incluye_recarga: ins.incluye_recarga || !!(ins.fecha_recarga || ins.fecha_proxima_recarga),
        fecha_recarga: ins.fecha_recarga ?? '',
        fecha_proxima_recarga: ins.fecha_proxima_recarga ?? '',
        observaciones_recarga: ins.observaciones_recarga ?? '',
        registra_vehiculo: false,
        nueva_placa: '',
        observaciones_vehiculo: '',
        desasociar_previos_insp: false,
    });

    const cargarFirmaGuardada = () => {
        fetch(route('flota.extintores.ultima-firma'))
            .then(r => r.json())
            .then((json: { firma_url: string | null }) => setFirmaGuardadaUrl(json.firma_url || null))
            .catch(() => setFirmaGuardadaUrl(null));
    };

    const abrirNuevaInspeccion = () => {
        setEditInspeccion(null);
        setFormInspeccion(inspeccion_defaults);
        setArchivosInspeccion([]);
        setErrorsInspeccion({});
        setDesplegarChecklist(false);
        setHayMantenimiento(false);
        setExtintoresEnPlacaInsp([]);
        setModoEdicion(null);
        firmaPadRef.current?.clear();
        cargarFirmaGuardada();
        setModalConfirmarFirma(false);
        setModalFirmaManual(false);
        setModalInspeccion(true);
    };

    const abrirEditarInspeccion = (ins: Inspeccion, desdeCondiciones = false) => {
        setEditInspeccion(ins);
        const form = formDesdeInspeccion(ins);
        // Al editar desde Condiciones solo interesa el checklist; la recarga no aplica
        if (desdeCondiciones) {
            form.incluye_recarga = false;
            form.fecha_recarga = '';
            form.fecha_proxima_recarga = '';
            form.observaciones_recarga = '';
        }
        setFormInspeccion(form);
        setArchivosInspeccion([]);
        setErrorsInspeccion({});
        setExtintoresEnPlacaInsp([]);
        setDesplegarChecklist(desdeCondiciones);
        setHayMantenimiento(ins.partes_mantenimiento_lista.length > 0);
        setModoEdicion(desdeCondiciones ? 'condiciones' : 'inspeccion');
        setModalConfirmarFirma(false);
        setModalFirmaManual(false);
        setModalInspeccion(true);
    };

    const ejecutarGuardadoInspeccion = (opciones: { usarFirmaGuardada?: boolean; firmaFile?: File | null } = {}) => {
        setSavingInspeccion(true);
        setErrorsInspeccion({});

        if (editInspeccion) {
            router.post(
                route('flota.extintores.inspecciones.store', extintor.id),
                { ...formInspeccion, _method: 'PUT', _edit_id: editInspeccion.id },
                {
                    onSuccess: () => {
                        setModalInspeccion(false);
                        setSavingInspeccion(false);
                    },
                    onError: (errs) => {
                        setErrorsInspeccion(errs as Record<string, string>);
                        setSavingInspeccion(false);
                    },
                    onFinish: () => setSavingInspeccion(false),
                }
            );
            return;
        }

        const fd = new FormData();
        Object.entries(formInspeccion).forEach(([k, v]) => {
            if (typeof v === 'boolean') fd.append(k, v ? '1' : '0');
            else if (Array.isArray(v)) { if (v.length > 0) fd.append(k, v.join(',')); }
            else if (v !== null && v !== undefined && v !== '') fd.append(k, String(v));
        });
        archivosInspeccion.forEach(f => fd.append('evidencias[]', f));

        if (opciones.usarFirmaGuardada) {
            fd.append('usar_firma_guardada', '1');
        } else if (opciones.firmaFile) {
            fd.append('firma', opciones.firmaFile);
        }

        router.post(route('flota.extintores.inspecciones.store', extintor.id), fd, {
            forceFormData: true,
            onSuccess: () => {
                setModalInspeccion(false);
                setModalConfirmarFirma(false);
                setModalFirmaManual(false);
                setSavingInspeccion(false);
                setArchivosInspeccion([]);
                firmaPadRef.current?.clear();
                cargarFirmaGuardada();
            },
            onError: (errs) => {
                setErrorsInspeccion(errs as Record<string, string>);
                setSavingInspeccion(false);
                setModalConfirmarFirma(false);
                setModalFirmaManual(false);
            },
            onFinish: () => setSavingInspeccion(false),
        });
    };

    // Las validaciones (fechas de recarga, cupo de placa) las hace el backend.
    const handleInspeccion = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorsInspeccion({});

        if (editInspeccion) {
            ejecutarGuardadoInspeccion();
            return;
        }

        if (firmaGuardadaUrl) setModalConfirmarFirma(true);
        else setModalFirmaManual(true);
    };

    const consultarExtintoresEnPlacaInsp = (placa: string) => {
        setExtintoresEnPlacaInsp([]);
        if (!placa) return;
        setCargandoPlacaInsp(true);
        fetch(`/modules/flota/extintores/por-placa/${encodeURIComponent(placa)}`)
            .then(r => r.json())
            .then(json => setExtintoresEnPlacaInsp((json.extintores ?? []).filter((ext: ExtintorEnPlaca) => ext.id !== extintor.id)))
            .catch(() => setExtintoresEnPlacaInsp([]))
            .finally(() => setCargandoPlacaInsp(false));
    };

    // ── Eliminar inspección ───────────────────────────────────────────────────
    const [confirmInsp, setConfirmInsp] = useState<number | null>(null);
    const handleDeleteInsp = (id: number) => {
        router.delete(route('flota.extintores.inspecciones.destroy', { extintor: extintor.id, inspeccion: id }), { preserveScroll: true });
        setConfirmInsp(null);
    };

    // ── Modales asignar / retirar ─────────────────────────────────────────────
    const checklistVacio = () => {
        const obj: Record<string, string> = {};
        columnas_extra.forEach(c => (obj[c] = ''));
        return obj;
    };


    const abrirEditarAsignacion = (a: Asignacion) => {
        setEditInspeccion(null);
        setFormInspeccion({
            ...inspeccion_defaults,
            registra_vehiculo: true,
            nueva_placa: a.placa,
            observaciones_vehiculo: a.observaciones_colocacion ?? '',
        });
        setArchivosInspeccion([]);
        setErrorsInspeccion({});
        setDesplegarChecklist(false);
        setHayMantenimiento(false);
        setExtintoresEnPlacaInsp([]);
        setModoEdicion('inspeccion');
        setModalConfirmarFirma(false);
        setModalFirmaManual(false);
        cargarFirmaGuardada();
        setModalInspeccion(true);
    };

    const [confirmAsig, setConfirmAsig] = useState<number | null>(null);
    const handleDeleteAsignacion = (id: number) => {
        router.delete(route('flota.extintores.asignaciones.destroy', { extintor: extintor.id, asignacion: id }), { preserveScroll: true });
        setConfirmAsig(null);
    };

    // ── Editar / Eliminar Registro Inicial (Extintor) ─────────────────────────
    const formExtintorDesdeProps = () => ({
        numero_serie: extintor.numero_serie,
        marca: extintor.marca ?? '',
        tipo_agente: extintor.tipo_agente ?? '',
        capacidad_kg: extintor.capacidad_kg ?? '',
        fecha_fabricacion: extintor.fecha_fabricacion ?? '',
        fecha_vencimiento: extintor.fecha_vencimiento ?? '',
        condicion: extintor.condicion ?? '',
        agente_impulsor: extintor.agente_impulsor ?? '',
        parte_mantenimiento: extintor.parte_mantenimiento ?? '',
        senalizacion: extintor.senalizacion ?? '',
        demarcacion: extintor.demarcacion ?? '',
        funcionamiento: extintor.funcionamiento ?? '',
        acceso: extintor.acceso ?? '',
        observaciones: extintor.observaciones ?? '',
    });

    const [modalEditarExtintor, setModalEditarExtintor] = useState(false);
    const [savingExtintor, setSavingExtintor] = useState(false);
    const [errorsEditarExtintor, setErrorsEditarExtintor] = useState<Record<string, string>>({});
    const [confirmExtintor, setConfirmExtintor] = useState(false);
    const [formEditarExtintor, setFormEditarExtintor] = useState(formExtintorDesdeProps);

    // Sincronizar el formulario cuando el extintor de props se actualice
    // (ocurre después de un guardado exitoso vía Inertia)
    useEffect(() => {
        setFormEditarExtintor(formExtintorDesdeProps());
    }, [
        extintor.numero_serie,
        extintor.marca,
        extintor.tipo_agente,
        extintor.capacidad_kg,
        extintor.fecha_fabricacion,
        extintor.fecha_vencimiento,
        extintor.condicion,
        extintor.agente_impulsor,
        extintor.parte_mantenimiento,
        extintor.senalizacion,
        extintor.demarcacion,
        extintor.funcionamiento,
        extintor.acceso,
        extintor.observaciones,
    ]);

    const setExtintorField = (k: string, v: string) =>
        setFormEditarExtintor(p => ({ ...p, [k]: v }));

    const abrirEditarRegistroInicial = () => {
        setFormEditarExtintor(formExtintorDesdeProps());
        setErrorsEditarExtintor({});
        setModalEditarExtintor(true);
    };

    const handleGuardarExtintor = (e: React.FormEvent) => {
        e.preventDefault();
        setSavingExtintor(true);
        setErrorsEditarExtintor({});
        router.post(
            route('flota.extintores.update', extintor.id),
            { ...formEditarExtintor, _method: 'put' },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setModalEditarExtintor(false);
                    setSavingExtintor(false);
                },
                onError: (errs) => {
                    setErrorsEditarExtintor(errs as Record<string, string>);
                    setSavingExtintor(false);
                },
            }
        );
    };

    const handleDeleteExtintor = () => {
        router.delete(route('flota.extintores.destroy', extintor.id));
        setConfirmExtintor(false);
    };

    const [modalRetirar, setModalRetirar] = useState(false);
    const [savingRetirar, setSavingRetirar] = useState(false);
    const [errorsRetirar, setErrorsRetirar] = useState<Record<string, string>>({});
    const [formRetirar, setFormRetirar] = useState({
        fecha_retiro: hoy(),
        responsable_retiro: '', observaciones_retiro: '',
        checklist_retiro: checklistVacio(),
    });
    const setRetirar = (k: string, v: string) => setFormRetirar(p => ({ ...p, [k]: v }));
    const setChecklistRetirar = (col: string, val: string) =>
        setFormRetirar(p => ({ ...p, checklist_retiro: { ...p.checklist_retiro, [col]: val } }));
    const handleRetirar = (e: React.FormEvent) => {
        e.preventDefault(); setSavingRetirar(true); setErrorsRetirar({});
        router.post(route('flota.extintores.retirar', extintor.id), formRetirar, {
            onSuccess: () => { setModalRetirar(false); setSavingRetirar(false); },
            onError: (errs) => { setErrorsRetirar(errs as Record<string, string>); setSavingRetirar(false); },
        });
    };

    // ── Expandir filas ────────────────────────────────────────────────────────
    const [expandedAsig, setExpandedAsig] = useState<number | null>(null);
    const [expandedInsp, setExpandedInsp] = useState<number | null>(null);

    // ── Modal QR ──────────────────────────────────────────────────────────────
    const [modalQr, setModalQr] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);

    const imprimirQr = () => {
        const svg = qrRef.current?.querySelector('svg');
        if (!svg) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`
            <html><head><title>QR Extintor ${extintor.numero_serie}</title>
            <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;gap:12px}
            p{font-size:14px;color:#555;margin:0}</style></head>
            <body>${svg.outerHTML}<p>${extintor.numero_serie}</p>
            <p style="font-size:11px">${extintor.qr_url ?? ''}</p>
            <script>window.onload=()=>{window.print();window.close()}</script></body></html>
        `);
        win.document.close();
    };

    const descargarQr = () => {
        const svg = qrRef.current?.querySelector('svg');
        if (!svg) return;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = document.createElement('img');
        img.onload = () => {
            canvas.width = 400;
            canvas.height = 400;
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, 400, 400);
                ctx.drawImage(img, 0, 0, 400, 400);
            }
            const link = document.createElement('a');
            link.download = `QR_${extintor.numero_serie}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    // ── Foto del extintor ─────────────────────────────────────────────────────
    const fotoInputRef = useRef<HTMLInputElement>(null);
    const [uploadingFoto, setUploadingFoto] = useState(false);
    const [localFoto, setLocalFoto] = useState<string | null>(null);
    const [fotoError, setFotoError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    // Bloquear scroll del body cuando el lightbox está abierto
    useEffect(() => {
        document.body.style.overflow = lightboxOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [lightboxOpen]);

    useEffect(() => {
        setLocalFoto(null);
        setFotoError(false);
    }, [extintor.foto_url]);

    const handleUploadFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Por favor seleccione un archivo de imagen válido.');
            e.target.value = '';
            return;
        }

        setLocalFoto(URL.createObjectURL(file));
        setFotoError(false);
        setUploadingFoto(true);

        const data = new FormData();
        data.append('foto', file);

        router.post(route('flota.extintores.foto.store', extintor.id), data, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => {
                setUploadingFoto(false);
                e.target.value = '';
            },
            onError: (errs) => {
                setUploadingFoto(false);
                console.error('Error al subir foto:', errs);
            },
        });
    };

    const handleDeleteFoto = () => {
        if (!confirm('¿Desea eliminar la foto de este extintor?')) return;
        router.delete(route('flota.extintores.foto.destroy', extintor.id), {
            preserveScroll: true,
            onSuccess: () => {
                setLocalFoto(null);
                setFotoError(true);
            },
        });
    };

    const fotoActual = (!fotoError && (localFoto || extintor.foto_url)) || null;

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Extintor ${extintor.numero_serie}`} />
            <div className="flex flex-col gap-6 px-4 pb-10 sm:px-6">

                {/* Flash */}
                {successMsg && (
                    <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 dark:border-green-800/40 dark:bg-green-900/10">
                        <CheckCircle2 className="size-5 shrink-0 text-green-700" />
                        <p className="flex-1 text-sm font-semibold text-green-800 dark:text-green-300">{successMsg}</p>
                        <button type="button" onClick={() => setSuccessMsg(null)}>
                            <XCircle className="size-4 text-green-400 hover:text-green-600" />
                        </button>
                    </div>
                )}

                {/* Encabezado */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <Button variant="ghost" size="sm" className="mt-0.5 h-8 w-8 p-0 shrink-0" asChild>
                            <Link href={route('flota.extintores.index')}><ArrowLeft className="size-4" /></Link>
                        </Button>
                        <div>
                            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
                                <FlameKindling className="size-7 text-red-500" />
                                {extintor.numero_serie}
                            </h1>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                {[extintor.tipo_agente, extintor.capacidad_kg ? `${extintor.capacidad_kg} kg` : null, extintor.marca]
                                    .filter(Boolean).join(' · ') || 'Sin detalles'}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {extintor.qr_url && (
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setModalQr(true)}>
                                <QrCode className="size-4" /> Ver QR
                            </Button>
                        )}
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={abrirNuevaInspeccion}>
                            <ClipboardList className="size-4" /> Nueva inspección
                        </Button>
                        <a href={route('flota.extintores.exportar-excel', extintor.id)} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="gap-1.5">
                                <FileDown className="size-4" /> Exportar Excel
                            </Button>
                        </a>
                    </div>
                </div>

                {/* Ficha con foto */}
                <div className="rounded-2xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border p-5">
                    <div className="flex flex-col md:flex-row items-stretch gap-6">
                        <div className="shrink-0 flex flex-col gap-2">
                            <input
                                ref={fotoInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleUploadFoto}
                            />
                            <div className="relative rounded-xl border-2 border-dashed border-sidebar-border/70 dark:border-sidebar-border hover:border-primary/60 bg-muted/20 hover:bg-muted/30 transition-all overflow-hidden inline-flex items-center justify-center group select-none" style={{ maxWidth: '288px' }}>
                                {uploadingFoto ? (
                                    <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                                        <Loader2 className="size-8 animate-spin text-primary" />
                                        <span className="text-xs font-medium text-foreground">Subiendo foto...</span>
                                    </div>
                                ) : fotoActual ? (
                                    <>
                                        <img
                                            src={fotoActual}
                                            alt={`Extintor ${extintor.numero_serie}`}
                                            className="block max-w-[284px] max-h-[400px] w-auto h-auto object-contain p-2 transition-transform duration-200 group-hover:scale-105 cursor-zoom-in"
                                            onClick={() => setLightboxOpen(true)}
                                            onError={() => setFotoError(true)}
                                        />
                                        {/* Overlay de zoom */}
                                        <div
                                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-zoom-in bg-black/20 rounded-xl"
                                            onClick={() => setLightboxOpen(true)}
                                        >
                                            <div className="flex items-center gap-1.5 bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm">
                                                <ZoomIn className="size-3.5" /> Ver en grande
                                            </div>
                                        </div>
                                        <div className="absolute top-2 right-2 z-10">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteFoto(); }}
                                                title="Eliminar foto"
                                                className="p-1.5 rounded-md bg-background/85 dark:bg-card/85 backdrop-blur-sm border border-sidebar-border/60 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition-all shadow-xs"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end">
                                            <button
                                                type="button"
                                                onClick={() => fotoInputRef.current?.click()}
                                                className="text-white text-xs font-medium flex items-center gap-1 hover:underline"
                                            >
                                                <Upload className="size-3.5" /> Cambiar foto
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div
                                        onClick={() => fotoInputRef.current?.click()}
                                        className="flex flex-col items-center justify-center p-6 text-center cursor-pointer w-full h-full"
                                    >
                                        <div className="rounded-full bg-muted/80 p-3.5 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                            <Camera className="size-7" />
                                        </div>
                                        <p className="mt-2 text-xs font-semibold text-foreground">Foto del extintor</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">Clic para subir imagen</p>
                                        <span className="mt-2 text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-sidebar-border/40">
                                            JPG, PNG o WEBP
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="bg-muted/20 rounded-lg p-3 border border-sidebar-border/40">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">N° de Serie</p>
                                    <p className="mt-0.5 text-base font-mono font-bold text-foreground">{extintor.numero_serie}</p>
                                </div>
                                <div className="bg-muted/20 rounded-lg p-3 border border-sidebar-border/40">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Marca</p>
                                    <p className="mt-0.5 text-sm font-medium text-foreground">{extintor.marca ?? '—'}</p>
                                    <p className="text-[10px] text-muted-foreground">Fabricante</p>
                                </div>
                                <div className="bg-muted/20 rounded-lg p-3 border border-sidebar-border/40">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fecha fabricación</p>
                                    <p className="mt-0.5 text-sm font-medium text-foreground">{extintor.fecha_fabricacion ?? '—'}</p>
                                </div>
                                <div className="bg-muted/20 rounded-lg p-3 border border-sidebar-border/40">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Última recarga</p>
                                    <p className="mt-0.5 text-sm font-medium text-foreground">{ultimaRecarga ?? '—'}</p>
                                </div>
                                <div className="bg-muted/20 rounded-lg p-3 border border-sidebar-border/40">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Próxima recarga (vencimiento)</p>
                                    <p className={`mt-0.5 text-sm font-medium ${extintor.vencido ? 'text-red-600 font-semibold' : 'text-foreground'}`}>
                                        {extintor.vencido ? (
                                            <span className="flex items-center gap-1">
                                                <AlertTriangle className="size-3.5" />
                                                {proximaRecarga ?? extintor.fecha_vencimiento ?? '—'}
                                            </span>
                                        ) : (proximaRecarga ?? extintor.fecha_vencimiento ?? '—')}
                                    </p>
                                </div>
                                <div className="bg-muted/20 rounded-lg p-3 border border-sidebar-border/40">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Última recarga</p>
                                    <p className="mt-0.5 text-sm font-medium text-foreground">{ultimaRecarga ?? '—'}</p>
                                </div>
                                <div className="bg-muted/20 rounded-lg p-3 border border-sidebar-border/40">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Placa actual</p>
                                    <p className="mt-0.5 text-sm font-mono font-medium text-foreground">
                                        {extintor.placa_actual ?? 'En depósito'}
                                    </p>
                                    {extintor.fecha_colocacion_actual && (
                                        <p className="text-[10px] text-muted-foreground">desde {extintor.fecha_colocacion_actual}</p>
                                    )}
                                </div>
                                {extintor.vencido && (
                                    <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 border border-red-200 dark:border-red-900/40">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Dado de baja / caducado</p>
                                        <p className="mt-0.5 text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                                            <AlertTriangle className="size-3.5" />
                                            Caducó el {extintor.fecha_vencimiento ?? '—'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lightbox */}
                {lightboxOpen && fotoActual && typeof document !== 'undefined' && createPortal(
                    <div
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-between p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-150 select-none"
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}
                        onClick={() => setLightboxOpen(false)}
                    >
                        <div className="w-full flex items-center justify-between max-w-5xl z-10 text-white pb-2" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm sm:text-base">
                                    Extintor {extintor.numero_serie}
                                </span>
                                {extintor.marca && (
                                    <span className="text-xs text-white/70 hidden sm:inline">
                                        · {extintor.marca}
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setLightboxOpen(false)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/25 text-white text-xs font-medium transition-colors cursor-pointer"
                            >
                                <X className="size-4" />
                                <span>Cerrar</span>
                            </button>
                        </div>

                        <div className="flex-1 w-full flex items-center justify-center p-2 min-h-0" onClick={() => setLightboxOpen(false)}>
                            <img
                                src={fotoActual}
                                alt={`Extintor ${extintor.numero_serie}`}
                                className="max-h-[82vh] max-w-[92vw] w-auto h-auto object-contain rounded-xl shadow-2xl ring-1 ring-white/15"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>

                        <div className="text-center text-xs text-white/50 pt-2 z-10" onClick={e => e.stopPropagation()}>
                            Presiona <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-white/80">Esc</kbd> o haz clic afuera para salir
                        </div>
                    </div>,
                    document.body
                )}

                {/* ── Historial completo del extintor (construido en el backend) ── */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                                <History className="size-4 text-primary" />
                                Historial del extintor
                                <span className="text-sm font-normal text-muted-foreground">({historial.length} {historial.length === 1 ? 'registro' : 'registros'})</span>
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Registro cronológico de todas las condiciones guardadas y renovadas del extintor
                            </p>
                        </div>
                    </div>

                    {/* ── Ficha de identificación del extintor ── */}
                    <h2 className="mb-3 text-base font-semibold text-foreground">Datos del Extintor</h2>
                    <div className="rounded-2xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden mb-6">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted dark:bg-muted">
                                        {['N° de Serie', 'Fecha de registro', 'Marca', 'Capacidad (kg)', 'Fecha de fabricación', 'Fecha de caducidad', ''].map(h => (
                                            <TableHead key={h} className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{h}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="text-xs font-mono font-semibold text-foreground whitespace-nowrap">
                                            {extintor.numero_serie}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {extintor.fecha_creacion ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {extintor.marca ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {extintor.capacidad_kg ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {extintor.fecha_fabricacion ?? '—'}
                                        </TableCell>
                                        <TableCell className={`text-xs whitespace-nowrap ${extintor.vencido ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                                            {extintor.fecha_vencimiento ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0"
                                                    title="Editar extintor"
                                                    onClick={abrirEditarRegistroInicial}
                                                >
                                                    <Pencil className="size-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                                </Button>
                                                {confirmExtintor ? (
                                                    <ConfirmarEliminar
                                                        texto="¿Eliminar extintor y todo su historial?"
                                                        onConfirm={handleDeleteExtintor}
                                                        onCancel={() => setConfirmExtintor(false)}
                                                    />
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0"
                                                        title="Eliminar extintor y todo su historial"
                                                        onClick={() => setConfirmExtintor(true)}
                                                    >
                                                        <Trash2 className="size-3.5 text-muted-foreground/60 hover:text-red-500 transition-colors" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* ── Tabla de condiciones ── */}
                    <h2 className="mb-3 text-base font-semibold text-foreground">Condiciones del Extintor</h2>
                    <div className="rounded-2xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted dark:bg-muted">
                                        {['Fecha', 'Condición', 'Agente extintor', 'Agente impulsor', 'Señalización', 'Demarcación', 'Funcionamiento', 'Acceso', 'Parte mantenimiento', 'Observaciones', ''].map(h => (
                                            <TableHead key={h} className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{h}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {historial.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={11} className="py-6 text-center text-sm text-muted-foreground">
                                                Sin condiciones registradas.
                                            </TableCell>
                                        </TableRow>
                                    ) : historial.map(row => {
                                        const inspeccionOriginal = row.inspeccion_id !== null
                                            ? inspecciones.find(i => i.id === row.inspeccion_id) ?? null
                                            : null;
                                        const esRegistroInicial = row.tipo === 'registro_inicial';
                                        return (
                                            <TableRow key={row.id} className={`hover:bg-muted/50 transition-colors ${esRegistroInicial ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''}`}>
                                                <TableCell className="text-xs font-semibold text-foreground whitespace-nowrap">
                                                    {row.fecha}
                                                </TableCell>
                                                <TableCell>
                                                    {row.condicion ? (
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                                                            row.condicion === 'buena'
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>{row.condicion}</span>
                                                    ) : <span className="text-xs text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{row.tipo_agente || '—'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground capitalize">{row.agente_impulsor || '—'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground capitalize">{row.senalizacion || '—'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{row.demarcacion || '—'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground capitalize">{row.funcionamiento || '—'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground capitalize">{row.acceso || '—'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={row.parte_mantenimiento ?? undefined}>{row.parte_mantenimiento || '—'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={row.observaciones ?? undefined}>{row.observaciones || '—'}</TableCell>
                                                <TableCell className="text-right">
                                                    {esRegistroInicial ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                            title="Editar registro inicial"
                                                            onClick={abrirEditarRegistroInicial}
                                                        >
                                                            <Pencil className="size-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                                        </Button>
                                                    ) : inspeccionOriginal ? (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0"
                                                                title="Editar inspección"
                                                                onClick={() => abrirEditarInspeccion(inspeccionOriginal, true)}
                                                            >
                                                                <Pencil className="size-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                                            </Button>
                                                            {confirmInsp === inspeccionOriginal.id ? (
                                                                <ConfirmarEliminar
                                                                    texto="¿Eliminar inspección?"
                                                                    onConfirm={() => handleDeleteInsp(inspeccionOriginal.id)}
                                                                    onCancel={() => setConfirmInsp(null)}
                                                                />
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0"
                                                                    title="Eliminar inspección"
                                                                    onClick={() => setConfirmInsp(inspeccionOriginal.id)}
                                                                >
                                                                    <Trash2 className="size-3.5 text-muted-foreground/60 hover:text-red-500 transition-colors" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                {/* ── Inspecciones ──────────────────────────────────────────────── */}
                <div>
                    <h2 className="mb-3 text-base font-semibold text-foreground">
                        Inspecciones
                        <span className="ml-2 text-sm font-normal text-muted-foreground">({inspecciones.length})</span>
                    </h2>

                    {inspecciones.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-sidebar-border/70 dark:border-sidebar-border p-8 text-center text-sm text-muted-foreground">
                            No hay inspecciones registradas todavía.
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted dark:bg-muted">
                                            {['Tipo', 'Fecha', 'Responsable', 'Recarga realizada', 'Próxima recarga', 'Evidencias', ''].map(h => (
                                                <TableHead key={h} className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{h}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {inspecciones.map(ins => (
                                            <Fragment key={ins.id}>
                                                <TableRow
                                                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                                                    onClick={() => setExpandedInsp(expandedInsp === ins.id ? null : ins.id)}>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {ins.tipo_label}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {ins.fecha_inspeccion ?? '—'}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                                                        {ins.tipo === 'inicio'
                                                            ? (ins.responsable_inicio ?? '—')
                                                            : (ins.responsable_periodico ?? '—')}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {ins.fecha_recarga ?? '—'}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {ins.fecha_proxima_recarga ?? '—'}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {ins.evidencias.length > 0 ? ins.evidencias.length : '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                                                onClick={() => abrirEditarInspeccion(ins)}>
                                                                <Pencil className="size-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                                            </Button>
                                                            {confirmInsp === ins.id ? (
                                                                <ConfirmarEliminar
                                                                    texto="¿Eliminar inspección?"
                                                                    onConfirm={() => handleDeleteInsp(ins.id)}
                                                                    onCancel={() => setConfirmInsp(null)}
                                                                />
                                                            ) : (
                                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                                                    onClick={() => setConfirmInsp(ins.id)}>
                                                                    <Trash2 className="size-3.5 text-muted-foreground/60 hover:text-red-500 transition-colors" />
                                                                </Button>
                                                            )}
                                                            <span className="text-xs text-muted-foreground w-4 text-center">
                                                                {expandedInsp === ins.id ? '▲' : '▼'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>

                                                {expandedInsp === ins.id && (
                                                    <TableRow key={`${ins.id}-detail`} className="bg-muted/20 dark:bg-muted/10">
                                                        <TableCell colSpan={7} className="px-5 py-4">
                                                            <div className="flex flex-col gap-3">
                                                                {(ins.responsable_inicio || ins.responsable_periodico || ins.creador_nombre) && (
                                                                    <div className="flex flex-wrap gap-4 text-sm">
                                                                        {ins.responsable_inicio && (
                                                                            <div>
                                                                                <span className="text-[10px] font-semibold uppercase text-muted-foreground block">Resp. inicio</span>
                                                                                {ins.responsable_inicio}
                                                                            </div>
                                                                        )}
                                                                        {ins.responsable_periodico && (
                                                                            <div>
                                                                                <span className="text-[10px] font-semibold uppercase text-muted-foreground block">Resp. periódico</span>
                                                                                {ins.responsable_periodico}
                                                                            </div>
                                                                        )}
                                                                        {ins.creador_nombre && (
                                                                            <div>
                                                                                <span className="text-[10px] font-semibold uppercase text-muted-foreground block">Registrado por</span>
                                                                                {ins.creador_nombre}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {ins.observaciones_inspeccion && (
                                                                    <p className="text-sm text-muted-foreground">{ins.observaciones_inspeccion}</p>
                                                                )}
                                                                {ins.incluye_recarga && ins.observaciones_recarga && (
                                                                    <p className="text-sm text-muted-foreground"><span className="font-semibold">Recarga:</span> {ins.observaciones_recarga}</p>
                                                                )}
                                                                {(ins.condicion || ins.tipo_agente || ins.agente_impulsor || ins.demarcacion || ins.parte_mantenimiento || ins.senalizacion || ins.funcionamiento || ins.acceso) && (
                                                                    <div className="rounded-xl border border-sidebar-border/50 bg-background/50 p-3">
                                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                                                            Estado del extintor registrado en esta inspección
                                                                        </p>
                                                                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                                                                            {ins.condicion && (
                                                                                <div>
                                                                                    <span className="text-[10px] text-muted-foreground block">Condición</span>
                                                                                    <span className="font-medium text-foreground capitalize">{ins.condicion}</span>
                                                                                </div>
                                                                            )}
                                                                            {(ins.tipo_agente || ins.capacidad_kg) && (
                                                                                <div>
                                                                                    <span className="text-[10px] text-muted-foreground block">Agente / Capacidad</span>
                                                                                    <span className="font-medium text-foreground">
                                                                                        {[ins.tipo_agente, ins.capacidad_kg ? `${ins.capacidad_kg} kg` : null].filter(Boolean).join(' · ')}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {ins.marca && (
                                                                                <div>
                                                                                    <span className="text-[10px] text-muted-foreground block">Marca</span>
                                                                                    <span className="font-medium text-foreground">{ins.marca}</span>
                                                                                </div>
                                                                            )}
                                                                            {ins.agente_impulsor && (
                                                                                <div>
                                                                                    <span className="text-[10px] text-muted-foreground block">Agente impulsor</span>
                                                                                    <span className="font-medium text-foreground capitalize">{ins.agente_impulsor}</span>
                                                                                </div>
                                                                            )}
                                                                            {ins.demarcacion && (
                                                                                <div>
                                                                                    <span className="text-[10px] text-muted-foreground block">Demarcación</span>
                                                                                    <span className="font-medium text-foreground">{ins.demarcacion}</span>
                                                                                </div>
                                                                            )}
                                                                            {ins.parte_mantenimiento && (
                                                                                <div>
                                                                                    <span className="text-[10px] text-muted-foreground block">Parte mantenimiento</span>
                                                                                    <span className="font-medium text-foreground">{ins.parte_mantenimiento}</span>
                                                                                </div>
                                                                            )}
                                                                            {ins.senalizacion && (
                                                                                <div>
                                                                                    <span className="text-[10px] text-muted-foreground block">Señalización</span>
                                                                                    <span className="font-medium text-foreground">{ins.senalizacion}</span>
                                                                                </div>
                                                                            )}
                                                                            {(ins.funcionamiento || ins.acceso) && (
                                                                                <div>
                                                                                    <span className="text-[10px] text-muted-foreground block">Funcionamiento / Acceso</span>
                                                                                    <span className="font-medium text-foreground">
                                                                                        {[ins.funcionamiento ? `Func: ${ins.funcionamiento}` : null, ins.acceso ? `Acceso: ${ins.acceso}` : null].filter(Boolean).join(' · ')}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {ins.firma_url && (
                                                                    <div className="mt-1">
                                                                        <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-1">Firma registrada</span>
                                                                        <div className="inline-block rounded-lg border border-sidebar-border/60 bg-white p-2">
                                                                            <img src={ins.firma_url} alt="Firma del inspector" className="max-h-16 object-contain" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <GaleriaEvidencias evidencias={ins.evidencias} />
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </Fragment>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Historial de asignaciones ─────────────────────────────────── */}
                <div>
                    <h2 className="mb-3 text-base font-semibold text-foreground">
                        Historial de asignaciones a vehículos
                        <span className="ml-2 text-sm font-normal text-muted-foreground">({asignaciones.length})</span>
                    </h2>

                    {asignaciones.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-sidebar-border/70 dark:border-sidebar-border p-8 text-center text-sm text-muted-foreground">
                            Este extintor no ha sido asignado a ningún vehículo todavía.
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted dark:bg-muted">
                                            {['Placa', 'Asignado', 'Retirado', 'Resp. asignación', 'Resp. retiro', 'Estado', ''].map(h => (
                                                <TableHead key={h} className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{h}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {asignaciones.map(a => (
                                            <Fragment key={a.id}>
                                                <TableRow
                                                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                                                    onClick={() => setExpandedAsig(expandedAsig === a.id ? null : a.id)}>
                                                    <TableCell className="text-xs font-mono font-semibold text-foreground">{a.placa}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{a.fecha_colocacion ?? '—'}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{a.fecha_retiro ?? '—'}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[130px] truncate">{a.responsable_colocacion ?? a.coloco_nombre ?? '—'}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[130px] truncate">{a.responsable_retiro ?? a.retiro_nombre ?? '—'}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {a.activo ? 'Activo' : 'Retirado'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                                                onClick={() => abrirEditarAsignacion(a)}>
                                                                <Pencil className="size-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                                            </Button>
                                                            {confirmAsig === a.id ? (
                                                                <span className="flex items-center gap-1">
                                                                    <button type="button" onClick={() => handleDeleteAsignacion(a.id)}
                                                                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-600 text-white hover:bg-red-700">
                                                                        Confirmar
                                                                    </button>
                                                                    <button type="button" onClick={() => setConfirmAsig(null)}
                                                                        className="text-muted-foreground hover:text-foreground">
                                                                        <X className="size-3.5" />
                                                                    </button>
                                                                </span>
                                                            ) : (
                                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                                                    onClick={() => setConfirmAsig(a.id)}>
                                                                    <Trash2 className="size-3.5 text-muted-foreground/60 hover:text-red-500 transition-colors" />
                                                                </Button>
                                                            )}
                                                            <span className="text-xs text-muted-foreground w-4 text-center">
                                                                {expandedAsig === a.id ? '▲' : '▼'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>

                                                {expandedAsig === a.id && (
                                                    <TableRow key={`${a.id}-detail`} className="bg-muted/20 dark:bg-muted/10">
                                                        <TableCell colSpan={7} className="px-5 py-4">
                                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                                <div className="rounded-xl border border-sidebar-border/50 dark:border-sidebar-border p-4">
                                                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                                                        <LogIn className="size-3.5" /> Al colocar
                                                                    </p>
                                                                    {a.observaciones_colocacion && <p className="mb-2 text-xs text-muted-foreground">{a.observaciones_colocacion}</p>}
                                                                    <ChecklistReadonly data={a.checklist_colocacion} label="Checklist colocación" icon={<ClipboardCheck className="size-3" />} />
                                                                    {!Object.values(a.checklist_colocacion).some(Boolean) && !a.observaciones_colocacion && (
                                                                        <p className="text-xs text-muted-foreground italic">Sin datos</p>
                                                                    )}
                                                                </div>
                                                                <div className="rounded-xl border border-sidebar-border/50 dark:border-sidebar-border p-4">
                                                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                                                        <LogOut className="size-3.5" /> Al retirar
                                                                    </p>
                                                                    {a.activo ? (
                                                                        <p className="text-xs text-muted-foreground italic">Extintor aún montado</p>
                                                                    ) : (
                                                                        <>
                                                                            {a.observaciones_retiro && <p className="mb-2 text-xs text-muted-foreground">{a.observaciones_retiro}</p>}
                                                                            <ChecklistReadonly data={a.checklist_retiro} label="Checklist retiro" icon={<ClipboardX className="size-3" />} />
                                                                            {!Object.values(a.checklist_retiro).some(Boolean) && !a.observaciones_retiro && (
                                                                                <p className="text-xs text-muted-foreground italic">Sin datos</p>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </Fragment>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal: Inspección (nueva / editar) ──────────────────────────── */}
            <Modal open={modalInspeccion} wide
                onClose={() => { setModalInspeccion(false); setErrorsInspeccion({}); }}
                title={editInspeccion ? 'Editar inspección' : 'Registrar inspección'}>
                <form onSubmit={handleInspeccion} className="flex flex-col gap-5">

                    {/* Datos de la inspección */}
                    <div className="flex flex-col gap-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Datos de la inspección
                        </p>
                        <div className="grid grid-cols-3 gap-3 items-end">
                            <div className="grid gap-1">
                                <Label className="text-[11px] font-semibold text-muted-foreground">Tipo</Label>
                                <div className="flex h-9 items-center rounded-lg border border-sidebar-border/70 dark:border-sidebar-border px-3 text-sm text-foreground bg-muted/30">
                                    {formInspeccion.tipo === 'inicio' ? 'Inspección de inicio' : 'Inspección periódica'}
                                </div>
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[11px] font-semibold text-muted-foreground">Fecha de inspección *</Label>
                                <Input type="date" value={formInspeccion.fecha_inspeccion}
                                    onChange={e => setInsp('fecha_inspeccion', e.target.value)}
                                    required className="h-9 text-sm" />
                                <FieldError msg={errorsInspeccion.fecha_inspeccion} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[11px] font-semibold text-muted-foreground">
                                    {formInspeccion.tipo === 'inicio' ? 'Responsable de inspección de inicio' : 'Responsable de inspección periódica'}
                                </Label>
                                {formInspeccion.tipo === 'inicio' ? (
                                    <ComboColaborador colaboradores={colaboradores}
                                        value={formInspeccion.responsable_inicio}
                                        onChange={v => setInsp('responsable_inicio', v)} />
                                ) : (
                                    <ComboColaborador colaboradores={colaboradores}
                                        value={formInspeccion.responsable_periodico}
                                        onChange={v => setInsp('responsable_periodico', v)} />
                                )}
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground -mt-2">
                            {tipo_inspeccion === 'inicio' ? 'Primera inspección del extintor' : 'Ya existe una inspección de inicio'}
                        </p>
                    </div>

                    {/* Checklist de condiciones — solo al editar condiciones o crear */}
                    {modoEdicion !== 'inspeccion' && (
                    <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border overflow-hidden">
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors select-none">
                            <input
                                type="checkbox"
                                checked={desplegarChecklist}
                                onChange={e => setDesplegarChecklist(e.target.checked)}
                                className="h-4 w-4 rounded border-sidebar-border/70 focus:ring-ring"
                            />
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <ClipboardCheck className="size-4 text-green-600 dark:text-green-500" />
                                    <p className="text-sm font-semibold text-foreground">Checklist de condiciones</p>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Precargado de la última inspección · Activa la casilla para ver o actualizar las condiciones
                                </p>
                            </div>
                        </label>

                        {desplegarChecklist && (
                            <div className="p-4 border-t border-sidebar-border/70 dark:border-sidebar-border bg-card flex flex-col gap-3">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                                    <div className="grid gap-1">
                                        <Label className="text-[11px] font-semibold text-muted-foreground">Condición</Label>
                                        <select value={formInspeccion.condicion} onChange={e => setInsp('condicion', e.target.value)} className={SELECT_CLS}>
                                            <option value="">— Seleccionar —</option>
                                            <option value="buena">Buena</option>
                                            <option value="mala">Mala</option>
                                        </select>
                                        <FieldError msg={errorsInspeccion.condicion} />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-[11px] font-semibold text-muted-foreground">Agente extintor</Label>
                                        <select value={formInspeccion.tipo_agente} onChange={e => setInsp('tipo_agente', e.target.value)} className={SELECT_CLS}>
                                            <option value="">— Seleccionar —</option>
                                            <option value="ABC">ABC</option>
                                            <option value="Otro">Otro</option>
                                            {formInspeccion.tipo_agente && !['ABC', 'Otro', ''].includes(formInspeccion.tipo_agente) && (
                                                <option value={formInspeccion.tipo_agente}>{formInspeccion.tipo_agente}</option>
                                            )}
                                        </select>
                                        <FieldError msg={errorsInspeccion.tipo_agente} />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-[11px] font-semibold text-muted-foreground">Agente impulsor</Label>
                                        <select value={formInspeccion.agente_impulsor} onChange={e => setInsp('agente_impulsor', e.target.value)} className={SELECT_CLS}>
                                            <option value="">— Seleccionar —</option>
                                            <option value="directa">Directa</option>
                                            <option value="indirecta">Indirecta</option>
                                        </select>
                                        <FieldError msg={errorsInspeccion.agente_impulsor} />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-[11px] font-semibold text-muted-foreground">Demarcación</Label>
                                        <select value={formInspeccion.demarcacion} onChange={e => setInsp('demarcacion', e.target.value)} className={SELECT_CLS}>
                                            <option value="">— Seleccionar —</option>
                                            <option value="buena">Buena</option>
                                            <option value="mala">Mala</option>
                                            <option value="N/A">N/A</option>
                                        </select>
                                        <FieldError msg={errorsInspeccion.demarcacion} />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-[11px] font-semibold text-muted-foreground">Señalización</Label>
                                        <select value={formInspeccion.senalizacion} onChange={e => setInsp('senalizacion', e.target.value)} className={SELECT_CLS}>
                                            <option value="">— Seleccionar —</option>
                                            <option value="buena">Buena</option>
                                            <option value="mala">Mala</option>
                                            {formInspeccion.senalizacion && !['buena', 'mala', ''].includes(formInspeccion.senalizacion) && (
                                                <option value={formInspeccion.senalizacion}>{formInspeccion.senalizacion}</option>
                                            )}
                                        </select>
                                        <FieldError msg={errorsInspeccion.senalizacion} />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-[11px] font-semibold text-muted-foreground">Funcionamiento del Extintor</Label>
                                        <select value={formInspeccion.funcionamiento} onChange={e => setInsp('funcionamiento', e.target.value)} className={SELECT_CLS}>
                                            <option value="">— Seleccionar —</option>
                                            <option value="bueno">Bueno</option>
                                            <option value="malo">Malo</option>
                                            {formInspeccion.funcionamiento && !['bueno', 'malo', ''].includes(formInspeccion.funcionamiento) && (
                                                <option value={formInspeccion.funcionamiento}>{formInspeccion.funcionamiento}</option>
                                            )}
                                        </select>
                                        <FieldError msg={errorsInspeccion.funcionamiento} />
                                    </div>
                                    <div className="col-span-2 grid gap-1">
                                        <Label className="text-[11px] font-semibold text-muted-foreground">Acceso al Extintor</Label>
                                        <select value={formInspeccion.acceso} onChange={e => setInsp('acceso', e.target.value)} className={SELECT_CLS}>
                                            <option value="">— Seleccionar —</option>
                                            <option value="bueno">Bueno</option>
                                            <option value="malo">Malo</option>
                                            {formInspeccion.acceso && !['bueno', 'malo', ''].includes(formInspeccion.acceso) && (
                                                <option value={formInspeccion.acceso}>{formInspeccion.acceso}</option>
                                            )}
                                        </select>
                                        <FieldError msg={errorsInspeccion.acceso} />
                                    </div>

                                    {/* Partes que requieren mantenimiento (catálogo desde el backend) */}
                                    <div className="col-span-2 rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-3 grid gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={hayMantenimiento}
                                                onChange={e => {
                                                    setHayMantenimiento(e.target.checked);
                                                    if (!e.target.checked) setInsp('parte_mantenimiento', []);
                                                }}
                                                className="h-4 w-4 rounded border-sidebar-border/70 accent-primary"
                                            />
                                            <span className="text-[11px] font-semibold text-muted-foreground leading-tight">
                                                ¿Hay alguna parte del extintor que requiera mantenimiento?
                                            </span>
                                        </label>

                                        {hayMantenimiento && (
                                            <div className="grid gap-2">
                                                <select
                                                    className={SELECT_CLS}
                                                    value=""
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (!val) return;
                                                        if (!formInspeccion.parte_mantenimiento.includes(val))
                                                            setInsp('parte_mantenimiento', [...formInspeccion.parte_mantenimiento, val]);
                                                        e.target.value = '';
                                                    }}
                                                >
                                                    <option value="">+ Agregar parte con codificación…</option>
                                                    {partes_mantenimiento
                                                        .filter(p => !formInspeccion.parte_mantenimiento.includes(p.codigo))
                                                        .map(p => (
                                                            <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.nombre}</option>
                                                        ))}
                                                </select>

                                                {formInspeccion.parte_mantenimiento.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {formInspeccion.parte_mantenimiento.map(n => (
                                                            <span key={n} className="inline-flex items-center gap-1 rounded-md border border-sidebar-border/60 dark:border-sidebar-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground">
                                                                <span className="font-semibold">{n}</span>
                                                                <span className="text-muted-foreground">— {nombreParte(n)}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setInsp('parte_mantenimiento', formInspeccion.parte_mantenimiento.filter(x => x !== n))}
                                                                    className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                                                >
                                                                    <X className="size-3" />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <FieldError msg={errorsInspeccion.parte_mantenimiento} />
                                    </div>
                                    <div className="col-span-2 grid gap-1">
                                        <Label className="text-[11px] font-semibold text-muted-foreground">Observaciones</Label>
                                        <textarea value={formInspeccion.observaciones_inspeccion}
                                            onChange={e => setInsp('observaciones_inspeccion', e.target.value)}
                                            placeholder="Opcional" rows={2}
                                            className={TEXTAREA_CLS} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    )} {/* fin modoEdicion !== 'inspeccion' */}

                    {/* Recarga — solo al editar inspecciones o crear */}
                    {modoEdicion !== 'condiciones' && (
                    <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border overflow-hidden">
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors select-none">
                            <input type="checkbox" checked={formInspeccion.incluye_recarga}
                                onChange={e => setInsp('incluye_recarga', e.target.checked)}
                                className="h-4 w-4 rounded border-sidebar-border/70 focus:ring-ring" />
                            <div>
                                <p className="text-sm font-semibold text-foreground">Esta inspección incluye una recarga</p>
                                {ultimaRecarga && (
                                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                        <CalendarClock className="size-3" />
                                        Última recarga realizada: <span className="font-medium text-foreground ml-1">{ultimaRecarga}</span>
                                    </p>
                                )}
                                {extintor.fecha_vencimiento && (
                                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                        <CalendarClock className="size-3" />
                                        Próxima recarga programada: <span className={`font-medium ml-1 ${extintor.vencido ? 'text-red-600' : 'text-foreground'}`}>{extintor.fecha_vencimiento}</span>
                                    </p>
                                )}
                            </div>
                        </label>
                        {formInspeccion.incluye_recarga && (
                            <div className="flex flex-col gap-4 border-t border-sidebar-border/70 dark:border-sidebar-border px-4 pb-4 pt-4 bg-muted/20">
                                <div className="grid grid-cols-2 gap-3 items-end">
                                    <div className="grid gap-1">
                                        <Label className="text-[11px] font-semibold text-muted-foreground">Fecha de recarga realizada</Label>
                                        <Input
                                            type="date"
                                            value={formInspeccion.fecha_recarga}
                                            min={ultimaRecarga ?? undefined}
                                            onChange={e => setInsp('fecha_recarga', e.target.value)}
                                            className="h-9 text-sm" />
                                        <FieldError msg={errorsInspeccion.fecha_recarga} />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-[11px] font-semibold text-muted-foreground">Próxima recarga programada</Label>
                                        <Input
                                            type="date"
                                            value={formInspeccion.fecha_proxima_recarga}
                                            min={formInspeccion.fecha_recarga || undefined}
                                            onChange={e => setInsp('fecha_proxima_recarga', e.target.value)}
                                            className="h-9 text-sm" />
                                        <FieldError msg={errorsInspeccion.fecha_proxima_recarga} />
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground -mt-2">Próxima recarga: actualiza la fecha de vencimiento del extintor</p>
                                <div className="grid gap-1">
                                    <Label className="text-[11px] font-semibold text-muted-foreground">Observaciones de la recarga</Label>
                                    <textarea value={formInspeccion.observaciones_recarga}
                                        onChange={e => setInsp('observaciones_recarga', e.target.value)}
                                        placeholder="Proveedor, tipo de agente, condiciones…" rows={2}
                                        className={TEXTAREA_CLS} />
                                </div>
                            </div>
                        )}
                    </div>
                    )} {/* fin modoEdicion !== 'condiciones' — Recarga */}

                    {/* Vehículo — solo al crear o al editar inspecciones/placa, no al editar condiciones */}
                    {!editInspeccion && modoEdicion !== 'condiciones' && (
                        <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border overflow-hidden">
                            <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors select-none">
                                <input type="checkbox" checked={formInspeccion.registra_vehiculo}
                                    onChange={e => setInsp('registra_vehiculo', e.target.checked)}
                                    className="h-4 w-4 rounded border-sidebar-border/70 focus:ring-ring" />
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Registrar placa / cambio de vehículo</p>
                                    {extintor.placa_actual ? (
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Placa actual: <span className="font-medium text-foreground">{extintor.placa_actual}</span>
                                            {extintor.fecha_colocacion_actual && <span> · desde {extintor.fecha_colocacion_actual}</span>}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-muted-foreground mt-0.5">El extintor está en depósito</p>
                                    )}
                                </div>
                            </label>
                            {formInspeccion.registra_vehiculo && (
                                <div className="flex flex-col gap-3 border-t border-sidebar-border/70 dark:border-sidebar-border px-4 pb-4 pt-4 bg-muted/20">
                                    <div className="grid gap-1">
                                        <Label className="text-[11px] font-semibold text-muted-foreground">
                                            {extintor.placa_actual ? 'Nueva placa (deja vacío para solo retirar)' : 'Placa donde se coloca'}
                                        </Label>
                                        <select value={formInspeccion.nueva_placa}
                                            onChange={e => {
                                                const p = e.target.value;
                                                setInsp('nueva_placa', p);
                                                consultarExtintoresEnPlacaInsp(p);
                                            }}
                                            className="h-9 rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                                            <option value="">{extintor.placa_actual ? '— Retirar sin reasignar —' : '— Seleccionar placa —'}</option>
                                            {placas.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <FieldError msg={errorsInspeccion.nueva_placa} />

                                        {formInspeccion.nueva_placa && (
                                            <div className="mt-1">
                                                {cargandoPlacaInsp ? (
                                                    <div className="flex items-center gap-2 rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                                        <Loader2 className="size-3.5 animate-spin" /> Consultando extintores asociados…
                                                    </div>
                                                ) : extintoresEnPlacaInsp.length > 0 ? (
                                                    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-3">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                                                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                                                Este vehículo ya tiene {extintoresEnPlacaInsp.length} extintor{extintoresEnPlacaInsp.length > 1 ? 'es' : ''} asociado{extintoresEnPlacaInsp.length > 1 ? 's' : ''}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {extintoresEnPlacaInsp.map(ext => (
                                                                <div key={ext.id} className="flex items-center gap-2 rounded-lg border border-amber-300/60 dark:border-amber-700/40 bg-white dark:bg-card p-1.5 pr-2.5">
                                                                    <div className="size-10 rounded-lg border border-sidebar-border/50 overflow-hidden bg-muted/20 flex items-center justify-center shrink-0">
                                                                        {ext.foto_url ? (
                                                                            <img src={ext.foto_url} alt={ext.numero_serie} className="w-full h-full object-contain" />
                                                                        ) : (
                                                                            <FlameKindling className="size-4 text-muted-foreground" />
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs">
                                                                        <p className="font-semibold text-foreground">{ext.numero_serie}</p>
                                                                        <p className="text-muted-foreground">
                                                                            {[ext.tipo_agente, ext.capacidad_kg ? `${ext.capacidad_kg} kg` : null, ext.marca].filter(Boolean).join(' · ')}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-2">
                                                            <label className="flex cursor-pointer items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                                                                <input type="checkbox"
                                                                    checked={formInspeccion.desasociar_previos_insp}
                                                                    onChange={e => setInsp('desasociar_previos_insp', e.target.checked)}
                                                                    className="h-4 w-4 rounded border-amber-400 focus:ring-amber-500" />
                                                                <span>
                                                                    <span className="font-semibold">Desasociar los extintores actuales</span> de este vehículo antes de asignar.
                                                                    {!formInspeccion.desasociar_previos_insp && extintoresEnPlacaInsp.length >= 2 && (
                                                                        <span className="block text-red-600 dark:text-red-400 mt-0.5">El vehículo ya tiene 2 extintores. Debe marcar esta opción para continuar.</span>
                                                                    )}
                                                                </span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10 px-3 py-2 text-xs text-green-700 dark:text-green-300">
                                                        <CheckCircle2 className="size-3.5" /> Sin extintores asociados, se puede asignar directamente.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-[11px] font-semibold text-muted-foreground">Observaciones del cambio</Label>
                                        <textarea value={formInspeccion.observaciones_vehiculo}
                                            onChange={e => setInsp('observaciones_vehiculo', e.target.value)}
                                            placeholder="Motivo del cambio, condiciones…" rows={2}
                                            className={TEXTAREA_CLS} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Evidencias — solo para nuevo */}
                    {!editInspeccion && (
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">
                                Evidencias (fotos / PDF)
                            </Label>
                            <FileSelector onChange={setArchivosInspeccion} />
                            <FieldError msg={errorsInspeccion['evidencias']} />
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="ghost" size="sm"
                            onClick={() => { setModalInspeccion(false); setErrorsInspeccion({}); }}>
                            Cancelar
                        </Button>
                        <Button type="submit" size="sm" disabled={savingInspeccion}
                            className="bg-green-700 hover:bg-green-800 text-white gap-1.5">
                            <ClipboardList className="size-4" />
                            {savingInspeccion ? 'Guardando…' : (editInspeccion ? 'Guardar cambios' : 'Guardar inspección')}
                        </Button>
                    </div>
                </form>
            </Modal>


            {/* ── Modal: Registrar retiro ─────────────────────────────────────── */}
            <Modal open={modalRetirar} onClose={() => { setModalRetirar(false); setErrorsRetirar({}); }}
                title={`Retirar extintor de ${extintor.placa_actual}`}>
                <form onSubmit={handleRetirar} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 grid gap-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Fecha de retiro *</Label>
                            <Input type="date" value={formRetirar.fecha_retiro}
                                onChange={e => setRetirar('fecha_retiro', e.target.value)} required className="h-9 text-sm" />
                            <FieldError msg={errorsRetirar.fecha_retiro} />
                        </div>
                        <div className="col-span-2 grid gap-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Responsable</Label>
                            <Input value={formRetirar.responsable_retiro}
                                onChange={e => setRetirar('responsable_retiro', e.target.value)}
                                placeholder="Nombre" className="h-9 text-sm" />
                        </div>
                        <div className="col-span-2 grid gap-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Observaciones</Label>
                            <Input value={formRetirar.observaciones_retiro}
                                onChange={e => setRetirar('observaciones_retiro', e.target.value)}
                                placeholder="Opcional" className="h-9 text-sm" />
                        </div>
                    </div>
                    <ChecklistSection columnas={columnas_extra} values={formRetirar.checklist_retiro}
                        onChange={setChecklistRetirar} label="Checklist al retirar" />
                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="ghost" size="sm"
                            onClick={() => { setModalRetirar(false); setErrorsRetirar({}); }}>Cancelar</Button>
                        <Button type="submit" size="sm" disabled={savingRetirar}
                            className="bg-green-700 hover:bg-green-800 text-white gap-1.5">
                            <LogOut className="size-4" />{savingRetirar ? 'Guardando…' : 'Confirmar retiro'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ── Modal: QR del extintor ───────────────────────────────────────── */}
            <Modal open={modalQr} onClose={() => setModalQr(false)} title={`Código QR · ${extintor.numero_serie}`}>
                <div className="flex flex-col items-center gap-5">
                    <div ref={qrRef} className="rounded-2xl border border-sidebar-border/70 dark:border-sidebar-border bg-white p-4">
                        {extintor.qr_url && (
                            <QRCodeSVG
                                value={extintor.qr_url}
                                size={220}
                                level="M"
                                includeMargin={false}
                            />
                        )}
                    </div>

                    <div className="flex flex-col items-center gap-1 text-center">
                        <p className="text-base font-bold text-foreground">{extintor.numero_serie}</p>
                        <p className="text-[11px] text-muted-foreground break-all max-w-xs">{extintor.qr_url}</p>
                    </div>

                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                        Al escanear este QR se abre la ficha completa del extintor (requiere iniciar sesión).
                    </p>

                    <div className="flex gap-2 w-full">
                        <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={descargarQr}>
                            <Download className="size-4" /> Descargar
                        </Button>
                        <Button size="sm" className="flex-1 gap-1.5 bg-green-700 hover:bg-green-800 text-white" onClick={imprimirQr}>
                            Imprimir
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Modal: ¿Usar firma guardada? ────────────────────────────── */}
            {modalConfirmarFirma && firmaGuardadaUrl && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => !savingInspeccion && setModalConfirmarFirma(false)} />
                    <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl border border-sidebar-border/70 bg-card shadow-2xl dark:border-sidebar-border p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-foreground">¿Usar firma guardada?</h3>
                            <button
                                type="button"
                                disabled={savingInspeccion}
                                onClick={() => setModalConfirmarFirma(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Tienes una firma registrada anteriormente. ¿Deseas precargarla para esta inspección?
                        </p>
                        <div className="rounded-lg border border-sidebar-border/50 dark:border-sidebar-border bg-white p-3 flex items-center justify-center min-h-[90px]">
                            <img src={firmaGuardadaUrl} alt="Firma guardada"
                                className="max-h-24 max-w-full object-contain" />
                        </div>
                        <div className="flex gap-2 pt-1">
                            <Button variant="ghost" size="sm" className="flex-1"
                                disabled={savingInspeccion}
                                onClick={() => {
                                    firmaPadRef.current?.clear();
                                    setModalConfirmarFirma(false);
                                    setModalFirmaManual(true);
                                }}>
                                No, firmaré de nuevo
                            </Button>
                            <Button size="sm" className="flex-1 bg-green-700 hover:bg-green-800 text-white gap-1.5"
                                disabled={savingInspeccion}
                                onClick={() => ejecutarGuardadoInspeccion({ usarFirmaGuardada: true })}>
                                {savingInspeccion ? <Loader2 className="size-4 animate-spin" /> : null}
                                Sí, usar esta firma
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Dibujar firma después de guardar ──────────────────── */}
            {modalFirmaManual && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => !savingInspeccion && setModalFirmaManual(false)} />
                    <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-sidebar-border/70 bg-card shadow-2xl dark:border-sidebar-border p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-sidebar-border/70 pb-3 dark:border-sidebar-border">
                            <div>
                                <h3 className="text-base font-semibold text-foreground">Firma del responsable</h3>
                                <p className="text-xs text-muted-foreground">Dibuja la firma para registrar la inspección</p>
                            </div>
                            <button
                                type="button"
                                disabled={savingInspeccion}
                                onClick={() => setModalFirmaManual(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="flex justify-center py-1">
                            <FirmaPad
                                ref={firmaPadRef}
                                label=""
                                helpText="Dibuja tu firma con el dedo o el mouse."
                                fileName="firma-inspeccion.png"
                            />
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-sidebar-border/70 dark:border-sidebar-border">
                            <Button variant="ghost" size="sm"
                                disabled={savingInspeccion}
                                onClick={() => setModalFirmaManual(false)}>
                                Volver
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm"
                                    disabled={savingInspeccion}
                                    onClick={() => ejecutarGuardadoInspeccion()}>
                                    Omitir firma
                                </Button>
                                <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white gap-1.5"
                                    disabled={savingInspeccion}
                                    onClick={async () => {
                                        const firmaFile = await firmaPadRef.current?.getFile();
                                        ejecutarGuardadoInspeccion({ firmaFile });
                                    }}>
                                    {savingInspeccion ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                                    {savingInspeccion ? 'Guardando…' : 'Confirmar y guardar'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Editar Registro Inicial del Extintor ──────────────── */}
            <Modal
                open={modalEditarExtintor}
                onClose={() => { setModalEditarExtintor(false); setErrorsEditarExtintor({}); }}
                title={`Editar registro inicial · ${extintor.numero_serie}`}
            >
                <form onSubmit={handleGuardarExtintor} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Número de serie *</Label>
                            <Input
                                value={formEditarExtintor.numero_serie}
                                onChange={e => setExtintorField('numero_serie', e.target.value)}
                                required
                                className="h-9 text-sm"
                            />
                            <FieldError msg={errorsEditarExtintor.numero_serie} />
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Fecha de registro</Label>
                            <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                                {extintor.fecha_creacion ?? '—'}
                            </div>
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Marca</Label>
                            <Input
                                value={formEditarExtintor.marca}
                                onChange={e => setExtintorField('marca', e.target.value)}
                                placeholder="Fabricante"
                                className="h-9 text-sm"
                            />
                            <FieldError msg={errorsEditarExtintor.marca} />
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Capacidad (kg)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                min="0"
                                value={formEditarExtintor.capacidad_kg}
                                onChange={e => setExtintorField('capacidad_kg', e.target.value)}
                                placeholder="Ej: 5 o 10"
                                className="h-9 text-sm"
                            />
                            <FieldError msg={errorsEditarExtintor.capacidad_kg} />
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Fecha de fabricación</Label>
                            <Input
                                type="date"
                                value={formEditarExtintor.fecha_fabricacion}
                                onChange={e => setExtintorField('fecha_fabricacion', e.target.value)}
                                className="h-9 text-sm"
                            />
                            <FieldError msg={errorsEditarExtintor.fecha_fabricacion} />
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Fecha de caducidad</Label>
                            <Input
                                type="date"
                                value={formEditarExtintor.fecha_vencimiento}
                                onChange={e => setExtintorField('fecha_vencimiento', e.target.value)}
                                className="h-9 text-sm"
                            />
                            <FieldError msg={errorsEditarExtintor.fecha_vencimiento} />
                        </div>

                    </div>


                    <div className="flex justify-end gap-2 pt-2 border-t border-sidebar-border/70 dark:border-sidebar-border">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={savingExtintor}
                            onClick={() => { setModalEditarExtintor(false); setErrorsEditarExtintor({}); }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={savingExtintor}
                            className="bg-green-700 hover:bg-green-800 text-white gap-1.5"
                        >
                            {savingExtintor ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                            {savingExtintor ? 'Guardando…' : 'Guardar cambios'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}
