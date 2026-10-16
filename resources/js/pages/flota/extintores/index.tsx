import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { QrScanner } from '@/components/flota/QrScanner';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import type { RequestPayload } from '@inertiajs/core';
import {
    AlertTriangle,
    Camera,
    CheckCircle2,
    Columns3,
    Eye,
    FileDown,
    FlameKindling,
    Loader2,
    Maximize2,
    Pencil,
    Plus,
    ScanLine,
    Trash2,
    Upload,
    X,
    XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Extintores', href: '/modules/flota/extintores' },
];

// ─── Mapa de codificación de partes ───────────────────────────────────────────

const PARTES_LABELS: Record<string, string> = {
    '1':'Asa Percutora','2':'Asa de Acarreo','3':'Manómetro',
    '4':'Pasador de Seguridad','5':'Presinto de Seguridad',
    '6':'Válvula de Seguridad','7':'Tapa del Cilindro',
    '8':'Cartucho Impulsor','9':'Manguera',
    '10':'Pitón, Boquilla o Tobera','11':'Válvula de descarga',
    '12':'Cuello del Cilindro','13':'Cuerpo del cilindro',
    '14':'Válvula Reguladora de Presión','15':'Falda o Base de Sustentación',
    '16':'Fondo del Cilindro','17':'Soporte',
    '18':'Gancho de Sujeción del Extintor','19':'Hombro del Cilindro',
    '20':'Mecanismo de Punzado','21':'Ruedas o Neumáticos',
    '22':'Empacaduras','23':'Soporte de la Manguera',
    '24':'Rotulación','25':'Asa de Sujeción a la Pared',
    '26':'Número y/o Siglas del Equipo',
    '27':'Etiqueta con Fecha de Ultima Recarga',
};

