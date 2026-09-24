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
import { CalendarDays, Eye, FileSpreadsheet, FileText, Pencil, Plus, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react';
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
    colaborador_id: number | null;
    cedula: string | null;
    nombres: string;
    nombre_completo: string;
    cargo: string;
    ruta_asignada: string;
    placa?: string | null;
    ud?: string | null;
    estado_cobertura: string;
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
    realizados: PendingCollaborator[];
    todos_planeados: PendingCollaborator[];
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
                        <Button variant="outline" asChild>
                            <Link href={route('seguridad.pruebas.calendario')}>
                                <CalendarDays className="size-4" />
                                Calendario
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href={route('seguridad.pruebas.create')}>
                                <Plus className="size-4" />
                                Registrar prueba
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Resumen Visual de Cobertura */}
                <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                                <ShieldCheck className="size-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base text-foreground">Cobertura de Planeación de Ruta</h3>
                                <p className="text-xs text-muted-foreground">Población objetivo asignada a laborar</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Label htmlFor="fecha_cobertura" className="text-xs font-medium text-muted-foreground">
                                Seleccionar fecha:
                            </Label>
                            <Input
                                id="fecha_cobertura"
                                type="date"
                                className="w-auto h-9 text-xs bg-white dark:bg-background"
                                value={form.fecha || fechaConsulta}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setForm({ ...form, fecha: val, fecha_desde: val, fecha_hasta: val });
                                }}
                            />
                        </div>
                    </div>

                    <div className="rounded-lg border border-emerald-300/70 bg-white/80 p-3.5 shadow-xs dark:border-emerald-700/50 dark:bg-sidebar">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                                {cobertura.resumen_texto}
                            </p>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-full w-fit">
                                Cobertura: {cobertura.porcentaje_cobertura}%
                            </span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                                className="h-full bg-emerald-600 transition-all duration-500 dark:bg-emerald-500"
                                style={{ width: `${Math.min(100, cobertura.porcentaje_cobertura)}%` }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border bg-white p-3 shadow-xs dark:bg-sidebar">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground">Planeados</p>
                                <Users className="size-4 text-slate-500" />
                            </div>
                            <p className="mt-1 text-xl font-bold text-foreground">{cobertura.total_planeados}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-100/50 p-3 shadow-xs dark:border-emerald-800 dark:bg-emerald-950/40">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Realizados</p>
                                <UserCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">{cobertura.total_realizados}</p>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-100/50 p-3 shadow-xs dark:border-amber-800 dark:bg-amber-950/40">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Pendientes</p>
                                <UserX className="size-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">{cobertura.total_pendientes}</p>
                        </div>
                        <div className="rounded-lg border border-indigo-200 bg-indigo-100/50 p-3 shadow-xs dark:border-indigo-800 dark:bg-indigo-950/40">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300">Adicionales</p>
                                <Plus className="size-4 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <p className="mt-1 text-xl font-bold text-indigo-700 dark:text-indigo-300">{cobertura.total_adicionales}</p>
                        </div>
                    </div>
                </div>

                {/* Filtros de Búsqueda */}
                <form className="grid gap-3 rounded-lg border border-sidebar-border/70 p-4 sm:grid-cols-2 lg:grid-cols-6 dark:border-sidebar-border">
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
                        <Input id="fecha_desde" type="date" value={form.fecha_desde} onChange={(e) => setForm({ ...form, fecha_desde: e.target.value })} />
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
                    <div className="grid gap-1.5">
                        <Label>Estado</Label>
                        <Select value={form.estado || 'todas'} onValueChange={(value) => setForm({ ...form, estado: value === 'todas' ? '' : value })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todas">Todos los estados</SelectItem>
                                <SelectItem value="realizada">Realizadas</SelectItem>
                                <SelectItem value="programada">Programadas</SelectItem>
                                <SelectItem value="cancelada">Canceladas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-6">
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
                            {cobertura.total_pendientes}
                        </Badge>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('planeados')}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'planeados'
                                ? 'border-emerald-500 text-emerald-600 font-semibold'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Población Planeada Completa
                        <Badge variant="outline" className="ml-1 text-xs">
                            {cobertura.total_planeados}
                        </Badge>
                    </button>
                </div>

                {/* Vista: Pendientes de la Planeación */}
                {activeTab === 'pendientes' && (
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Cédula</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead>Asignación de Ruta</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cobertura.pendientes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                                            🎉 ¡Excelente! No hay colaboradores pendientes de prueba para esta planeación.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    cobertura.pendientes.map((item) => (
                                        <TableRow key={item.key}>
                                            <TableCell className="font-medium text-foreground">{item.nombre_completo}</TableCell>
                                            <TableCell>{item.cedula || '—'}</TableCell>
                                            <TableCell>{item.cargo || '—'}</TableCell>
                                            <TableCell>
                                                <span className="text-xs bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 rounded font-mono">
                                                    {item.ruta_asignada}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-amber-500 text-white hover:bg-amber-600">Pendiente</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                                                    <Link
                                                        href={route('seguridad.pruebas.create', {
                                                            colaborador_id: item.colaborador_id,
                                                            fecha: form.fecha || fechaConsulta,
                                                            ruta_asignada: item.ruta_asignada,
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

                {/* Vista: Población Planeada Completa */}
                {activeTab === 'planeados' && (
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Cédula</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead>Asignación de Ruta</TableHead>
                                    <TableHead>Estado Cobertura</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cobertura.todos_planeados.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                                            No hay datos de Planeación de Ruta para la fecha seleccionada.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    cobertura.todos_planeados.map((item) => (
                                        <TableRow key={item.key}>
                                            <TableCell className="font-medium text-foreground">{item.nombre_completo}</TableCell>
                                            <TableCell>{item.cedula || '—'}</TableCell>
                                            <TableCell>{item.cargo || '—'}</TableCell>
                                            <TableCell>
                                                <span className="text-xs bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 rounded font-mono">
                                                    {item.ruta_asignada}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {item.estado_cobertura === 'realizada' ? (
                                                    <Badge className="bg-emerald-600 text-white">Realizada</Badge>
                                                ) : (
                                                    <Badge className="bg-amber-500 text-white">Pendiente</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {item.estado_cobertura === 'pendiente' ? (
                                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                                                        <Link
                                                            href={route('seguridad.pruebas.create', {
                                                                colaborador_id: item.colaborador_id,
                                                                fecha: form.fecha || fechaConsulta,
                                                                ruta_asignada: item.ruta_asignada,
                                                            })}
                                                        >
                                                            <Plus className="size-3.5 mr-1" />
                                                            Registrar prueba
                                                        </Link>
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-emerald-600 font-medium">✓ Evaluado</span>
                                                )}
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
                                        <TableHead>Origen</TableHead>
                                        <TableHead>Responsable</TableHead>
                                        <TableHead>Firma</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pruebas.data.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-muted-foreground py-6 text-center">
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
                                            <TableCell>
                                                {prueba.ruta_asignada ? (
                                                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded">
                                                        {prueba.ruta_asignada}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{prueba.alcoholimetro?.codigo ?? '—'}</TableCell>
                                            <TableCell>
                                                {prueba.estado === 'programada' ? (
                                                    <Badge variant="secondary">Programada</Badge>
                                                ) : (
                                                    <Badge variant={prueba.es_positivo ? 'destructive' : 'default'}>
                                                        {prueba.resultado} — {prueba.es_positivo ? 'Positivo' : 'Negativo'}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {prueba.pertenece_planeacion ? (
                                                    <Badge className="bg-emerald-600 text-white">Realizada</Badge>
                                                ) : (
                                                    <Badge className="bg-indigo-600 text-white">Adicional</Badge>
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
