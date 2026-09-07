import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: '5 Por Qué', href: '/cinco-porques' },
    { title: 'Historial', href: '/cinco-porques/historial' },
];

const TODOS = '__todos__';

interface Fila {
    id: number;
    fecha: string | null;
    ejecutor: string | null;
    placa: string | null;
    rutina: string;
    indicador: string;
    problema: string;
    creado: string | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export default function CincoPorquesHistorial({
    registros,
    filtros,
    indicadores,
    puedeVerTodos,
}: {
    registros: { data: Fila[]; links: PaginationLink[] };
    filtros: { indicador: string; desde: string | null; hasta: string | null };
    indicadores: string[];
    puedeVerTodos: boolean;
}) {
    const [indicador, setIndicador] = useState(filtros.indicador || TODOS);
    const [desde, setDesde] = useState(filtros.desde ?? '');
    const [hasta, setHasta] = useState(filtros.hasta ?? '');

    const aplicar = () => {
        router.get(
            route('cinco-porques.historial'),
            {
                indicador: indicador === TODOS ? '' : indicador,
                desde: desde || undefined,
                hasta: hasta || undefined,
            },
            { preserveState: true, replace: true },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Historial — 5 Por Qué" />
            <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <HeadingSmall
                        title={puedeVerTodos ? 'Historial de 5 Por Qué' : 'Mi historial de 5 Por Qué'}
                        description={puedeVerTodos ? 'Análisis de causa raíz de todos los colaboradores.' : 'Tus análisis de causa raíz.'}
                    />
                    <Button size="sm" asChild>
                        <Link href={route('cinco-porques.create')}>
                            <Plus className="size-4" /> Nuevo análisis
                        </Link>
                    </Button>
                </div>

                <div className="border-border bg-muted/30 flex flex-wrap items-end gap-3 rounded-lg border p-3">
                    <div className="grid gap-1.5">
                        <label className="text-muted-foreground text-xs font-medium">Indicador</label>
                        <Select value={indicador} onValueChange={setIndicador}>
                            <SelectTrigger className="h-9 w-56">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={TODOS}>Todos</SelectItem>
                                {indicadores.map((i) => (
                                    <SelectItem key={i} value={i}>
                                        {i}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-1.5">
                        <label className="text-muted-foreground text-xs font-medium">Desde</label>
                        <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 w-40" />
                    </div>
                    <div className="grid gap-1.5">
                        <label className="text-muted-foreground text-xs font-medium">Hasta</label>
                        <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9 w-40" />
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={aplicar}>
                        Filtrar
                    </Button>
                </div>

                <div className="border-sidebar-border/70 dark:border-sidebar-border overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                {puedeVerTodos && <TableHead>Ejecuta</TableHead>}
                                <TableHead>Placa</TableHead>
                                <TableHead>Rutina</TableHead>
                                <TableHead>Indicador</TableHead>
                                <TableHead>Problema</TableHead>
                                <TableHead className="text-right">Detalle</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {registros.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={puedeVerTodos ? 7 : 6} className="text-muted-foreground py-6 text-center">
                                        No hay análisis registrados.
                                    </TableCell>
                                </TableRow>
                            )}
                            {registros.data.map((fila) => (
                                <TableRow key={fila.id}>
                                    <TableCell className="whitespace-nowrap">{fila.fecha ?? '—'}</TableCell>
                                    {puedeVerTodos && <TableCell>{fila.ejecutor ?? '—'}</TableCell>}
                                    <TableCell>{fila.placa ?? '—'}</TableCell>
                                    <TableCell>{fila.rutina}</TableCell>
                                    <TableCell>{fila.indicador}</TableCell>
                                    <TableCell className="max-w-xs truncate" title={fila.problema}>
                                        {fila.problema}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={route('cinco-porques.show', fila.id)} className="text-primary text-sm hover:underline">
                                            Ver
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {registros.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {registros.links.map((link, index) => (
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
