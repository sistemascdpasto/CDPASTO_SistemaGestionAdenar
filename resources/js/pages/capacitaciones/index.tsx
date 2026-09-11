import { CrearCarpetaDialog } from '@/components/capacitaciones/crear-carpeta-dialog';
import { FileIcon, getFileCategoryInfo } from '@/components/capacitaciones/file-icon';
import HeadingSmall from '@/components/heading-small';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    ArrowDownUp,
    ArrowRight,
    BookOpen,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    Eye,
    EyeOff,
    Filter,
    Flame,
    Folder,
    FolderPlus,
    MoreVertical,
    Pencil,
    PieChart as PieIcon,
    Search,
    ShieldAlert,
    Trash2,
    TrendingUp,
    Users,
} from 'lucide-react';
import {  FormEventHandler, useEffect, useMemo, useState , memo, useCallback } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Capacitaciones', href: '/modules/capacitaciones' },
];

interface Carpeta {
    id: number;
    nombre: string;
    descripcion: string | null;
    color: string | null;
    portada_url: string | null;
    visible_colaborador?: boolean;
    materiales_count: number;
    created_at: string;
}

interface MaterialReciente {
    id: number;
    titulo: string;
    descripcion: string | null;
    tipo: string;
    tamano_humano: string | null;
    archivo_path: string | null;
    enlace_externo: string | null;
    created_at: string;
    carpeta: {
        id: number;
        nombre: string;
        color: string | null;
    } | null;
}

interface ColaboradorMetrica {
    user_id: number;
    nombre_completo: string;
    cedula: string;
    cargo: string;
    area: string;
    revisadas_count: number;
    total_materiales: number;
    faltantes_count: number;
    porcentaje: number;
    estado_key: 'completado' | 'en_proceso' | 'sin_actividad';
    completado: boolean;
    en_proceso: boolean;
    sin_actividad: boolean;
    ultima_revision: string;
}

interface CapacitacionRanking {
    id: number;
    titulo: string;
    tipo: string;
    carpeta: {
        id: number;
        nombre: string;
        color: string | null;
    } | null;
    revisiones_count: number;
    trabajadores: {
        user_id: number;
        nombre: string;
        cedula: string;
        cargo: string;
        fecha: string;
        fecha_exacta: string;
    }[];
}

interface ActividadItem {
    id: number;
    trabajador_nombre: string;
    trabajador_cedula: string;
    capacitacion_titulo: string;
    carpeta: {
        id: number;
        nombre: string;
        color: string | null;
    } | null;
    revisada_humano: string;
    revisada_exacta: string;
}

interface GraficaActividadItem {
    fecha: string;
    fecha_completa: string;
    revisiones: number;
}

interface DistribucionItem {
    name: string;
    key: string;
    cantidad: number;
    color: string;
}

interface BannerAdmin {
    frase: string | null;
    sub_frase: string | null;
    imagen_url: string | null;
}

