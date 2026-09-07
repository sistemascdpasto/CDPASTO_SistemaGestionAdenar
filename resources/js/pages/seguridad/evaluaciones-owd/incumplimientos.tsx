import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Evaluaciones OWD', href: '/modules/seguridad/evaluaciones-owd' },
    { title: 'Incumplimientos', href: '/modules/seguridad/evaluaciones-owd-incumplimientos' },
];

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface PreguntaIncumplida {
    id: number;
    proceso: string | null;
    tarea: string | null;
    puntuacion: string | null;
    evaluacion_owd: {
        id: number;
        fecha_evaluacion: string | null;
        pillar: string | null;
        agencia: string | null;
        colaborador: { nombres: string; apellidos: string } | null;
    };
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface DetallePaginator {
    data: PreguntaIncumplida[];
    links: PaginationLink[];
}

interface Filtros {
    [key: string]: string | undefined;
    mes?: string;
    anio?: string;
    pillar?: string;
    agencia?: string;
    proceso?: string;
}

export default function EvaluacionesOwdIncumplimientos({
    filtros,
    porTarea,
    detalle,
    catalogos,
}: {
    filtros: Filtros;
    porTarea: { tarea: string | null; total: number }[];
    detalle: DetallePaginator;
    catalogos: { pillar: string[]; agencia: string[] };
}) {
    const vacio: Filtros = { mes: '', anio: '', pillar: '', agencia: '', proceso: '' };
    const [form, setForm] = useState<Filtros>({ ...vacio, ...filtros });
    const isFirst = useRef(true);
    const debouncedForm = useDebouncedValue(form, 400);

    useEffect(() => {
        if (isFirst.current) { isFirst.current = false; return; }
        router.get(route('seguridad.evaluaciones-owd.incumplimientos'), debouncedForm, { preserveState: true, replace: true });
    }, [JSON.stringify(debouncedForm)]);

    const limpiarFiltros = () => {
        setForm(vacio);
        router.get(route('seguridad.evaluaciones-owd.incumplimientos'), {}, { preserveState: true, replace: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Incumplimientos OWD" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall
                    title="Incumplimientos OWD"
                    description="Preguntas evaluadas como 'No OK', agrupadas para detectar las principales problemáticas."
                />

                <form className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Select value={form.mes || 'todos'} onValueChange={(v) => setForm({ ...form, mes: v === 'todos' ? '' : v })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los meses</SelectItem>
                            {MESES.map((mes, index) => (
                                <SelectItem key={mes} value={String(index + 1)}>
                                    {mes}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input placeholder="Año" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} />
                    <Select value={form.pillar || 'todos'} onValueChange={(v) => setForm({ ...form, pillar: v === 'todos' ? '' : v })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pillar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los pillares</SelectItem>
                            {catalogos.pillar.map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={form.agencia || 'todos'} onValueChange={(v) => setForm({ ...form, agencia: v === 'todos' ? '' : v })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Agencia" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas las agencias</SelectItem>
                            {catalogos.agencia.map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input placeholder="Proceso" value={form.proceso} onChange={(e) => setForm({ ...form, proceso: e.target.value })} />

                    <div className="col-span-2 flex gap-2 md:col-span-5">
                        <Button type="button" variant="outline" onClick={limpiarFiltros}>
                            Limpiar
                        </Button>
                    </div>
                </form>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">Tareas con más incumplimientos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {porTarea.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">Sin incumplimientos para estos filtros.</p>
                        ) : (
                            <ul className="space-y-2">
                                {porTarea.map((fila, index) => (
                                    <li key={index} className="flex items-center justify-between gap-4 text-sm">
                                        <span className="text-foreground">{fila.tarea ?? '—'}</span>
                                        <Badge variant="destructive">{fila.total}</Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Pillar</TableHead>
                                <TableHead>Agencia</TableHead>
                                <TableHead>Proceso</TableHead>
                                <TableHead>Tarea</TableHead>
                                <TableHead>Puntuación</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detalle.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                                        No hay incumplimientos que coincidan con los filtros.
                                    </TableCell>
                                </TableRow>
                            )}
                            {detalle.data.map((pregunta) => (
                                <TableRow key={pregunta.id}>
                                    <TableCell>
                                        <Link href={route('seguridad.evaluaciones-owd.show', pregunta.evaluacion_owd.id)} className="text-primary hover:underline">
                                            {pregunta.evaluacion_owd.fecha_evaluacion
                                                ? new Date(pregunta.evaluacion_owd.fecha_evaluacion).toLocaleDateString()
                                                : '—'}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        {pregunta.evaluacion_owd.colaborador
                                            ? `${pregunta.evaluacion_owd.colaborador.nombres} ${pregunta.evaluacion_owd.colaborador.apellidos}`
                                            : '—'}
                                    </TableCell>
                                    <TableCell>{pregunta.evaluacion_owd.pillar ?? '—'}</TableCell>
                                    <TableCell>{pregunta.evaluacion_owd.agencia ?? '—'}</TableCell>
                                    <TableCell>{pregunta.proceso ?? '—'}</TableCell>
                                    <TableCell className="max-w-xs truncate">{pregunta.tarea ?? '—'}</TableCell>
                                    <TableCell>
                                        <Badge variant="destructive">{pregunta.puntuacion}</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {detalle.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {detalle.links.map((link, index) => (
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
