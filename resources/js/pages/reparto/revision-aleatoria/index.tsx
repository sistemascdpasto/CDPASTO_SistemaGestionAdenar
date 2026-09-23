import { EvidenciaUploader, type PickedFile } from '@/components/evidencia-uploader';
import { Ruleta } from '@/components/reparto/ruleta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    History,
    LoaderCircle,
    Plus,
    Settings,
    Sparkles,
    Truck,
    User,
    X,
} from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Revisión Aleatoria', href: '/modules/reparto/revision-aleatoria' },
];

interface RuletaOption {
    id: number;
    placa?: string;
    nombre?: string;
}

interface Causal {
    id: number;
    nombre: string;
    requiere_especificacion: boolean;
}

interface NovedadDetalle {
    id: number;
    sku: string | null;
    producto: string;
    cantidad_revisada: number | null;
    cantidad_novedad: number;
    causal: string | null;
    causal_especificacion: string | null;
    observacion: string | null;
    evidencias: { id: number; url: string }[];
}

interface RevisionHoy {
    id: number;
    fecha: string;
    fecha_formateada: string;
    vehiculo: { id: number; placa: string } | null;
    vehiculo_seleccionado_en: string | null;
    responsable: { id: number; nombre: string } | null;
    responsable_seleccionado_en: string | null;
    resultado: 'sin_novedades' | 'con_novedades' | null;
    finalizada_en: string | null;
    usuario: string | null;
    total_novedades: number;
    novedades: NovedadDetalle[];
}

interface NovedadFormState {
    sku: string;
    producto: string;
    cantidad_revisada: string;
    cantidad_novedad: string;
    causal_id: string;
    causal_especificacion: string;
    observacion: string;
    evidenciasPicked: PickedFile[];
    [key: string]: string | PickedFile[];
}

interface FinalizarForm {
    resultado: 'sin_novedades' | 'con_novedades' | '';
    novedades: NovedadFormState[];
    [key: string]: string | NovedadFormState[];
}

function novedadVacia(): NovedadFormState {
    return {
        sku: '',
        producto: '',
        cantidad_revisada: '',
        cantidad_novedad: '',
        causal_id: '',
        causal_especificacion: '',
        observacion: '',
        evidenciasPicked: [],
    };
}