export default function CapacitacionesAdminIndex({
    carpetas = [],
    recientes = [],
    distribucionEstados = [],
    colaboradores = [],
    colaboradoresResumen = { total: 0, completados: 0, en_proceso: 0, sin_actividad: 0 },
    rankingCapacitaciones = [],
    actividadReciente = [],
    graficaActividad = [],
    filters = {},
    banner = null,
}: {
    carpetas?: Carpeta[];
    recientes?: MaterialReciente[];
    distribucionEstados?: DistribucionItem[];
    colaboradores?: ColaboradorMetrica[];
    colaboradoresResumen?: {
        total: number;
        completados: number;
        en_proceso: number;
        sin_actividad: number;
    };
    rankingCapacitaciones?: CapacitacionRanking[];
    actividadReciente?: ActividadItem[];
    graficaActividad?: GraficaActividadItem[];
    filters?: any;
    banner?: BannerAdmin | null;
}) {
    // Asignar colaboradores recibidos del backend a colaboradoresDetalle para uso interno
    const colaboradoresDetalle = colaboradores || [];
    // Filtros del panel
    const [busqueda, setBusqueda] = useState(filters?.buscar || '');
    const [carpetaFiltro, setCarpetaFiltro] = useState(filters?.carpeta_id || 'todas');
    const [estadoFiltro, setEstadoFiltro] = useState(filters?.estado || 'todos');
    const [fechaInicio, setFechaInicio] = useState(filters?.fecha_inicio || '');
    const [fechaFin, setFechaFin] = useState(filters?.fecha_fin || '');
    const [ordenamientoTabla, setOrdenamientoTabla] = useState<'critico_a_completo' | 'completo_a_critico' | 'nombre'>('critico_a_completo');

    // Despliegue seguro de la tabla de trabajadores (Desplegada por defecto)
    const [tablaDesplegada, setTablaDesplegada] = useState(true);

    // Modales de interacción
    const [dialogoCrear, setDialogoCrear] = useState(false);
    const [carpetaEditar, setCarpetaEditar] = useState<Carpeta | null>(null);
    const [carpetaEliminar, setCarpetaEliminar] = useState<Carpeta | null>(null);
    const [capacitacionDetalle, setCapacitacionDetalle] = useState<CapacitacionRanking | null>(null);

    // Estado del formulario del banner
    const [bannerForm, setBannerForm] = useState({
        frase: banner?.frase ?? '',
        sub_frase: banner?.sub_frase ?? '',
        imagen: null as File | null,
    });
    const [bannerSeccionAbierta, setBannerSeccionAbierta] = useState(false);

    // Garantizar que el puntero nunca quede bloqueado por Radix UI
    useEffect(() => {
        document.body.style.pointerEvents = '';
    }, [tablaDesplegada, dialogoCrear, carpetaEditar, carpetaEliminar, capacitacionDetalle]);

    const aplicarFiltros: FormEventHandler = (e) => {
        e.preventDefault();
        setTablaDesplegada(true);
        router.get(
            route('capacitaciones.index'),
            {
                buscar: busqueda,
                carpeta_id: carpetaFiltro === 'todas' ? '' : carpetaFiltro,
                estado: estadoFiltro === 'todos' ? '' : estadoFiltro,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
            },
            { preserveState: true, replace: true }
        );
    };

    const limpiarFiltros = () => {
        setBusqueda('');
        setCarpetaFiltro('todas');
        setEstadoFiltro('todos');
        setFechaInicio('');
        setFechaFin('');
        setTablaDesplegada(true);
        router.get(route('capacitaciones.index'), {}, { preserveState: true, replace: true });
    };

    // Promedio global de porcentaje de avance (Guarded)
    const promedioAvanceGlobal = useMemo(() => {
        const list = colaboradores || [];
        if (list.length === 0) return 0;
        const suma = list.reduce((acc, curr) => acc + (curr.porcentaje || 0), 0);
        return Math.round(suma / list.length);
    }, [colaboradores]);

    // Ordenamiento dinámico de la tabla (Guarded)
    const colaboradoresOrdenados = useMemo(() => {
        const copy = Array.isArray(colaboradores) ? [...colaboradores] : [];
        if (ordenamientoTabla === 'critico_a_completo') {
            return copy.sort((a, b) => (a.porcentaje || 0) - (b.porcentaje || 0));
        }
        if (ordenamientoTabla === 'completo_a_critico') {
            return copy.sort((a, b) => (b.porcentaje || 0) - (a.porcentaje || 0));
        }
        return copy.sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''));
    }, [colaboradores, ordenamientoTabla]);

    // Búsqueda en vivo sobre carpetas
    const carpetasFiltradas = useMemo(() => {
        const list = Array.isArray(carpetas) ? carpetas : [];
        if (!busqueda.trim()) return list;
        const q = busqueda.toLowerCase();
        return list.filter(
            (c) => c.nombre.toLowerCase().includes(q) || (c.descripcion && c.descripcion.toLowerCase().includes(q))
        );
    }, [carpetas, busqueda]);

    const handleEliminarCarpeta = () => {
        if (!carpetaEliminar) return;
        router.delete(route('capacitaciones.carpetas.destroy', carpetaEliminar.id), {
            preserveScroll: true,
            onSuccess: () => {
                setCarpetaEliminar(null);
                document.body.style.pointerEvents = '';
            },
        });
    };

    const cambiarFiltroEstado = (nuevoEstado?: any) => {
        let key = 'todos';
        if (typeof nuevoEstado === 'string') {
            key = nuevoEstado;
        } else if (nuevoEstado?.key) {
            key = nuevoEstado.key;
        } else if (nuevoEstado?.payload?.key) {
            key = nuevoEstado.payload.key;
        }

        setEstadoFiltro(key);
        setTablaDesplegada(true);
        router.get(
            route('capacitaciones.index'),
            {
                estado: key === 'todos' ? '' : key,
                buscar: busqueda,
                carpeta_id: carpetaFiltro === 'todas' ? '' : carpetaFiltro,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
            },
            { preserveState: true, replace: true }
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Capacitaciones - Panel Analítico de Gestión" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6 max-w-7xl mx-auto w-full">
                {/* 1. CABECERA PRINCIPAL */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <HeadingSmall
                        title="Panel Analítico de Capacitaciones"
                        description="Analiza la interacción del personal, monitorea estados críticos y programa fechas en el calendario."
                    />

                    <Button
                        onClick={() => {
                            setCarpetaEditar(null);
                            setDialogoCrear(true);
                        }}
                        className="shadow-sm self-start sm:self-auto"
                    >
                        <FolderPlus className="mr-2 size-4" />
                        Nueva carpeta
                    </Button>
                </div>

                {/* 1.B BANNER DEL PORTAL COLABORADOR */}
                <Card className="border-sidebar-border/70 bg-card shadow-sm">
                    <CardHeader
                        className="pb-2 cursor-pointer select-none"
                        onClick={() => setBannerSeccionAbierta((p) => !p)}
                    >
                        <CardTitle className="text-base font-bold flex items-center justify-between">
                            <span>🖼️ Banner del portal colaborador</span>
                            <ChevronDown
                                className={`size-4 text-muted-foreground transition-transform duration-200 ${bannerSeccionAbierta ? 'rotate-180' : ''}`}
                            />
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                            Imagen y frase que ven los colaboradores al entrar al centro de capacitaciones.
                        </p>
                    </CardHeader>

                    {bannerSeccionAbierta && (
                        <CardContent className="pt-0 pb-5">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData();
                                    formData.append('frase', bannerForm.frase ?? '');
                                    formData.append('sub_frase', bannerForm.sub_frase ?? '');
                                    if (bannerForm.imagen) {
                                        formData.append('imagen', bannerForm.imagen);
                                    }
                                    router.post(route('capacitaciones.banner.save'), formData, {
                                        forceFormData: true,
                                        preserveScroll: true,
                                    });
                                }}
                                className="space-y-4"
                            >
                                {/* Preview de imagen actual */}
                                {banner?.imagen_url && (
                                    <div className="rounded-lg overflow-hidden border max-w-xs">
                                        <img
                                            src={banner.imagen_url}
                                            alt="Banner actual"
                                            className="w-full h-32 object-cover"
                                        />
                                        <p className="text-[11px] text-muted-foreground px-2 py-1">Imagen actual del banner</p>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <Label htmlFor="banner-imagen" className="text-xs font-semibold">
                                        Nueva imagen (opcional)
                                    </Label>
                                    <Input
                                        id="banner-imagen"
                                        type="file"
                                        accept="image/*"
                                        className="text-xs h-9"
                                        onChange={(e) =>
                                            setBannerForm((prev) => ({
                                                ...prev,
                                                imagen: e.target.files?.[0] ?? null,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="banner-frase" className="text-xs font-semibold">
                                        Frase principal (máx. 300 caracteres)
                                    </Label>
                                    <textarea
                                        id="banner-frase"
                                        maxLength={300}
                                        rows={2}
                                        value={bannerForm.frase}
                                        onChange={(e) =>
                                            setBannerForm((prev) => ({ ...prev, frase: e.target.value }))
                                        }
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                                        placeholder="Ej: Tu aprendizaje impulsa tu seguridad y la de tus compañeros."
                                    />
                                    <p className="text-[11px] text-muted-foreground text-right">{bannerForm.frase.length}/300</p>
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="banner-sub-frase" className="text-xs font-semibold">
                                        Sub-frase (máx. 300 caracteres)
                                    </Label>
                                    <textarea
                                        id="banner-sub-frase"
                                        maxLength={300}
                                        rows={2}
                                        value={bannerForm.sub_frase}
                                        onChange={(e) =>
                                            setBannerForm((prev) => ({ ...prev, sub_frase: e.target.value }))
                                        }
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                                        placeholder="Ej: Explora los materiales disponibles y marca tu progreso."
                                    />
                                    <p className="text-[11px] text-muted-foreground text-right">{bannerForm.sub_frase.length}/300</p>
                                </div>

                                <Button type="submit" size="sm" className="mt-1">
                                    Guardar banner
                                </Button>
                            </form>
                        </CardContent>
                    )}
                </Card>

                {/* 2. BARRA DE FILTROS AVANZADOS */}
                <Card className="border-sidebar-border/70 bg-card shadow-sm">
                    <CardContent className="p-4">
                        <form onSubmit={aplicarFiltros} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <Search className="size-3.5" /> Buscar Trabajador / Palabra
                                </Label>
                                <Input
                                    placeholder="Nombre, cédula, cargo..."
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <Folder className="size-3.5" /> Filtrar por Categoría
                                </Label>
                                <Select value={carpetaFiltro} onValueChange={setCarpetaFiltro}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Todas las categorías" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todas">Todas las categorías</SelectItem>
                                        {(carpetas || []).map((c) => (
                                            <SelectItem key={c.id} value={String(c.id)}>
                                                <span className="flex items-center gap-1.5"><Folder className="size-3.5" /> {c.nombre}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <Calendar className="size-3.5" /> Fecha Inicio
                                </Label>
                                <Input
                                    type="date"
                                    value={fechaInicio}
                                    onChange={(e) => setFechaInicio(e.target.value)}
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <Calendar className="size-3.5" /> Fecha Fin
                                </Label>
                                <Input
                                    type="date"
                                    value={fechaFin}
                                    onChange={(e) => setFechaFin(e.target.value)}
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button type="submit" size="sm" className="h-9 flex-1">
                                    <Filter className="mr-1.5 size-3.5" /> Aplicar
                                </Button>
                                {(busqueda || carpetaFiltro !== 'todas' || estadoFiltro !== 'todos' || fechaInicio || fechaFin) && (
                                    <Button type="button" variant="outline" size="sm" onClick={limpiarFiltros} className="h-9">
                                        Limpiar
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* 3. BLOQUE ANALÍTICO PROTEGIDO POR ERROR BOUNDARY */}
                
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <Card className="lg:col-span-5 border-sidebar-border/70 bg-card flex flex-col justify-between">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <PieIcon className="size-4 text-teal-600 dark:text-teal-400" />
                                        Cumplimiento de Trabajadores
                                    </span>
                                    <Badge variant="secondary" className="text-[11px] font-semibold">
                                        {(colaboradoresResumen?.total || 0)} evaluados
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5 pt-2">
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 bg-muted/20 rounded-xl p-3 border">
                                    <div className="size-36 relative flex items-center justify-center">
                                        {distribucionEstados && Array.isArray(distribucionEstados) && distribucionEstados.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%" key={`pie-rc-${distribucionEstados.length}-${Date.now()}`}>
                                            <PieChart>
                                                <Pie
                                                    data={Array.isArray(distribucionEstados) ? distribucionEstados : []}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={42}
                                                    outerRadius={62}
                                                    paddingAngle={4}
                                                    dataKey="cantidad"
                                                    cursor="pointer"
                                                    isAnimationActive={false}
                                                    onClick={(entry) => cambiarFiltroEstado(entry)}
                                                >
                                                    {(distribucionEstados || []).map((entry, index) => (
                                                        <Cell key={`cell-${entry?.key ?? index}-${index}`} fill={entry?.color ?? '#cccccc'} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: 'var(--popover)',
                                                        borderColor: 'var(--border)',
                                                        borderRadius: '8px',
                                                        fontSize: '12px',
                                                    }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-xs text-muted-foreground p-4">
                                            No hay datos disponibles para mostrar
                                        </div>
                                    )}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-xl font-extrabold text-foreground">{promedioAvanceGlobal}%</span>
                                            <span className="text-[9px] text-muted-foreground font-bold">Promedio</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 flex-1 w-full sm:w-auto">
                                        {(distribucionEstados || []).map((item) => {
                                            const total = colaboradoresResumen?.total ?? 0;
                                            const pct = total > 0
                                                ? Math.round((item.cantidad / total) * 100)
                                                : 0;
                                            const isSelected = estadoFiltro === item.key;

                                            return (
                                                <Button
                                                    key={item.key}
                                                    type="button"
                                                    variant={isSelected ? 'default' : 'outline'}
                                                    onClick={() => cambiarFiltroEstado(item.key)}
                                                    className="w-full h-auto justify-between py-2 px-2 text-left font-normal"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                                        <span>{item.name}</span>
                                                    </span>
                                                    <span className="font-extrabold">
                                                        {item.cantidad} ({pct}%)
                                                    </span>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t">
                                    <div className="p-3 rounded-lg border bg-card">
                                        <span className="text-muted-foreground block text-[11px]">Promedio Avance Global</span>
                                        <span className="text-lg font-extrabold text-teal-600 dark:text-teal-400">
                                            {promedioAvanceGlobal}%
                                        </span>
                                    </div>
                                    <div className="p-3 rounded-lg border bg-card">
                                        <span className="text-muted-foreground block text-[11px]">Participación Activa</span>
                                        <span className="text-lg font-extrabold" style={{ color: '#3F7A22' }}>
                                            {(() => {
                                                const total = colaboradoresResumen?.total ?? 0;
                                                const completados = colaboradoresResumen?.completados ?? 0;
                                                const enProceso = colaboradoresResumen?.en_proceso ?? 0;
                                                return total > 0
                                                    ? Math.round(((completados + enProceso) / total) * 100)
                                                    : 0;
                                            })()}%
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-7 border-sidebar-border/70 bg-card flex flex-col justify-between">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Activity className="size-4 text-teal-600 dark:text-teal-400" />
                                        Actividad y Revisiones en el Tiempo
                                    </span>
                                    <Badge variant="secondary" className="text-[11px] font-normal">
                                        Frecuencia diaria
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-2 flex-1 flex flex-col justify-center">
                                {!graficaActividad || !Array.isArray(graficaActividad) || graficaActividad.length === 0 ? (
                                    <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-xs">
                                        No hay datos de revisiones registradas en el período seleccionado.
                                    </div>
                                ) : (
                                    <div className="h-64 w-full" key={`area-wrapper-${(graficaActividad || []).length}`}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={Array.isArray(graficaActividad) ? graficaActividad : []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorRevisiones" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#0D9488" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                                                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: 'var(--popover)',
                                                        borderColor: 'var(--border)',
                                                        borderRadius: '8px',
                                                        fontSize: '12px',
                                                    }}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="revisiones"
                                                    name="Revisiones"
                                                    stroke="#0D9488"
                                                    strokeWidth={2.5}
                                                    fillOpacity={1}
                                                    fill="url(#colorRevisiones)"
                                                    isAnimationActive={false}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                

                {/* 4. RANKING & ACTIVIDAD RECIENTE */}
                
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 border-sidebar-border/70 bg-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Flame className="size-4 fill-current" style={{ color: '#d03b3b' }} />
                                        Ranking de Capacitaciones Más Consultadas
                                    </span>
                                    <span className="text-xs font-normal text-muted-foreground">Top por interacciones</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-2">
                                {(rankingCapacitaciones || []).length === 0 ? (
                                    <div className="p-6 text-center text-xs text-muted-foreground">
                                        No hay capacitaciones con revisiones registradas.
                                    </div>
                                ) : (
                                    <div className="divide-y rounded-lg border">
                                        {(rankingCapacitaciones || []).map((item, idx) => (
                                            <div
                                                key={item.id}
                                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-xs text-muted-foreground">
                                                        #{idx + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-bold text-foreground truncate">
                                                            {item.titulo}
                                                        </h4>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                            <span className="flex items-center gap-1"><Folder className="size-3" /> {item.carpeta?.nombre || "General"}</span>
                                                            <span>•</span>
                                                            <span className="capitalize">{item.tipo}</span>
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                                                    <Badge
                                                        className="font-semibold"
                                                        style={{ backgroundColor: '#d03b3b1a', color: '#d03b3b', borderColor: '#d03b3b4d' }}
                                                    >
                                                        {item.revisiones_count} {item.revisiones_count === 1 ? 'revisión' : 'revisiones'}
                                                    </Badge>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setCapacitacionDetalle(item)}
                                                        className="text-xs h-8 gap-1"
                                                    >
                                                        <Eye className="size-3.5" />
                                                        Ver trabajadores
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-sidebar-border/70 bg-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Clock className="size-4 text-teal-600 dark:text-teal-400" />
                                    Actividad Reciente
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-2">
                                {(actividadReciente || []).length === 0 ? (
                                    <div className="p-6 text-center text-xs text-muted-foreground">
                                        Sin actividad reciente registrada.
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                                        {(actividadReciente || []).map((item) => (
                                            <div
                                                key={item.id}
                                                className="rounded-lg border p-3 bg-muted/20 text-xs space-y-1 hover:bg-muted/40 transition-colors"
                                            >
                                                <div className="flex items-center justify-between font-semibold">
                                                    <span className="text-foreground truncate">{item.trabajador_nombre}</span>
                                                    <span className="text-[11px] text-muted-foreground font-normal">
                                                        {item.revisada_humano}
                                                    </span>
                                                </div>
                                                <p className="text-muted-foreground truncate">
                                                    <BookOpen className="mr-1 inline size-3 align-middle" />{item.capacitacion_titulo}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                

                {/* 5. SECCIÓN DESPLEGABLE DE SEGUIMIENTO: DETALLE DE AVANCE POR TRABAJADOR */}
                
                    <Card className="border-sidebar-border/70 bg-card">
                        <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Users className="size-4 text-teal-600 dark:text-teal-400" />
                                    Detalle de Avance por Trabajador ({colaboradoresOrdenados.length})
                                </CardTitle>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTablaDesplegada((prev) => !prev)}
                                    className="text-xs h-7 gap-1 font-semibold"
                                >
                                    <ChevronDown className={`size-3.5 transition-transform duration-200 ${tablaDesplegada ? 'rotate-180' : ''}`} />
                                    {tablaDesplegada ? 'Plegar' : 'Desplegar'}
                                </Button>
                            </div>

                            {/* Filtro de Ordenamiento: De Crítico a Completo o Viceversa */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <ArrowDownUp className="size-3.5" /> Ordenar:
                                </span>
                                <Select
                                    value={ordenamientoTabla}
                                    onValueChange={(val) => setOrdenamientoTabla(val as any)}
                                >
                                    <SelectTrigger className="h-8 text-xs w-[190px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="critico_a_completo">De Crítico a Completo</SelectItem>
                                        <SelectItem value="completo_a_critico">De Completo a Crítico</SelectItem>
                                        <SelectItem value="nombre">Por Nombre Trabajador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-2">
                            {/* Contenedor persistente para la tabla (evita desmontaje brusco de componentes DOM) */}
                            <div className={tablaDesplegada ? 'block' : 'hidden'}>
                                <div className="rounded-lg border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                            <TableRow>
                                                <TableHead>Trabajador</TableHead>
                                                <TableHead>Cargo / Área</TableHead>
                                                <TableHead className="text-center">Revisadas</TableHead>
                                                <TableHead className="text-center">Indicador & Progreso</TableHead>
                                                <TableHead className="text-center">Estado</TableHead>
                                                <TableHead className="text-right">Última actividad</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {colaboradoresOrdenados.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="py-8 text-center">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                                                <Users className="size-6 text-muted-foreground" />
                                                            </div>
                                                            <p className="text-sm font-medium text-muted-foreground">No hay trabajadores registrados</p>
                                                            <p className="text-xs text-muted-foreground mt-1">Verifica los filtros seleccionados o contacta al administrador.</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                colaboradoresOrdenados.map((c) => (
                                                    <TableRow key={`worker-${c.user_id}`} className="hover:bg-muted/30">
                                                        <TableCell>
                                                            <div className="font-bold text-sm text-foreground">{c.nombre_completo}</div>
                                                            <div className="text-xs text-muted-foreground">{c.cedula}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="text-xs font-medium text-foreground">{c.cargo}</div>
                                                            <div className="text-xs text-muted-foreground">{c.area}</div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold text-sm">
                                                            {c.revisadas_count} / {c.total_materiales}
                                                        </TableCell>

                                                        <TableCell className="text-center">
                                                            <div className="flex items-center justify-center gap-3">
                                                                <div className="relative size-8 flex items-center justify-center shrink-0 font-extrabold text-[10px]">
                                                                    <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                                                                        <path
                                                                            className="text-muted"
                                                                            strokeWidth="3.5"
                                                                            stroke="currentColor"
                                                                            fill="none"
                                                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                                        />
                                                                        <path
                                                                            style={{
                                                                                color: c.completado
                                                                                    ? '#3F7A22'
                                                                                    : c.en_proceso
                                                                                    ? '#0D9488'
                                                                                    : '#fab219',
                                                                            }}
                                                                            strokeDasharray={`${c.porcentaje}, 100`}
                                                                            strokeWidth="3.5"
                                                                            strokeLinecap="round"
                                                                            stroke="currentColor"
                                                                            fill="none"
                                                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                                        />
                                                                    </svg>
                                                                    <span className="absolute">{c.porcentaje}%</span>
                                                                </div>

                                                                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden hidden sm:block">
                                                                    <div
                                                                        className="h-full rounded-full"
                                                                        style={{
                                                                            width: `${c.porcentaje}%`,
                                                                            backgroundColor: c.completado
                                                                                ? '#3F7A22'
                                                                                : c.en_proceso
                                                                                ? '#0D9488'
                                                                                : '#fab219',
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="text-center">
                                                            {c.completado ? (
                                                                <Badge
                                                                    className="text-xs"
                                                                    style={{ backgroundColor: '#3F7A221a', color: '#3F7A22', borderColor: '#3F7A224d' }}
                                                                >
                                                                    <CheckCircle2 className="size-3 mr-1" /> Completado 100%
                                                                </Badge>
                                                            ) : c.en_proceso ? (
                                                                <Badge className="bg-teal-500/15 text-teal-700 border-teal-300 dark:bg-teal-950/60 dark:text-teal-400 text-xs">
                                                                    En proceso
                                                                </Badge>
                                                            ) : (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs"
                                                                    style={{ backgroundColor: '#fab2191a', borderColor: '#fab2194d' }}
                                                                >
                                                                    <ShieldAlert className="size-3 mr-1" style={{ color: '#fab219' }} /> Sin actividad
                                                                </Badge>
                                                            )}
                                                        </TableCell>

                                                        <TableCell className="text-right text-xs text-muted-foreground capitalize font-medium">
                                                            {c.ultima_revision}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                                                    </Table>
                                </div>
                            </div>

                            {!tablaDesplegada && (
                                <button
                                    type="button"
                                    onClick={() => setTablaDesplegada(true)}
                                    className="flex w-full items-center justify-between p-4 rounded-xl border border-dashed border-teal-500/40 bg-teal-500/5 hover:bg-teal-500/10 transition-colors text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                                        <Users className="size-4 text-teal-600" />
                                        <span>Haz clic para desplegar la lista detallada de ({colaboradoresOrdenados.length}) trabajadores</span>
                                    </span>
                                    <span className="text-xs h-7 inline-flex items-center px-3 text-teal-600 dark:text-teal-400 font-bold">
                                        Desplegar tabla ↓
                                    </span>
                                </button>
                            )}
                        </CardContent>
                    </Card>
                

                {/* 6. GESTIÓN DE CARPETAS */}
                <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                            Carpetas Creadas ({carpetasFiltradas.length})
                        </h2>
                    </div>

                    {carpetasFiltradas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-sidebar-border/80 p-12 text-center">
                            <div className="flex size-14 items-center justify-center rounded-full bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                                <Folder className="size-7" />
                            </div>
                            <h3 className="mt-4 text-base font-medium text-foreground">
                                {busqueda ? 'No se encontraron carpetas con ese término' : 'No hay carpetas creadas'}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                                Crea carpetas para organizar los contenidos.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {carpetasFiltradas.map((carpeta) => {
                                const folderColor = carpeta.color || '#0D9488';
                                return (
                                    <Card
                                        key={carpeta.id}
                                        className="group relative flex flex-col justify-between overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-sidebar-border/70 dark:border-sidebar-border bg-card"
                                    >
                                        {carpeta.portada_url ? (
                                            <div className="relative h-64 w-full overflow-hidden bg-muted">
                                                <img
                                                    src={carpeta.portada_url}
                                                    alt={carpeta.nombre}
                                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                                <div
                                                    className="absolute bottom-2.5 left-3 size-9 rounded-lg flex items-center justify-center shadow-md"
                                                    style={{ backgroundColor: folderColor, color: '#ffffff' }}
                                                >
                                                    <Folder className="size-5 fill-current" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="h-2 w-full"
                                                style={{ backgroundColor: folderColor }}
                                            />
                                        )}

                                        <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    {!carpeta.portada_url && (
                                                        <div
                                                            className="flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                                                            style={{
                                                                backgroundColor: `${folderColor}1a`,
                                                                color: folderColor,
                                                            }}
                                                        >
                                                            <Folder className="size-5 fill-current opacity-90" />
                                                        </div>
                                                    )}

                                                    <div className="ml-auto">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="size-8 text-muted-foreground hover:text-foreground"
                                                                >
                                                                    <MoreVertical className="size-4" />
                                                                    <span className="sr-only">Opciones</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="notranslate">
                                                                <DropdownMenuItem
                                                                    onClick={() => {
                                                                        setCarpetaEditar(carpeta);
                                                                        setDialogoCrear(true);
                                                                    }}
                                                                >
                                                                    <Pencil className="mr-2 size-4" />
                                                                    <span>Editar carpeta</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
                                                                    onClick={() => setCarpetaEliminar(carpeta)}
                                                                >
                                                                    <Trash2 className="mr-2 size-4" />
                                                                    <span>Eliminar</span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>

                                                <Link
                                                    href={route('capacitaciones.carpetas.show', carpeta.id)}
                                                    className="mt-2 block"
                                                    onClick={() => {
                                                        document.body.style.pointerEvents = '';
                                                    }}
                                                >
                                                    <h3 className="font-bold text-base text-foreground line-clamp-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors flex items-center justify-between gap-1">
                                                        <span>{carpeta.nombre}</span>
                                                        <span className="shrink-0">
                                                            {carpeta.visible_colaborador === false && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[10px] font-medium"
                                                                    style={{ color: '#d03b3b', borderColor: '#d03b3b4d', backgroundColor: '#d03b3b1a' }}
                                                                >
                                                                    <EyeOff className="size-3 mr-1" style={{ color: '#d03b3b' }} />
                                                                    <span>Oculta</span>
                                                                </Badge>
                                                            )}
                                                        </span>
                                                    </h3>
                                                    {carpeta.descripcion && (
                                                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                                            {carpeta.descripcion}
                                                        </p>
                                                    )}
                                                </Link>
                                            </div>

                                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                                                <span className="font-medium text-foreground/80">
                                                    {carpeta.materiales_count} {carpeta.materiales_count === 1 ? 'material' : 'materiales'}
                                                </span>
                                                <Link
                                                    href={route('capacitaciones.carpetas.show', carpeta.id)}
                                                    className="text-teal-600 dark:text-teal-400 font-semibold hover:underline flex items-center gap-1"
                                                    onClick={() => {
                                                        document.body.style.pointerEvents = '';
                                                    }}
                                                >
                                                    Gestionar <ArrowRight className="size-3" />
                                                </Link>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DETALLE TRABAJADORES DE UNA CAPACITACIÓN DEL RANKING */}
            <Dialog
                open={!!capacitacionDetalle}
                onOpenChange={(open) => {
                    if (!open) {
                        setCapacitacionDetalle(null);
                        document.body.style.pointerEvents = '';
                    }
                }}
            >
                <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-6">
                    {capacitacionDetalle && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                    <Flame className="size-5" style={{ color: '#d03b3b' }} />
                                    {capacitacionDetalle.titulo}
                                </DialogTitle>
                                <DialogDescription>
                                    Trabajadores que han completado esta capacitación (Total: {capacitacionDetalle?.trabajadores?.length ?? 0}).
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto my-2 rounded-xl border">
                                {colaboradoresDetalle && colaboradoresDetalle.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Trabajador</TableHead>
                                            <TableHead>Cédula</TableHead>
                                            <TableHead>Cargo</TableHead>
                                            <TableHead className="text-right">Fecha de revisión</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(capacitacionDetalle.trabajadores || []).length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground text-xs">
                                                    Sin revisiones registradas para esta capacitación.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            (capacitacionDetalle.trabajadores || []).map((t, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-bold text-foreground">{t.nombre}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{t.cedula}</TableCell>
                                                    <TableCell className="text-xs text-foreground">{t.cargo}</TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground">
                                                        {t.fecha_exacta} ({t.fecha})
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                                                </Table>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 text-center">
                                    <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                        <Users className="size-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-medium text-muted-foreground">No hay datos de trabajadores disponibles</p>
                                    <p className="text-xs text-muted-foreground mt-1">Los datos se cargarán cuando haya información disponible.</p>
                                </div>
                            )}
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setCapacitacionDetalle(null);
                                        document.body.style.pointerEvents = '';
                                    }}
                                >
                                    Cerrar
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal Crear / Editar Carpeta */}
            <CrearCarpetaDialog
                open={dialogoCrear}
                onOpenChange={(open) => {
                    setDialogoCrear(open);
                    if (!open) document.body.style.pointerEvents = '';
                }}
                carpetaEditar={carpetaEditar}
            />

            {/* Modal Confirmación Eliminar Carpeta */}
            <AlertDialog
                open={!!carpetaEliminar}
                onOpenChange={(open) => {
                    if (!open) {
                        setCarpetaEliminar(null);
                        document.body.style.pointerEvents = '';
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar la carpeta "{carpetaEliminar?.nombre}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente la carpeta, su portada y todos sus materiales.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => {
                                setCarpetaEliminar(null);
                                document.body.style.pointerEvents = '';
                            }}
                        >
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleEliminarCarpeta}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar carpeta
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}












