import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconActionButton } from '@/components/icon-action-button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Download, Eye, Plus } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Exámenes Médicos', href: '/modules/seguridad/examenes-medicos' },
    { title: 'Bandeja', href: '/modules/seguridad/examenes-medicos' },
];

const TIPO_LABELS: Record<string, string> = { ingreso: 'Ingreso', periodico: 'Periódico', egreso: 'Egreso' };

const ESTADO_LABELS: Record<string, string> = {
    sin_iniciar: 'Sin Iniciar',
    demorada: 'Demorada',
    en_proceso: 'En Proceso',
    terminada: 'Terminada',
    pendiente: 'Pendiente',
    programado: 'Programado',
    ejecutado: 'Ejecutado',
};

const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    sin_iniciar: 'secondary',
    demorada: 'destructive',
    en_proceso: 'default',
    terminada: 'outline',
    pendiente: 'secondary',
    programado: 'default',
    ejecutado: 'outline',
};

interface ColaboradorLigero {
    id: number;
    nombres: string;
    apellidos: string;
    cedula: string;
    cargo: string | null;
    centro: string | null;
    area: string | null;
}

interface EvaluacionRow {
    id: number;
    tipo_evaluacion: string;
    fecha_evaluacion: string;
    proximo_examen_fecha: string | null;
    fecha_referencia: string | null;
    estado: string;
    colaborador: ColaboradorLigero | null;
    concepto_aptitud: { nombre: string } | null;
    cantidad_requerida: number;
    cantidad_ejecutada: number;
    cantidad_pendiente: number;
    dias_restantes: number | null;
    alerta: 'proximo_a_vencer' | 'vencido' | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface EvaluacionesPaginator {
    data: EvaluacionRow[];
    links: PaginationLink[];
}

interface Filtros {
    [key: string]: string | boolean | undefined;
    tipo_evaluacion: string;
    estado: string;
    ver_historial: boolean;
    colaborador?: string;
    identificacion?: string;
    cargo?: string;
    centro?: string;
}

function badgeDias(dias: number | null, alerta: EvaluacionRow['alerta']) {
    if (dias === null) return <span className="text-muted-foreground">—</span>;

    if (alerta === 'vencido') {
        return <Badge variant="destructive">{dias} (vencido)</Badge>;
    }

    if (alerta === 'proximo_a_vencer') {
        return (
            <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
                {dias} (próximo a vencer)
            </Badge>
        );
    }

    return <span>{dias}</span>;
}

export default function EvaluacionesIndex({
    evaluaciones,
    filtros,
    catalogos,
}: {
    evaluaciones: EvaluacionesPaginator;
    filtros: Filtros;
    catalogos: { cargos: string[]; centros: string[] };
}) {
    const aplicarFiltro = (cambios: Record<string, string | boolean>) => {
        router.get(route('seguridad.examenes-medicos.index'), { ...filtros, ...cambios }, { preserveState: true, replace: true });
    };

    const exportUrl = (ruta: string) => route(ruta, { ...filtros });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Exámenes Médicos — Bandeja" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <HeadingSmall title="Bandeja de evaluaciones" description="Exámenes médicos ocupacionales por colaborador." />
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" asChild>
                            <a href={exportUrl('seguridad.examenes-medicos.exportar.basica')}>
                                <Download />
                                Exportar (básico)
                            </a>
                        </Button>
                        <Button variant="outline" asChild>
                            <a href={exportUrl('seguridad.examenes-medicos.exportar.completa')}>
                                <Download />
                                Exportar (completo)
                            </a>
                        </Button>
                        <Button asChild>
                            <Link href={route('seguridad.examenes-medicos.create')}>
                                <Plus />
                                Nueva evaluación
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Input
                        placeholder="Colaborador (nombre)"
                        className="w-48"
                        defaultValue={filtros.colaborador}
                        onBlur={(e) => aplicarFiltro({ colaborador: e.target.value })}
                    />
                    <Input
                        placeholder="Identificación"
                        className="w-40"
                        defaultValue={filtros.identificacion}
                        onBlur={(e) => aplicarFiltro({ identificacion: e.target.value })}
                    />
                    <Select value={filtros.cargo || 'todos'} onValueChange={(v) => aplicarFiltro({ cargo: v === 'todos' ? '' : v })}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Cargo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los cargos</SelectItem>
                            {catalogos.cargos.map((cargo) => (
                                <SelectItem key={cargo} value={cargo}>
                                    {cargo}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={filtros.centro || 'todos'} onValueChange={(v) => aplicarFiltro({ centro: v === 'todos' ? '' : v })}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Centro" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los centros</SelectItem>
                            {catalogos.centros.map((centro) => (
                                <SelectItem key={centro} value={centro}>
                                    {centro}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filtros.tipo_evaluacion || 'todos'}
                        onValueChange={(v) => aplicarFiltro({ tipo_evaluacion: v === 'todos' ? '' : v })}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Tipo de evaluación" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los tipos</SelectItem>
                            <SelectItem value="ingreso">Ingreso</SelectItem>
                            <SelectItem value="periodico">Periódico</SelectItem>
                            <SelectItem value="egreso">Egreso</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filtros.estado || 'todos'} onValueChange={(v) => aplicarFiltro({ estado: v === 'todos' ? '' : v })}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los estados</SelectItem>
                            {Object.entries(ESTADO_LABELS).map(([valor, etiqueta]) => (
                                <SelectItem key={valor} value={valor}>
                                    {etiqueta}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        type="button"
                        variant={filtros.ver_historial ? 'default' : 'outline'}
                        onClick={() => aplicarFiltro({ ver_historial: !filtros.ver_historial })}
                    >
                        {filtros.ver_historial ? 'Viendo historial completo' : 'Ver historial (incluye Terminadas)'}
                    </Button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>C.C</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Cargo</TableHead>
                                <TableHead>CD</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Req./Ejec./Pend.</TableHead>
                                <TableHead>Próximo examen</TableHead>
                                <TableHead>Días</TableHead>
                                <TableHead>Concepto aptitud</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {evaluaciones.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={11} className="text-muted-foreground py-6 text-center">
                                        No hay evaluaciones que coincidan con los filtros.
                                    </TableCell>
                                </TableRow>
                            )}
                            {evaluaciones.data.map((evaluacion) => (
                                <TableRow key={evaluacion.id}>
                                    <TableCell>{evaluacion.colaborador?.cedula ?? '—'}</TableCell>
                                    <TableCell className="font-medium">
                                        {evaluacion.colaborador ? `${evaluacion.colaborador.nombres} ${evaluacion.colaborador.apellidos}` : '—'}
                                    </TableCell>
                                    <TableCell>{evaluacion.colaborador?.cargo ?? '—'}</TableCell>
                                    <TableCell>{evaluacion.colaborador?.centro ?? '—'}</TableCell>
                                    <TableCell>{TIPO_LABELS[evaluacion.tipo_evaluacion] ?? evaluacion.tipo_evaluacion}</TableCell>
                                    <TableCell>
                                        {evaluacion.cantidad_requerida}/{evaluacion.cantidad_ejecutada}/{evaluacion.cantidad_pendiente}
                                    </TableCell>
                                    <TableCell>
                                        {evaluacion.fecha_referencia
                                            ? new Date(evaluacion.fecha_referencia + 'T00:00:00').toLocaleDateString('es-CO')
                                            : '—'}
                                    </TableCell>
                                    <TableCell>{badgeDias(evaluacion.dias_restantes, evaluacion.alerta)}</TableCell>
                                    <TableCell>{evaluacion.concepto_aptitud?.nombre ?? '—'}</TableCell>
                                    <TableCell>
                                        <Badge variant={ESTADO_VARIANT[evaluacion.estado] ?? 'secondary'}>
                                            {ESTADO_LABELS[evaluacion.estado] ?? evaluacion.estado}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end">
                                            <IconActionButton icon={Eye} label="Ver detalle" href={route('seguridad.examenes-medicos.show', evaluacion.id)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {evaluaciones.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {evaluaciones.links.map((link, index) => (
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
            </div>
        </AppLayout>
    );
}