export default function RevisionAleatoriaIndex({
    revision,
    vehiculosActivos,
    responsablesActivos,
    causales,
}: {
    revision: RevisionHoy | null;
    vehiculosActivos: RuletaOption[];
    responsablesActivos: RuletaOption[];
    causales: Causal[];
}) {
    const { auth } = usePage<SharedData>().props;
    const [girandoVehiculo, setGirandoVehiculo] = useState(false);
    const [girandoResponsable, setGirandoResponsable] = useState(false);
    const [cargandoVehiculo, setCargandoVehiculo] = useState(false);
    const [cargandoResponsable, setCargandoResponsable] = useState(false);
    const [mostrarFormularioSku, setMostrarFormularioSku] = useState(false);

    const form = useForm<FinalizarForm>({
        resultado: '',
        novedades: [novedadVacia()],
    });

    const vehiculoItems = vehiculosActivos.map((v) => ({ id: v.id, label: v.placa ?? '' }));
    const responsableItems = responsablesActivos.map((r) => ({ id: r.id, label: r.nombre ?? '' }));

    const sortearVehiculo = () => {
        setCargandoVehiculo(true);
        router.post(
            route('reparto.revision-aleatoria.seleccionar-vehiculo'),
            {},
            {
                preserveScroll: true,
                onSuccess: () => setGirandoVehiculo(true),
                onFinish: () => setCargandoVehiculo(false),
            },
        );
    };

    const sortearResponsable = () => {
        setCargandoResponsable(true);
        router.post(
            route('reparto.revision-aleatoria.seleccionar-responsable'),
            {},
            {
                preserveScroll: true,
                onSuccess: () => setGirandoResponsable(true),
                onFinish: () => setCargandoResponsable(false),
            },
        );
    };

    const agregarNovedad = () => form.setData('novedades', [...form.data.novedades, novedadVacia()]);
    const quitarNovedad = (index: number) => form.setData('novedades', form.data.novedades.filter((_, i) => i !== index));
    const actualizarNovedad = (index: number, campo: keyof NovedadFormState, valor: string | PickedFile[]) => {
        const copia = [...form.data.novedades];
        copia[index] = { ...copia[index], [campo]: valor };
        form.setData('novedades', copia);
    };

    const finalizarSinNovedades = () => {
        form.transform(() => ({ resultado: 'sin_novedades', novedades: [] }));
        form.post(route('reparto.revision-aleatoria.finalizar'), { preserveScroll: true });
    };

    const enviarConNovedades: React.FormEventHandler = (e) => {
        e.preventDefault();
        form.transform((data) => ({
            resultado: 'con_novedades',
            novedades: data.novedades.map((n) => ({
                sku: n.sku || null,
                producto: n.producto,
                cantidad_revisada: n.cantidad_revisada || null,
                cantidad_novedad: n.cantidad_novedad,
                causal_id: n.causal_id,
                causal_especificacion: n.causal_especificacion || null,
                observacion: n.observacion || null,
                evidencias: n.evidenciasPicked.map((p) => p.file),
            })),
        }));
        form.post(route('reparto.revision-aleatoria.finalizar'), { preserveScroll: true, forceFormData: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Revisión Aleatoria" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Revisión Aleatoria Diaria</h1>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <CalendarDays className="size-4" /> {revision?.fecha_formateada ?? new Date().toLocaleDateString('es-CO')}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <Link href={route('reparto.revision-aleatoria.historial')}>
                                <History className="size-4" /> Historial
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <Link href={route('reparto.revision-aleatoria.indicadores')}>
                                <ClipboardList className="size-4" /> Indicadores
                            </Link>
                        </Button>
                        {auth.isAdmin && (
                            <Button variant="outline" size="sm" asChild className="gap-1.5">
                                <Link href={route('reparto.revision-responsables.index')}>
                                    <Settings className="size-4" /> Configurar
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Revisión ya finalizada hoy: vista de solo lectura */}
                {revision?.finalizada_en && (
                    <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border">
                        <div
                            className={`flex items-center gap-2 rounded-t-xl px-5 py-3 ${
                                revision.resultado === 'con_novedades'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            }`}
                        >
                            {revision.resultado === 'con_novedades' ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
                            <p className="text-sm font-bold">
                                {revision.resultado === 'con_novedades'
                                    ? `Revisión finalizada — ${revision.total_novedades} novedad(es) encontrada(s)`
                                    : 'Revisión finalizada sin novedades'}
                            </p>
                        </div>
                        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                            <ResumenDato label="Vehículo" valor={revision.vehiculo?.placa ?? '—'} icon={Truck} />
                            <ResumenDato label="Responsable" valor={revision.responsable?.nombre ?? '—'} icon={User} />
                            <ResumenDato label="Hora finalización" valor={revision.finalizada_en} icon={CalendarDays} />
                            <ResumenDato label="Registrado por" valor={revision.usuario ?? '—'} icon={User} />
                        </div>
                        {revision.novedades.length > 0 && (
                            <div className="space-y-3 border-t border-sidebar-border/70 p-5 dark:border-sidebar-border">
                                {revision.novedades.map((n, i) => (
                                    <div key={n.id} className="rounded-lg border border-sidebar-border/70 p-3 dark:border-sidebar-border">
                                        <p className="text-xs font-bold text-foreground">
                                            Novedad {i + 1} — {n.producto} {n.sku && <span className="text-muted-foreground">({n.sku})</span>}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Cantidad afectada: <strong className="text-foreground">{n.cantidad_novedad}</strong> · Causal:{' '}
                                            <strong className="text-foreground">{n.causal}</strong>
                                            {n.causal_especificacion && ` — ${n.causal_especificacion}`}
                                        </p>
                                        {n.observacion && <p className="mt-1 text-xs text-muted-foreground italic">"{n.observacion}"</p>}
                                        {n.evidencias.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {n.evidencias.map((e) => (
                                                    <a key={e.id} href={e.url} target="_blank" rel="noreferrer">
                                                        <img src={e.url} className="h-16 w-16 rounded-md border border-border object-cover" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Flujo en progreso o por iniciar */}
                {!revision?.finalizada_en && (
                    <div className="flex flex-col gap-5">
                        {/* Paso 1: vehículo */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                <Truck className="size-4" /> 1. Selección del vehículo
                            </p>
                            <Ruleta
                                items={vehiculoItems}
                                resultadoId={revision?.vehiculo?.id ?? null}
                                girando={girandoVehiculo}
                                onTerminarGiro={() => setGirandoVehiculo(false)}
                            />
                            <div className="mt-3 flex items-center justify-between">
                                {revision?.vehiculo && !girandoVehiculo ? (
                                    <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                        <CheckCircle2 className="size-4" /> Vehículo seleccionado: {revision.vehiculo.placa}
                                    </p>
                                ) : (
                                    <span />
                                )}
                                {!revision?.vehiculo && (
                                    <Button onClick={sortearVehiculo} disabled={cargandoVehiculo || vehiculoItems.length === 0} className="gap-1.5">
                                        {cargandoVehiculo ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                                        Seleccionar vehículo
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Paso 2: responsable */}
                        {revision?.vehiculo && (
                            <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                    <User className="size-4" /> 2. Selección del responsable
                                </p>
                                <Ruleta
                                    items={responsableItems}
                                    resultadoId={revision.responsable?.id ?? null}
                                    girando={girandoResponsable}
                                    onTerminarGiro={() => setGirandoResponsable(false)}
                                    colorFlecha="#0369a1"
                                />
                                <div className="mt-3 flex items-center justify-between">
                                    {revision.responsable && !girandoResponsable ? (
                                        <p className="flex items-center gap-1.5 text-sm font-bold text-sky-700 dark:text-sky-400">
                                            <CheckCircle2 className="size-4" /> Responsable seleccionado: {revision.responsable.nombre}
                                        </p>
                                    ) : (
                                        <span />
                                    )}
                                    {!revision.responsable && (
                                        <Button
                                            onClick={sortearResponsable}
                                            disabled={cargandoResponsable || responsableItems.length === 0}
                                            className="gap-1.5 bg-sky-700 hover:bg-sky-800"
                                        >
                                            {cargandoResponsable ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                                            Seleccionar responsable
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Paso 3: resumen + iniciar SKU */}
                        {revision?.vehiculo && revision.responsable && !girandoVehiculo && !girandoResponsable && !mostrarFormularioSku && (
                            <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                    <ClipboardList className="size-4" /> Revisión diaria
                                </p>
                                <div className="grid gap-2 text-sm sm:grid-cols-2">
                                    <p>
                                        <span className="text-muted-foreground">Fecha:</span> <strong>{revision.fecha_formateada}</strong>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">Hora:</span> <strong>{revision.responsable_seleccionado_en}</strong>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">Placa:</span> <strong>{revision.vehiculo.placa}</strong>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">Responsable:</span> <strong>{revision.responsable.nombre}</strong>
                                    </p>
                                </div>
                                <Button onClick={() => setMostrarFormularioSku(true)} className="mt-4 gap-1.5">
                                    <ChevronRight className="size-4" /> Iniciar revisión SKU
                                </Button>
                            </div>
                        )}

                        {/* Paso 4: formulario SKU */}
                        {revision?.vehiculo && revision.responsable && mostrarFormularioSku && (
                            <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                                <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                    <ClipboardList className="size-4" /> Revisión SKU — {revision.vehiculo.placa}
                                </p>

                                <div className="mb-5">
                                    <Label className="mb-2 block text-xs font-semibold text-muted-foreground">¿Se encontraron novedades?</Label>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <button
                                            type="button"
                                            onClick={() => form.setData('resultado', 'sin_novedades')}
                                            className={`flex flex-1 items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                                                form.data.resultado === 'sin_novedades'
                                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                                                    : 'border-sidebar-border/70 dark:border-sidebar-border'
                                            }`}
                                        >
                                            <CheckCircle2 className="size-4 text-emerald-600" /> No hay novedades
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => form.setData('resultado', 'con_novedades')}
                                            className={`flex flex-1 items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                                                form.data.resultado === 'con_novedades'
                                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                                                    : 'border-sidebar-border/70 dark:border-sidebar-border'
                                            }`}
                                        >
                                            <AlertTriangle className="size-4 text-amber-600" /> Sí, hay novedades
                                        </button>
                                    </div>
                                </div>

                                {form.data.resultado === 'sin_novedades' && (
                                    <Button onClick={finalizarSinNovedades} disabled={form.processing} className="gap-1.5 bg-emerald-700 hover:bg-emerald-800">
                                        {form.processing && <LoaderCircle className="size-4 animate-spin" />}
                                        Finalizar sin novedades
                                    </Button>
                                )}

                                {form.data.resultado === 'con_novedades' && (
                                    <form onSubmit={enviarConNovedades} className="space-y-4">
                                        {form.data.novedades.map((novedad, index) => (
                                            <NovedadFields
                                                key={index}
                                                index={index}
                                                novedad={novedad}
                                                causales={causales}
                                                onChange={actualizarNovedad}
                                                onRemove={() => quitarNovedad(index)}
                                                puedeQuitar={form.data.novedades.length > 1}
                                                errors={form.errors}
                                            />
                                        ))}
                                        <Button type="button" variant="outline" onClick={agregarNovedad} className="gap-1.5">
                                            <Plus className="size-4" /> Agregar novedad
                                        </Button>
                                        <div>
                                            <Button type="submit" disabled={form.processing} className="gap-1.5 bg-amber-700 hover:bg-amber-800">
                                                {form.processing && <LoaderCircle className="size-4 animate-spin" />}
                                                Finalizar y guardar revisión
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function ResumenDato({ label, valor, icon: Icon }: { label: string; valor: string; icon: React.ElementType }) {
    return (
        <div className="rounded-lg border border-sidebar-border/70 bg-muted/30 p-3 dark:border-sidebar-border">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                <Icon className="size-3" /> {label}
            </p>
            <p className="mt-0.5 text-sm font-bold text-foreground">{valor}</p>
        </div>
    );
}

function NovedadFields({
    index,
    novedad,
    causales,
    onChange,
    onRemove,
    puedeQuitar,
    errors,
}: {
    index: number;
    novedad: NovedadFormState;
    causales: Causal[];
    onChange: (index: number, campo: keyof NovedadFormState, valor: string | PickedFile[]) => void;
    onRemove: () => void;
    puedeQuitar: boolean;
    errors: Partial<Record<string, string>>;
}) {
    const causalSeleccionada = causales.find((c) => String(c.id) === novedad.causal_id);

    return (
        <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
            <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold text-foreground">Novedad {index + 1}</p>
                {puedeQuitar && (
                    <Button type="button" variant="ghost" size="icon" className="size-6" onClick={onRemove}>
                        <X className="size-4" />
                    </Button>
                )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label className="text-xs">SKU / código</Label>
                    <Input value={novedad.sku} onChange={(e) => onChange(index, 'sku', e.target.value)} placeholder="Opcional" />
                </div>
                <div className="grid gap-1.5">
                    <Label className="text-xs">Producto</Label>
                    <Input value={novedad.producto} onChange={(e) => onChange(index, 'producto', e.target.value)} required />
                </div>
                <div className="grid gap-1.5">
                    <Label className="text-xs">Cantidad revisada</Label>
                    <Input
                        type="number"
                        min={0}
                        value={novedad.cantidad_revisada}
                        onChange={(e) => onChange(index, 'cantidad_revisada', e.target.value)}
                        placeholder="Opcional"
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label className="text-xs">Cantidad con novedad</Label>
                    <Input
                        type="number"
                        min={1}
                        value={novedad.cantidad_novedad}
                        onChange={(e) => onChange(index, 'cantidad_novedad', e.target.value)}
                        required
                    />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                    <Label className="text-xs">Causal</Label>
                    <Select value={novedad.causal_id} onValueChange={(v) => onChange(index, 'causal_id', v)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona la causal" />
                        </SelectTrigger>
                        <SelectContent>
                            {causales.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                    {c.nombre}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {causalSeleccionada?.requiere_especificacion && (
                    <div className="grid gap-1.5 sm:col-span-2">
                        <Label className="text-xs">Especifica el motivo</Label>
                        <Input
                            value={novedad.causal_especificacion}
                            onChange={(e) => onChange(index, 'causal_especificacion', e.target.value)}
                            required
                        />
                    </div>
                )}
                <div className="grid gap-1.5 sm:col-span-2">
                    <Label className="text-xs">Observación (opcional)</Label>
                    <Textarea
                        value={novedad.observacion}
                        onChange={(e) => onChange(index, 'observacion', e.target.value)}
                        className="min-h-16"
                    />
                </div>
                <div className="sm:col-span-2">
                    <EvidenciaUploader
                        files={novedad.evidenciasPicked}
                        onChange={(files) => onChange(index, 'evidenciasPicked', files)}
                        error={errors[`novedades.${index}.evidencias`]}
                    />
                </div>
            </div>
        </div>
    );
}
