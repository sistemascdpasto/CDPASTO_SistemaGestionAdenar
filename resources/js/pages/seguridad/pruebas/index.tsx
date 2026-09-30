import HeadingSmall from '@/components/heading-small';
import { IconActionButton } from '@/components/icon-action-button';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Eye, FileSpreadsheet, FileText, Pencil, Plus, Truck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Pruebas de Alcoholemia', href: '/modules/seguridad/pruebas' },
];

const TIPO_LABELS: Record<string, string> = {
    pre_ruta: 'Pre Ruta',
    ruta: 'Ruta',
    post_ruta: 'Post Ruta',
    jl: 'JL',
    segundo_viaje: 'Segundo viaje',
    movilizador: 'Movilizador',
    administrativo: 'Administrativo',
};

interface PruebaRow {
    id: number;
    tipo: string;
    resultado: string | null;
    es_positivo: boolean;
    estado: string;
    fecha_hora: string;
    firma_path: string | null;
    pertenece_planeacion?: boolean;
    ruta_asignada?: string | null;
    colaborador: { nombres: string; apellidos: string; cedula: string; cargo?: string } | null;
    alcoholimetro: { codigo: string } | null;
    responsable: { name: string } | null;
}

interface PendingCollaborator {
    key: string;
    fecha?: string;
    colaborador_id: number | null;
    cedula: string | null;
    nombres: string;
    nombre_completo: string;
    cargo: string;
    ruta_asignada: string;
    entrada_geovictoria: string | null;
    salida_geovictoria: string | null;
    placa?: string | null;
    ud?: string | null;
    estado_cobertura: string;
}

interface PlaneacionResumen {
    fecha: string;
    total_planeados: number;
    total_realizados: number;
    total_pendientes: number;
    pre_ruta_realizados: number;
    pre_ruta_completa: boolean;
    post_ruta_realizados: number;
    post_ruta_completa: boolean;
    esta_completa: boolean;
}