function resolverPartes(valor: string | null): string {
    if (!valor) return '—';
    return valor.split(',').map(c => c.trim()).filter(Boolean).map(c => {
        const label = PARTES_LABELS[c];
        return label ? `${c} - ${label}` : c;
    }).join(', ');
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtintorRow {
    id: number;
    numero_serie: string;
    tipo_agente: string | null;
    capacidad_kg: string | null;
    marca: string | null;
    fecha_fabricacion: string | null;
    fecha_vencimiento: string | null;
    observaciones: string | null;
    vencido: boolean;
    condicion: string | null;
    agente_impulsor: string | null;
    parte_mantenimiento: string | null;
    senalizacion: string | null;
    demarcacion: string | null;
    funcionamiento: string | null;
    acceso: string | null;
    ultima_inspeccion_fecha: string | null;
    ultima_recarga: string | null;
    placa_actual: string | null;
    asignacion_activa_id: number | null;
    fecha_colocacion_actual: string | null;
    foto_url?: string | null;
}

interface Paginator {
    data: ExtintorRow[];
    current_page: number;
    last_page: number;
    total: number;
}

interface Props {
    extintores: Paginator;
    placas: string[];
    columnas_extra: string[];
    filters: { serie?: string; placa?: string };
    imagenes_referencia?: {
        ref_1: string | null;
        ref_2: string | null;
    };
}

// ─── Modal genérico ───────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: {
    open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
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
            <div ref={ref} className="relative z-10 w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-2xl border border-sidebar-border/70 bg-card shadow-2xl dark:border-sidebar-border mx-4">
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

// ─── Formulario extintor ──────────────────────────────────────────────────────

const SELECT_CLS = "h-9 rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

interface FormData {
    numero_serie: string;
    tipo_agente: string;
    capacidad_kg: string;
    marca: string;
    fecha_fabricacion: string;
    fecha_vencimiento: string;
    condicion: string;
    agente_impulsor: string;
    parte_mantenimiento: string;
    senalizacion: string;
    demarcacion: string;
    funcionamiento: string;
    acceso: string;
    observaciones: string;
    foto?: File | null;
    foto_preview?: string | null;
}

function FormExtintor({ initial, onSubmit, submitting, errors, onCancel }: {
    initial: FormData;
    onSubmit: (d: FormData) => void;
    submitting: boolean;
    errors: Partial<Record<keyof FormData, string>>;
    onCancel: () => void;
}) {
    const [f, setF] = useState<FormData>(initial);
    const set = (k: keyof FormData, v: FormData[keyof FormData]) => setF(p => ({ ...p, [k]: v }));
    const [previewUrl, setPreviewUrl] = useState<string | null>(initial.foto_preview ?? null);
    const fileRef = useRef<HTMLInputElement>(null);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        set('foto', file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    return (
        <form onSubmit={e => { e.preventDefault(); onSubmit(f); }} className="flex flex-col gap-5">

            {/* ── Foto del extintor ── */}
            <div className="flex items-center gap-3.5 p-3 rounded-xl border border-sidebar-border/70 bg-muted/20">
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                />
                <div
                    onClick={() => fileRef.current?.click()}
                    title="Clic para seleccionar foto"
                    className="size-16 rounded-lg border-2 border-dashed border-sidebar-border/80 bg-card hover:border-primary/60 transition-colors cursor-pointer overflow-hidden flex items-center justify-center shrink-0"
                >
                    {previewUrl ? (
                        <img src={previewUrl} alt="Foto extintor" className="w-full h-full object-contain p-0.5" />
                    ) : (
                        <Camera className="size-6 text-muted-foreground" />
                    )}
                </div>
                <div className="flex-1 space-y-1">
                    <p className="text-xs font-semibold text-foreground">Foto del extintor</p>
                    <p className="text-[10px] text-muted-foreground">Adjunte la fotografía física del equipo</p>
                    <div className="flex items-center gap-2 pt-0.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => fileRef.current?.click()}
                        >
                            <Upload className="size-3" /> {previewUrl ? 'Cambiar foto' : 'Subir foto'}
                        </Button>
                        {previewUrl && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-red-500 hover:text-red-600"
                                onClick={() => {
                                    setPreviewUrl(null);
                                    set('foto', null);
                                    if (fileRef.current) fileRef.current.value = '';
                                }}
                            >
                                Quitar
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Identificación ── */}
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">N° de Serie *</Label>
                    <Input value={f.numero_serie} onChange={e => set('numero_serie', e.target.value)}
                        placeholder="Ej. EXT-2024-001" required className="h-9 text-sm" />
                    {errors.numero_serie && <p className="text-[10px] text-red-500">{errors.numero_serie}</p>}
                </div>
                <div className="grid gap-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Marca</Label>
                    <Input value={f.marca} onChange={e => set('marca', e.target.value)}
                        placeholder="Fabricante" className="h-9 text-sm" />
                </div>
                <div className="grid gap-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Fecha fabricación</Label>
                    <Input type="date" value={f.fecha_fabricacion}
                        onChange={e => set('fecha_fabricacion', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Fecha vencimiento / recarga</Label>
                    <Input type="date" value={f.fecha_vencimiento}
                        onChange={e => set('fecha_vencimiento', e.target.value)} className="h-9 text-sm" />
                </div>
            </div>

            {/* ── Checklist ── */}
            <div className="rounded-xl border border-dashed border-sidebar-border/70 dark:border-sidebar-border p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Checklist de condiciones
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Condición</Label>
                        <select value={f.condicion} onChange={e => set('condicion', e.target.value)} className={SELECT_CLS}>
                            <option value="">— Seleccionar —</option>
                            <option value="buena">Buena</option>
                            <option value="mala">Mala</option>
                        </select>
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Agente extintor</Label>
                        <select value={f.tipo_agente} onChange={e => set('tipo_agente', e.target.value)} className={SELECT_CLS}>
                            <option value="">— Seleccionar —</option>
                            <option value="ABC">ABC</option>
                            <option value="Otro">Otro</option>
                            {f.tipo_agente && !['ABC', 'Otro', ''].includes(f.tipo_agente) && (
                                <option value={f.tipo_agente}>{f.tipo_agente}</option>
                            )}
                        </select>
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Agente impulsor</Label>
                        <select value={f.agente_impulsor} onChange={e => set('agente_impulsor', e.target.value)} className={SELECT_CLS}>
                            <option value="">— Seleccionar —</option>
                            <option value="directa">Directa</option>
                            <option value="indirecta">Indirecta</option>
                        </select>
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Demarcación</Label>
                        <select value={f.demarcacion} onChange={e => set('demarcacion', e.target.value)} className={SELECT_CLS}>
                            <option value="">— Seleccionar —</option>
                            <option value="buena">Buena</option>
                            <option value="mala">Mala</option>
                            <option value="N/A">N/A</option>
                        </select>
                    </div>

                    <div className="grid gap-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Señalización</Label>
                        <select value={f.senalizacion} onChange={e => set('senalizacion', e.target.value)} className={SELECT_CLS}>
                            <option value="">— Seleccionar —</option>
                            <option value="buena">Buena</option>
                            <option value="mala">Mala</option>
                            {f.senalizacion && !['buena', 'mala', ''].includes(f.senalizacion) && (
                                <option value={f.senalizacion}>{f.senalizacion}</option>
                            )}
                        </select>
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Funcionamiento del Extintor</Label>
                        <select value={f.funcionamiento} onChange={e => set('funcionamiento', e.target.value)} className={SELECT_CLS}>
                            <option value="">— Seleccionar —</option>
                            <option value="bueno">Bueno</option>
                            <option value="malo">Malo</option>
                            {f.funcionamiento && !['bueno', 'malo', ''].includes(f.funcionamiento) && (
                                <option value={f.funcionamiento}>{f.funcionamiento}</option>
                            )}
                        </select>
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Acceso al Extintor</Label>
                        <select value={f.acceso} onChange={e => set('acceso', e.target.value)} className={SELECT_CLS}>
                            <option value="">— Seleccionar —</option>
                            <option value="bueno">Bueno</option>
                            <option value="malo">Malo</option>
                            {f.acceso && !['bueno', 'malo', ''].includes(f.acceso) && (
                                <option value={f.acceso}>{f.acceso}</option>
                            )}
                        </select>
                    </div>
                    <div className="col-span-2 grid gap-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Observaciones</Label>
                        <Input value={f.observaciones} onChange={e => set('observaciones', e.target.value)}
                            placeholder="Opcional" className="h-9 text-sm" />
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={submitting}
                    className="bg-green-700 hover:bg-green-800 text-white">
                    {submitting ? 'Guardando…' : 'Guardar'}
                </Button>
            </div>
        </form>
    );
}

// ─── Modal gestión de columnas ────────────────────────────────────────────────

function ModalColumnas({ open, onClose, columnas }: {
    open: boolean; onClose: () => void; columnas: string[];
}) {
    const [nueva, setNueva] = useState('');
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const [confirmCol, setConfirmCol] = useState<string | null>(null);

    const agregar = (e: React.FormEvent) => {
        e.preventDefault();
        const nombre = nueva.trim();
        if (!nombre) { setError('Escribe un nombre.'); return; }
        setProcessing(true);
        router.post(route('flota.extintores.columnas.store'), { nombre }, {
            onSuccess: () => { setNueva(''); setError(''); setProcessing(false); },
            onError: (errs) => { setError(errs.nombre ?? 'Error'); setProcessing(false); },
            preserveScroll: true,
        });
    };

    const eliminar = (nombre: string) => {
        router.delete(route('flota.extintores.columnas.destroy'), {
            data: { nombre }, preserveScroll: true,
            onSuccess: () => setConfirmCol(null),
        });
    };

    return (
        <Modal open={open} onClose={onClose} title="Columnas del checklist">
            <div className="flex flex-col gap-5">
                {columnas.length === 0 ? (
                    <p className="text-sm text-center text-muted-foreground py-3">
                        No hay columnas aún. Agrega la primera abajo.
                    </p>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                            Columnas actuales
                        </p>
                        {columnas.map(col => (
                            <div key={col} className="flex items-center justify-between rounded-lg border border-sidebar-border/50 dark:border-sidebar-border px-3 py-2 text-sm">
                                <span>{col}</span>
                                {confirmCol === col ? (
                                    <span className="flex items-center gap-1.5">
                                        <span className="text-[11px] text-muted-foreground">¿Eliminar?</span>
                                        <button type="button" onClick={() => eliminar(col)}
                                            className="rounded px-2 py-0.5 text-[10px] font-semibold bg-red-600 text-white hover:bg-red-700">
                                            Sí
                                        </button>
                                        <button type="button" onClick={() => setConfirmCol(null)}
                                            className="text-muted-foreground hover:text-foreground">
                                            <X className="size-3.5" />
                                        </button>
                                    </span>
                                ) : (
                                    <button type="button" onClick={() => setConfirmCol(col)}
                                        className="text-muted-foreground hover:text-red-500 transition-colors">
                                        <Trash2 className="size-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                <form onSubmit={agregar} className="flex flex-col gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Agregar columna
                    </p>
                    <div className="flex gap-2">
                        <Input value={nueva} onChange={e => { setNueva(e.target.value); setError(''); }}
                            placeholder="Ej: Presión (bar), Sello OK…"
                            className="h-9 text-sm flex-1" autoFocus />
                        <Button type="submit" disabled={processing || !nueva.trim()} size="sm"
                            className="bg-green-700 hover:bg-green-800 text-white gap-1.5 shrink-0">
                            <Plus className="size-4" /> Agregar
                        </Button>
                    </div>
                    {error && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertTriangle className="size-3" />{error}</p>}
                    <p className="text-[11px] text-muted-foreground">
                        Estas columnas aparecen en el checklist al colocar y al retirar el extintor.
                        Eliminar una columna no borra los datos históricos.
                    </p>
                </form>
            </div>
        </Modal>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ExtintoresIndex({ extintores, placas, columnas_extra, filters, imagenes_referencia }: Props) {
    // Flash
    const { props } = usePage<{ flash?: { success?: string }; status?: string | { message?: string } }>();
    const flashMsg = (() => {
        const s = props.status;
        if (!s) return props.flash?.success ?? null;
        if (typeof s === 'string') return s;
        return s.message ?? null;
    })();
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    useEffect(() => { if (flashMsg) setSuccessMsg(flashMsg); }, [flashMsg]);

    // Filtros
    const [serie, setSerie] = useState(filters.serie ?? '');
    const [placa, setPlaca] = useState(filters.placa ?? '');

    const aplicar = (overrides: Partial<typeof filters> = {}) =>
        router.get(route('flota.extintores.index'),
            { serie: overrides.serie ?? serie, placa: overrides.placa ?? placa },
            { preserveState: true, preserveScroll: true, replace: true });

    const limpiar = () => { setSerie(''); setPlaca(''); router.get(route('flota.extintores.index'), {}); };

    // Modal nuevo / editar
    const [modalOpen, setModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<ExtintorRow | null>(null);
    const [saving, setSaving] = useState(false);
    const [formErrors, setFormErrors] = useState<Partial<Record<string, string>>>({});

    const formVacio = (): FormData => ({
        numero_serie: '', tipo_agente: '', capacidad_kg: '',
        marca: '', fecha_fabricacion: '', fecha_vencimiento: '',
        condicion: '', agente_impulsor: '', parte_mantenimiento: '',
        senalizacion: '', demarcacion: '', funcionamiento: '',
        acceso: '', observaciones: '',
    });

    const formDesde = (row: ExtintorRow): FormData => ({
        numero_serie:        row.numero_serie,
        tipo_agente:         row.tipo_agente ?? '',
        capacidad_kg:        row.capacidad_kg ?? '',
        marca:               row.marca ?? '',
        fecha_fabricacion:   row.fecha_fabricacion ?? '',
        fecha_vencimiento:   row.fecha_vencimiento ?? '',
        condicion:           row.condicion ?? '',
        agente_impulsor:     row.agente_impulsor ?? '',
        parte_mantenimiento: row.parte_mantenimiento ?? '',
        senalizacion:        row.senalizacion ?? '',
        demarcacion:         row.demarcacion ?? '',
        funcionamiento:      row.funcionamiento ?? '',
        acceso:              row.acceso ?? '',
        observaciones:       row.observaciones ?? '',
        foto_preview:        row.foto_url ?? '',
        foto:                null,
    });

    const handleSubmit = (data: FormData) => {
        setSaving(true); setFormErrors({});
        const payload: FormData & { _method?: string } = { ...data };
        delete payload.foto_preview;
        if (!payload.foto) delete payload.foto;

        if (editTarget) {
            router.post(route('flota.extintores.update', editTarget.id), { ...payload, _method: 'put' } as unknown as RequestPayload, {
                forceFormData: true,
                onSuccess: () => { setModalOpen(false); setEditTarget(null); setSaving(false); },
                onError: (e) => { setFormErrors(e); setSaving(false); },
            });
        } else {
            router.post(route('flota.extintores.store'), payload as unknown as RequestPayload, {
                forceFormData: true,
                onSuccess: () => { setModalOpen(false); setSaving(false); },
                onError: (e) => { setFormErrors(e); setSaving(false); },
            });
        }
    };

    // Eliminar
    const [confirmId, setConfirmId] = useState<number | null>(null);
    const handleDelete = (id: number) => {
        router.delete(route('flota.extintores.destroy', id), { preserveScroll: true });
        setConfirmId(null);
    };

    // Modal columnas
    const [colModalOpen, setColModalOpen] = useState(false);

    // Modal escáner QR
    const [scannerOpen, setScannerOpen] = useState(false);

    // Imágenes de referencia (Sección A)
    const fileInputRef1 = useRef<HTMLInputElement>(null);
    const fileInputRef2 = useRef<HTMLInputElement>(null);
    const [uploadingRef, setUploadingRef] = useState<1 | 2 | null>(null);
    const [localPreview1, setLocalPreview1] = useState<string | null>(null);
    const [localPreview2, setLocalPreview2] = useState<string | null>(null);
    const [img1Error, setImg1Error] = useState(false);
    const [img2Error, setImg2Error] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

    useEffect(() => {
        setLocalPreview1(null);
        setImg1Error(false);
    }, [imagenes_referencia?.ref_1]);

    useEffect(() => {
        setLocalPreview2(null);
        setImg2Error(false);
    }, [imagenes_referencia?.ref_2]);

    const handleUploadImage = (numero: 1 | 2, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Por favor seleccione un archivo de imagen válido.');
            e.target.value = '';
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        if (numero === 1) {
            setLocalPreview1(previewUrl);
            setImg1Error(false);
        } else {
            setLocalPreview2(previewUrl);
            setImg2Error(false);
        }

        setUploadingRef(numero);
        const data = new FormData();
        data.append('numero', String(numero));
        data.append('imagen', file);

        router.post(route('flota.extintores.referencia-imagen'), data, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => {
                setUploadingRef(null);
                e.target.value = '';
            },
            onError: (errs) => {
                setUploadingRef(null);
                console.error('Error al subir imagen de referencia:', errs);
            },
        });
    };

    const handleDeleteRefImage = (numero: 1 | 2) => {
        if (!confirm(`¿Desea eliminar la imagen de referencia ${numero}?`)) return;
        router.delete(route('flota.extintores.referencia-imagen.destroy'), {
            data: { numero },
            preserveScroll: true,
            onSuccess: () => {
                if (numero === 1) {
                    setLocalPreview1(null);
                    setImg1Error(true);
                } else {
                    setLocalPreview2(null);
                    setImg2Error(true);
                }
            },
        });
    };

    const img1Src = (!img1Error && (localPreview1 || imagenes_referencia?.ref_1)) || null;
    const img2Src = (!img2Error && (localPreview2 || imagenes_referencia?.ref_2)) || null;

    const hayFiltros = serie || placa;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Extintores" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">

                {/* Banner éxito */}
                {successMsg && (
                    <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 dark:border-green-800/40 dark:bg-green-900/10">
                        <CheckCircle2 className="size-5 shrink-0 text-green-700" />
                        <p className="flex-1 text-sm font-semibold text-green-800 dark:text-green-300">{successMsg}</p>
                        <button type="button" onClick={() => setSuccessMsg(null)} className="text-green-400 hover:text-green-600">
                            <XCircle className="size-4" />
                        </button>
                    </div>
                )}

                {/* Título */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
                            <FlameKindling className="size-7 text-red-500" />
                            Extintores
                        </h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Inventario y trazabilidad de extintores · {extintores.total} registros
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setScannerOpen(true)}>
                            <ScanLine className="size-4" /> Escanear QR
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setColModalOpen(true)}>
                            <Columns3 className="size-4" /> Columnas del checklist
                        </Button>
                        <a href={route('flota.extintores.exportar-tabla')} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <FileDown className="size-4" /> Exportar Excel
                            </Button>
                        </a>
                        <Button size="sm" className="gap-1.5 bg-green-700 hover:bg-green-800 text-white"
                            onClick={() => { setEditTarget(null); setModalOpen(true); }}>
                            <Plus className="size-4" /> Nuevo extintor
                        </Button>
                    </div>
                </div>

                {/* Filtros */}
                <div className="rounded-2xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border p-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">N° Serie</Label>
                            <Input value={serie} onChange={e => { setSerie(e.target.value); aplicar({ serie: e.target.value }); }}
                                placeholder="Buscar…" className="h-8 text-xs" />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Placa actual</Label>
                            <select value={placa} onChange={e => { setPlaca(e.target.value); aplicar({ placa: e.target.value }); }}
                                className="h-8 rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                                <option value="">Todas</option>
                                {placas.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
                    {hayFiltros && (
                        <div className="mt-2 flex justify-end">
                            <Button variant="ghost" size="sm" onClick={limpiar} className="h-7 text-xs text-muted-foreground gap-1">
                                <X className="size-3" /> Limpiar
                            </Button>
                        </div>
                    )}
                </div>

                {/* ── Tabla de codificación de partes ─────────────────────── */}
                <div className="rounded-2xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                    <div className="px-5 py-3 border-b border-sidebar-border/70 dark:border-sidebar-border bg-muted/40">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            A — Codificación de partes inspeccionadas que requieren mantenimiento
                        </p>
                    </div>
                    <div className="flex flex-col lg:flex-row items-stretch">
                        {/* Imágenes a la izquierda: una al lado de la otra, misma altura que la tabla */}
                        <div className="flex flex-row items-stretch gap-3 p-3 sm:p-4 border-b lg:border-b-0 lg:border-r border-sidebar-border/50 dark:border-sidebar-border shrink-0 w-full lg:w-[460px] xl:w-[500px] min-h-[220px] lg:min-h-0">
                            {/* Inputs de archivo ocultos */}
                            <input
                                ref={fileInputRef1}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleUploadImage(1, e)}
                            />
                            <input
                                ref={fileInputRef2}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleUploadImage(2, e)}
                            />

                            {/* Imagen 1 (Más ancha: flex-[1.4]) */}
                            <div
                                onClick={() => img1Src ? setLightboxSrc(img1Src) : fileInputRef1.current?.click()}
                                title={img1Src ? 'Clic para ver la imagen en grande' : 'Clic para subir la imagen 1'}
                                className="flex-[1.4] relative rounded-xl border-2 border-dashed border-sidebar-border/70 dark:border-sidebar-border hover:border-primary/60 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer overflow-hidden group flex flex-col items-center justify-center"
                            >
                                {uploadingRef === 1 ? (
                                    <div className="flex flex-col items-center justify-center gap-2 p-3 text-center">
                                        <Loader2 className="size-6 animate-spin text-primary" />
                                        <span className="text-xs font-medium text-foreground">Subiendo imagen 1...</span>
                                    </div>
                                ) : img1Src ? (
                                    <div className="relative w-full h-full flex items-center justify-center p-2">
                                        <img
                                            src={img1Src}
                                            alt="Extintor referencia 1"
                                            className="w-full h-full object-contain pointer-events-none select-none transition-transform duration-200 group-hover:scale-[1.02]"
                                            onError={() => setImg1Error(true)}
                                        />
                                        <span className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded bg-background/85 dark:bg-card/85 backdrop-blur-sm border border-sidebar-border/60 text-[10px] font-semibold text-muted-foreground shadow-xs">
                                            Ref. 1
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteRefImage(1);
                                            }}
                                            title="Eliminar imagen 1"
                                            className="absolute top-2 right-2 z-10 p-1 rounded bg-background/85 dark:bg-card/85 backdrop-blur-sm border border-sidebar-border/60 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition-all shadow-xs"
                                        >
                                            <Trash2 className="size-3" />
                                        </button>
                                        {/* Overlay: ver en grande + botón cambiar imagen */}
                                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white p-2 text-center rounded-xl backdrop-blur-[0.5px]">
                                            <div className="rounded-full bg-white/20 p-2 backdrop-blur-sm">
                                                <Maximize2 className="size-4 text-white" />
                                            </div>
                                            <span className="text-xs font-semibold leading-tight">Ver imagen</span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); fileInputRef1.current?.click(); }}
                                                className="mt-1 flex items-center gap-1 rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-1 text-[11px] font-medium text-white transition-colors backdrop-blur-sm"
                                            >
                                                <Upload className="size-3" /> Cambiar imagen
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center p-3 gap-2">
                                        <div className="rounded-full bg-muted/80 p-2.5 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                            <Upload className="size-5" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-semibold text-foreground">Imagen 1</p>
                                            <p className="text-[10px] text-muted-foreground">Clic para subir imagen</p>
                                        </div>
                                        <span className="inline-block text-[10px] text-muted-foreground/80 bg-muted/50 px-2 py-0.5 rounded-full border border-sidebar-border/40">
                                            Más ancha
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Imagen 2 (Más angosta: flex-1) */}
                            <div
                                onClick={() => img2Src ? setLightboxSrc(img2Src) : fileInputRef2.current?.click()}
                                title={img2Src ? 'Clic para ver la imagen en grande' : 'Clic para subir la imagen 2'}
                                className="flex-1 relative rounded-xl border-2 border-dashed border-sidebar-border/70 dark:border-sidebar-border hover:border-primary/60 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer overflow-hidden group flex flex-col items-center justify-center"
                            >
                                {uploadingRef === 2 ? (
                                    <div className="flex flex-col items-center justify-center gap-2 p-3 text-center">
                                        <Loader2 className="size-6 animate-spin text-primary" />
                                        <span className="text-xs font-medium text-foreground">Subiendo imagen 2...</span>
                                    </div>
                                ) : img2Src ? (
                                    <div className="relative w-full h-full flex items-center justify-center p-2">
                                        <img
                                            src={img2Src}
                                            alt="Extintor referencia 2"
                                            className="w-full h-full object-contain pointer-events-none select-none transition-transform duration-200 group-hover:scale-[1.02]"
                                            onError={() => setImg2Error(true)}
                                        />
                                        <span className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded bg-background/85 dark:bg-card/85 backdrop-blur-sm border border-sidebar-border/60 text-[10px] font-semibold text-muted-foreground shadow-xs">
                                            Ref. 2
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteRefImage(2);
                                            }}
                                            title="Eliminar imagen 2"
                                            className="absolute top-2 right-2 z-10 p-1 rounded bg-background/85 dark:bg-card/85 backdrop-blur-sm border border-sidebar-border/60 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition-all shadow-xs"
                                        >
                                            <Trash2 className="size-3" />
                                        </button>
                                        {/* Overlay: ver en grande + botón cambiar imagen */}
                                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white p-2 text-center rounded-xl backdrop-blur-[0.5px]">
                                            <div className="rounded-full bg-white/20 p-2 backdrop-blur-sm">
                                                <Maximize2 className="size-4 text-white" />
                                            </div>
                                            <span className="text-xs font-semibold leading-tight">Ver imagen</span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); fileInputRef2.current?.click(); }}
                                                className="mt-1 flex items-center gap-1 rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-1 text-[11px] font-medium text-white transition-colors backdrop-blur-sm"
                                            >
                                                <Upload className="size-3" /> Cambiar imagen
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center p-3 gap-2">
                                        <div className="rounded-full bg-muted/80 p-2.5 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                            <Upload className="size-5" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-semibold text-foreground">Imagen 2</p>
                                            <p className="text-[10px] text-muted-foreground">Clic para subir imagen</p>
                                        </div>
                                        <span className="inline-block text-[10px] text-muted-foreground/80 bg-muted/50 px-2 py-0.5 rounded-full border border-sidebar-border/40">
                                            Más angosta
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Codificación — 3 columnas */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-sidebar-border/50 dark:divide-sidebar-border">
                            <div className="px-4 py-3 space-y-1.5">
                                {[['1','Asa Percutora'],['2','Asa de Acarreo'],['3','Manómetro'],['4','Pasador de Seguridad'],['5','Presinto de Seguridad'],['6','Válvula de Seguridad'],['7','Tapa del Cilindro'],['8','Cartucho Impulsor'],['9','Manguera']].map(([n, d]) => (
                                    <div key={n} className="flex items-start gap-2 text-xs text-muted-foreground">
                                        <span className="shrink-0 font-semibold text-foreground w-6">{n}-</span><span>{d}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="px-4 py-3 space-y-1.5">
                                {[['10','Pitón, Boquilla o Tobera'],['11','Válvula de descarga'],['12','Cuello del Cilindro'],['13','Cuerpo del cilindro'],['14','Válvula Reguladora de Presión'],['15','Falda o Base de Sustentación'],['16','Fondo del Cilindro'],['17','Soporte'],['18','Gancho de Sujeción del Extintor']].map(([n, d]) => (
                                    <div key={n} className="flex items-start gap-2 text-xs text-muted-foreground">
                                        <span className="shrink-0 font-semibold text-foreground w-6">{n}-</span><span>{d}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="px-4 py-3 space-y-1.5">
                                {[['19','Hombro del Cilindro'],['20','Mecanismo de Punzado'],['21','Ruedas o Neumáticos'],['22','Empacaduras'],['23','Soporte de la Manguera'],['24','Rotulación'],['25','Asa de Sujeción a la Pared'],['26','Número y/o Siglas del Equipo'],['27','Etiqueta con Fecha de Ultima Recarga']].map(([n, d]) => (
                                    <div key={n} className="flex items-start gap-2 text-xs text-muted-foreground">
                                        <span className="shrink-0 font-semibold text-foreground w-6">{n}-</span><span>{d}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabla */}
                <div className="rounded-2xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted dark:bg-muted">
                                    {['Foto', 'N° Serie', 'Última Inspección', 'Condición', 'Agente extintor', 'Agente impulsor', 'Última recarga', 'Parte Mantenimiento', 'Señalización', 'Demarcación', 'Funcionamiento', 'Acceso al Extintor', 'Placa actual', 'Observaciones', ''].map(h => (
                                        <TableHead key={h} className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{h}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {extintores.data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={15} className="py-12 text-center text-sm text-muted-foreground">
                                            <FlameKindling className="mx-auto mb-2 size-7 opacity-30" />
                                            No hay extintores registrados
                                        </TableCell>
                                    </TableRow>
                                )}
                                {extintores.data.map(row => (
                                    <TableRow key={row.id} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="w-12 py-1.5 px-3">
                                            <Link href={route('flota.extintores.show', row.id)}>
                                                <div className="size-9 rounded-lg border border-sidebar-border/70 bg-muted/30 hover:border-primary/60 transition-colors overflow-hidden flex items-center justify-center shrink-0">
                                                    {row.foto_url ? (
                                                        <img src={row.foto_url} alt={row.numero_serie} className="w-full h-full object-contain p-0.5" />
                                                    ) : (
                                                        <FlameKindling className="size-4 text-muted-foreground/40" />
                                                    )}
                                                </div>
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-xs font-mono font-semibold text-foreground whitespace-nowrap">
                                            <Link href={route('flota.extintores.show', row.id)} className="hover:underline">
                                                {row.numero_serie}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {row.ultima_inspeccion_fecha ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground capitalize">{row.condicion ?? '—'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{row.tipo_agente ?? '—'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground capitalize">{row.agente_impulsor ?? '—'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{row.ultima_recarga ?? '—'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[200px]" title={resolverPartes(row.parte_mantenimiento)}>
                                            <span className="line-clamp-2">{resolverPartes(row.parte_mantenimiento)}</span>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{row.senalizacion ?? '—'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{row.demarcacion ?? '—'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{row.funcionamiento ?? '—'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{row.acceso ?? '—'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{row.placa_actual ?? '—'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{row.observaciones ?? '—'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                                                    <Link href={route('flota.extintores.show', row.id)}>
                                                        <Eye className="size-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                                    </Link>
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild title="Exportar Excel">
                                                    <a href={route('flota.extintores.exportar-excel', row.id)} target="_blank" rel="noopener noreferrer">
                                                        <FileDown className="size-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                                    </a>
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                                    onClick={() => { setEditTarget(row); setModalOpen(true); }}>
                                                    <Pencil className="size-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                                </Button>
                                                {confirmId === row.id ? (
                                                    <span className="flex items-center gap-1">
                                                        <button type="button" onClick={() => handleDelete(row.id)}
                                                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-600 text-white hover:bg-red-700">
                                                            Confirmar
                                                        </button>
                                                        <button type="button" onClick={() => setConfirmId(null)}
                                                            className="text-muted-foreground hover:text-foreground">
                                                            <X className="size-3.5" />
                                                        </button>
                                                    </span>
                                                ) : (
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                                        onClick={() => setConfirmId(row.id)}>
                                                        <Trash2 className="size-3.5 text-muted-foreground/60 hover:text-red-500 transition-colors" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Paginación */}
                    {extintores.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-sidebar-border/70 px-4 py-3 dark:border-sidebar-border">
                            <p className="text-[11px] text-muted-foreground">
                                Página {extintores.current_page} de {extintores.last_page} · {extintores.total} extintores
                            </p>
                            <div className="flex gap-1">
                                {extintores.current_page > 1 && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                                        onClick={() => router.get(route('flota.extintores.index'), { ...filters, page: extintores.current_page - 1 })}>
                                        ‹ Anterior
                                    </Button>
                                )}
                                {extintores.current_page < extintores.last_page && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                                        onClick={() => router.get(route('flota.extintores.index'), { ...filters, page: extintores.current_page + 1 })}>
                                        Siguiente ›
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

                          

            {/* Modal nuevo / editar */}
            <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditTarget(null); setFormErrors({}); }}
                title={editTarget ? `Editar · ${editTarget.numero_serie}` : 'Nuevo extintor'}>
                <FormExtintor
                    initial={editTarget ? formDesde(editTarget) : formVacio()}
                    onSubmit={handleSubmit}
                    submitting={saving}
                    errors={formErrors}
                    onCancel={() => { setModalOpen(false); setEditTarget(null); setFormErrors({}); }}
                />
            </Modal>

            {/* Modal columnas */}
            <ModalColumnas open={colModalOpen} onClose={() => setColModalOpen(false)} columnas={columnas_extra} />

            {/* Modal escáner QR */}
            {scannerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setScannerOpen(false)} />
                    <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl border border-sidebar-border/70 bg-card shadow-2xl dark:border-sidebar-border p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                                <ScanLine className="size-5" /> Escanear QR de extintor
                            </h2>
                            <button type="button" onClick={() => setScannerOpen(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="size-5" />
                            </button>
                        </div>
                        <QrScanner onClose={() => setScannerOpen(false)} />
                    </div>
                </div>
            )}

            {/* ── Lightbox imágenes de referencia ──────────────────────── */}
            {lightboxSrc && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setLightboxSrc(null)}
                >
                    <button
                        type="button"
                        onClick={() => setLightboxSrc(null)}
                        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
                        title="Cerrar"
                    >
                        <X className="size-5" />
                    </button>
                    <img
                        src={lightboxSrc}
                        alt="Vista ampliada"
                        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </AppLayout>
    );
}