interface CoberturaResumen {
    fecha: string;
    planeacion_existe: boolean;
    total_planeados: number;
    total_realizados: number;
    total_pendientes: number;
    total_adicionales: number;
    total_pruebas: number;
    porcentaje_cobertura: number;
    resumen_texto: string;
    pendientes: PendingCollaborator[];
    pendientes_pre_ruta: PendingCollaborator[];
    pendientes_post_ruta: PendingCollaborator[];
    realizados: PendingCollaborator[];
    todos_planeados: PendingCollaborator[];
    planeaciones: PlaneacionResumen[];
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PruebasPaginator {
    data: PruebaRow[];
    links: PaginationLink[];
    total: number;
}

interface Filters {
    fecha: string;
    estado: string;
    tipo: string;
    origen_planeacion: string;
    fecha_desde: string;
    fecha_hasta: string;
    colaborador: string;
}

export default function PruebasIndex({
    pruebas,
    cobertura,
    fechaConsulta,
    filters,
}: {
    pruebas: PruebasPaginator;
    cobertura: CoberturaResumen;
    fechaConsulta: string;
    filters: Filters;
}) {
    const [form, setForm] = useState(filters);
    const [activeTab, setActiveTab] = useState<'pruebas' | 'pendientes' | 'planeados'>('pruebas');
    const debouncedForm = useDebouncedValue(form, 400);
    const isFirstRender = useRef(true);

    const planeacionCompleta = cobertura.planeacion_existe && cobertura.total_planeados > 0 && cobertura.total_pendientes === 0;
    const planeacionFechaSeleccionada = cobertura.planeaciones.find(
        (planeacion) => planeacion.fecha === (form.fecha || fechaConsulta),
    );
    const pruebasPendientes = [
        ...cobertura.pendientes_pre_ruta.map((item) => ({ ...item, tipoPendiente: 'pre_ruta' as const })),
        ...cobertura.pendientes_post_ruta.map((item) => ({ ...item, tipoPendiente: 'post_ruta' as const })),
    ];

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        router.get(route('seguridad.pruebas.index'), { ...debouncedForm }, { preserveState: true, replace: true });
    }, [debouncedForm]);

    const exportUrl = (ruta: string) => route(ruta, { ...form });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pruebas de Alcoholemia" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <HeadingSmall
                        title="Pruebas de Alcoholemia"
                        description="Seguimiento de cobertura de población objetivo (Planeación de Ruta) y registro de evaluaciones."
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button asChild>
                            <Link href={route('seguridad.pruebas.create')}>
                                <Plus className="size-4" />
                                Registrar prueba
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Panel Unificado: Resumen de Cobertura + Filtros de Búsqueda */}
                <div className="flex flex-col gap-4 rounded-xl border border-sidebar-border/70 p-4 sm:p-5 dark:border-sidebar-border">
                    {/* Barra de Cobertura */}
                    <div className="rounded-lg border border-emerald-300/70 bg-emerald-50/50 p-3.5 shadow-xs dark:border-emerald-700/50 dark:bg-emerald-950/20">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                                {cobertura.resumen_texto}
                            </p>
                            <div className="flex items-center gap-2">
                                {planeacionCompleta && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300" asChild>
                                        <Link href={route('reparto.modulacion.index', { fecha: form.fecha || fechaConsulta, readOnly: true })}>
                                            <Truck className="size-3.5 mr-1" />
                                            Ver Detalles de la Ruta
                                        </Link>
                                    </Button>
                                )}
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-full w-fit">
                                    Cobertura: {Math.round(cobertura.porcentaje_cobertura)}%
                                </span>
                            </div>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                                className="h-full bg-emerald-600 transition-all duration-500 dark:bg-emerald-500"
                                style={{ width: `${Math.min(100, cobertura.porcentaje_cobertura)}%` }}
                            />
                        </div>
                        {planeacionFechaSeleccionada && (
                            <div className="mt-3 grid gap-2 rounded-md border border-emerald-200 bg-white/70 p-3 text-xs dark:border-emerald-800 dark:bg-slate-950/30 sm:grid-cols-2">
                                <p>
                                    <span className="font-semibold">Pre Ruta:</span>{' '}
                                    {planeacionFechaSeleccionada.pre_ruta_completa
                                        ? <span className="font-semibold text-emerald-700 dark:text-emerald-400">completa ({planeacionFechaSeleccionada.pre_ruta_realizados}/{planeacionFechaSeleccionada.total_planeados})</span>
                                        : <span className="text-muted-foreground">pendiente ({planeacionFechaSeleccionada.pre_ruta_realizados}/{planeacionFechaSeleccionada.total_planeados})</span>}
                                </p>
                                <p>
                                    <span className="font-semibold">Post Ruta:</span>{' '}
                                    {planeacionFechaSeleccionada.post_ruta_completa
                                        ? <span className="font-semibold text-emerald-700 dark:text-emerald-400">completa ({planeacionFechaSeleccionada.post_ruta_realizados}/{planeacionFechaSeleccionada.total_planeados})</span>
                                        : <span className="text-muted-foreground">pendiente ({planeacionFechaSeleccionada.post_ruta_realizados}/{planeacionFechaSeleccionada.total_planeados})</span>}
                                </p>
                                {planeacionFechaSeleccionada.pre_ruta_completa && (
                                    <p className="font-medium sm:col-span-2" role="status">
                                        {planeacionFechaSeleccionada.post_ruta_completa
                                            ? 'Se realizaron todas las pruebas Post Ruta planeadas.'
                                            : `Pre Ruta completa. Faltan ${planeacionFechaSeleccionada.total_planeados - planeacionFechaSeleccionada.post_ruta_realizados} pruebas Post Ruta.`}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Filtros de Búsqueda */}
                    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <div className="grid gap-1.5">
                            <Label htmlFor="colaborador">Colaborador o cédula</Label>
                            <Input
                                id="colaborador"
                                value={form.colaborador}
                                onChange={(e) => setForm({ ...form, colaborador: e.target.value })}
                                placeholder="Buscar..."
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="fecha_desde">Desde</Label>
                            <Input id="fecha_desde" type="date" value={form.fecha_desde} onChange={(e) => setForm({ ...form, fecha_desde: e.target.value, fecha: e.target.value })} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="fecha_hasta">Hasta</Label>
                            <Input id="fecha_hasta" type="date" value={form.fecha_hasta} onChange={(e) => setForm({ ...form, fecha_hasta: e.target.value })} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Tipo de prueba</Label>
                            <Select value={form.tipo || 'todos'} onValueChange={(value) => setForm({ ...form, tipo: value === 'todos' ? '' : value })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="pre_ruta">Pre Ruta</SelectItem>
                                    <SelectItem value="ruta">Ruta</SelectItem>
                                    <SelectItem value="post_ruta">Post Ruta</SelectItem>
                                    <SelectItem value="jl">JL</SelectItem>
                                    <SelectItem value="segundo_viaje">Segundo viaje</SelectItem>
                                    <SelectItem value="movilizador">Movilizador</SelectItem>
                                    <SelectItem value="administrativo">Administrativo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Origen de Planeación</Label>
                            <Select value={form.origen_planeacion || 'todos'} onValueChange={(value) => setForm({ ...form, origen_planeacion: value === 'todos' ? '' : value })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="planeadas">Realizada (Planeada)</SelectItem>
                                    <SelectItem value="adicionales">Evaluación Adicional</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-5">
                            <Button type="button" variant="outline" asChild>
                                <a href={exportUrl('seguridad.pruebas.exportar-pdf')}>
                                    <FileText className="size-4" />
                                    Exportar PDF
                                </a>
                            </Button>
                            <Button type="button" variant="outline" asChild>
                                <a href={exportUrl('seguridad.pruebas.exportar-excel')}>
                                    <FileSpreadsheet className="size-4" />
                                    Exportar Excel
                                </a>
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Tabs de Navegación de Vistas */}
                <div className="flex border-b border-sidebar-border/70 dark:border-sidebar-border">
                    <button
                        type="button"
                        onClick={() => setActiveTab('pruebas')}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'pruebas'
                                ? 'border-primary text-primary font-semibold'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Todas las Pruebas
                        <Badge variant="secondary" className="ml-1 text-xs">
                            {pruebas.total}
                        </Badge>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('pendientes')}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'pendientes'
                                ? 'border-amber-500 text-amber-600 font-semibold'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Pendientes de la Planeación
                        <Badge className="ml-1 text-xs bg-amber-500 text-white hover:bg-amber-600">
                            {pruebasPendientes.length}
                        </Badge>
                    </button>

                    {cobertura.total_planeados > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('planeados')}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                                activeTab === 'planeados'
                                    ? 'border-emerald-500 text-emerald-600 font-semibold'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Planeación Completa
                            <Badge className="ml-1 text-xs bg-emerald-600 text-white">
                                {cobertura.planeaciones ? cobertura.planeaciones.length : cobertura.total_planeados}
                            </Badge>
                        </button>
                    )}
                </div>

                {/* Vista: Pendientes de la Planeación (Histórico Completo) */}
                {activeTab === 'pendientes' && (
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border overflow-hidden">
                        <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border-b border-sidebar-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                                    📋 Pruebas pendientes de la Planeación ({pruebasPendientes.length})
                                </h3>
                                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                                    Primero se realiza Pre Ruta; al completarla, queda pendiente Post Ruta hasta registrarla.
                                </p>
                            </div>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha Planeada</TableHead>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Prueba pendiente</TableHead>
                                    <TableHead>Entrada</TableHead>
                                    <TableHead>Salida</TableHead>
                                    <TableHead>Cédula</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead>Asignación de Ruta</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pruebasPendientes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-muted-foreground py-8 text-center">
                                            🎉 ¡Excelente! No hay pruebas Pre Ruta ni Post Ruta pendientes de la planeación.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    pruebasPendientes.map((item) => (
                                        <TableRow key={`${item.key}-${item.tipoPendiente}`}>
                                            <TableCell className="whitespace-nowrap font-medium">
                                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200 font-mono">
                                                    📅 {item.fecha || form.fecha || fechaConsulta}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium text-foreground">{item.nombre_completo}</TableCell>
                                            <TableCell>{item.tipoPendiente === 'pre_ruta' ? 'Pre Ruta' : 'Post Ruta'}</TableCell>
                                            <TableCell>{item.entrada_geovictoria || '—'}</TableCell>
                                            <TableCell>{item.salida_geovictoria || '—'}</TableCell>
                                            <TableCell>{item.cedula || '—'}</TableCell>
                                            <TableCell>{item.cargo || '—'}</TableCell>
                                            <TableCell>{item.ruta_asignada}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
                                                    Pendiente
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                                                    <Link
                                                        href={route('seguridad.pruebas.create', {
                                                            colaborador_id: item.colaborador_id,
                                                            fecha: item.fecha || form.fecha || fechaConsulta,
                                                            ruta_asignada: item.ruta_asignada,
                                                            tipo: item.tipoPendiente,
                                                        })}
                                                    >
                                                        <Plus className="size-3.5 mr-1" />
                                                        Registrar prueba
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {/* Vista: Planeación Completa (Resumen por Fecha: Pre Ruta y Post Ruta) */}
                {activeTab === 'planeados' && (
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha de la Ruta</TableHead>
                                    <TableHead>Población Planeada</TableHead>
                                    <TableHead>Pre Ruta</TableHead>
                                    <TableHead>Post Ruta</TableHead>
                                    <TableHead>Estado Cobertura</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!cobertura.planeaciones || cobertura.planeaciones.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                                            No hay registros de planeación de ruta en el histórico.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    cobertura.planeaciones.map((plan) => (
                                        <TableRow key={plan.fecha}>
                                            <TableCell className="font-semibold text-foreground whitespace-nowrap">
                                                {plan.fecha}
                                            </TableCell>
                                            <TableCell>
                                                {plan.total_planeados} colaboradores
                                            </TableCell>
                                            <TableCell>
                                                {plan.pre_ruta_completa ? (
                                                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Completa</span>
                                                ) : (
                                                    <span className="text-muted-foreground">Incompleta ({plan.pre_ruta_realizados}/{plan.total_planeados})</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {plan.post_ruta_completa ? (
                                                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Completa</span>
                                                ) : (
                                                    <span className="text-muted-foreground">Incompleta ({plan.post_ruta_realizados}/{plan.total_planeados})</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {plan.esta_completa ? (
                                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Completa</span>
                                                ) : (
                                                    <span className="text-amber-600 dark:text-amber-400">En Proceso ({plan.total_realizados}/{plan.total_planeados})</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="outline" className="h-8 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300" asChild>
                                                    <Link href={route('reparto.modulacion.index', { fecha: plan.fecha, readOnly: true })}>
                                                        <Truck className="size-3.5 mr-1" />
                                                        Ver Detalles de la Ruta
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {/* Vista: Todas las Pruebas */}
                {activeTab === 'pruebas' && (
                    <>
                        <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Colaborador</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Planeación / Ruta</TableHead>
                                        <TableHead>Dispositivo</TableHead>
                                        <TableHead>Resultado</TableHead>
                                        <TableHead>Responsable</TableHead>
                                        <TableHead>Firma</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pruebas.data.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-muted-foreground py-6 text-center">
                                                No se encontraron pruebas de alcoholemia.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {pruebas.data.map((prueba) => (
                                        <TableRow key={prueba.id}>
                                            <TableCell className="whitespace-nowrap">{new Date(prueba.fecha_hora).toLocaleString()}</TableCell>
                                            <TableCell>
                                                {prueba.colaborador ? `${prueba.colaborador.nombres} ${prueba.colaborador.apellidos}` : '—'}
                                            </TableCell>
                                            <TableCell>{TIPO_LABELS[prueba.tipo] ?? prueba.tipo}</TableCell>
                                            <TableCell>{prueba.ruta_asignada || '—'}</TableCell>
                                            <TableCell>{prueba.alcoholimetro?.codigo ?? '—'}</TableCell>
                                            <TableCell>
                                                {prueba.estado === 'programada' ? (
                                                    <Badge variant="secondary">Programada</Badge>
                                                ) : prueba.es_positivo ? (
                                                    <span className="font-bold text-red-600 dark:text-red-400">
                                                        {prueba.resultado} — Positivo
                                                    </span>
                                                ) : (
                                                    <span>
                                                        {prueba.resultado ?? '0.000'} — Negativo
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>{prueba.responsable?.name ?? '—'}</TableCell>
                                            <TableCell>
                                                {prueba.firma_path ? (
                                                    <SafeImage
                                                        src={`/storage/${prueba.firma_path}`}
                                                        alt="Firma"
                                                        className="h-8 w-16 rounded border border-sidebar-border/70 bg-white object-contain dark:border-sidebar-border"
                                                    />
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <IconActionButton icon={Eye} label="Ver" href={route('seguridad.pruebas.show', prueba.id)} />
                                                    <IconActionButton icon={Pencil} label="Editar" href={route('seguridad.pruebas.edit', prueba.id)} />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {pruebas.links.length > 3 && (
                            <div className="flex flex-wrap gap-1">
                                {pruebas.links.map((link, index) => (
                                    <Button key={index} variant={link.active ? 'default' : 'outline'} size="sm" disabled={!link.url} asChild={!!link.url}>
                                        {link.url ? (
                                            <Link href={link.url} preserveScroll dangerouslySetInnerHTML={{ __html: link.label }} />
                                        ) : (
                                            <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                        )}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
