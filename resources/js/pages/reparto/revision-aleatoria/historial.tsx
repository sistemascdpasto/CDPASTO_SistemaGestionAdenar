import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Search } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Revisión Aleatoria', href: '/modules/reparto/revision-aleatoria' },
    { title: 'Historial', href: '/modules/reparto/revision-aleatoria/historial' },
];

const TODOS = '__todos__';

interface FilaHistorial {
    id: number;
    numero_del_dia: number;
    fecha: string;
    hora: string | null;
    placa: string;
    responsable: string;
    resultado: 'sin_novedades' | 'con_novedades' | null;
    total_novedades: number;
    usuario: string;
}

interface Paginator<T> {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
}

export default function RevisionAleatoriaHistorial({
    revisiones,
    filtros,
    vehiculosDisponibles,
    responsablesDisponibles,
    causalesDisponibles,
}: {
    revisiones: Paginator<FilaHistorial>;
    filtros: Record<string, string | undefined>;
    vehiculosDisponibles: { id: number; placa: string }[];
    responsablesDisponibles: { id: number; nombre: string }[];
    causalesDisponibles: { id: number; nombre: string }[];
}) {
    const [form, setForm] = useState({
        desde: filtros.desde ?? '',
        hasta: filtros.hasta ?? '',
        vehiculo_id: filtros.vehiculo_id ?? '',
        responsable_id: filtros.responsable_id ?? '',
        causal_id: filtros.causal_id ?? '',
        resultado: filtros.resultado ?? '',
        sku: filtros.sku ?? '',
    });

    const aplicar = () => router.get(route('reparto.revision-aleatoria.historial'), form, { preserveState: true });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Historial de Revisiones" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Historial de Revisiones</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">Trazabilidad de las revisiones aleatorias realizadas.</p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <Link href={route('reparto.revision-aleatoria.index')}>
                            <ArrowLeft className="size-4" /> Volver
                        </Link>
                    </Button>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-sm dark:border-sidebar-border">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Desde</Label>
                            <Input type="date" value={form.desde} className="h-8 text-xs" onChange={(e) => setForm({ ...form, desde: e.target.value })} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Hasta</Label>
                            <Input type="date" value={form.hasta} className="h-8 text-xs" onChange={(e) => setForm({ ...form, hasta: e.target.value })} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Placa</Label>
                            <Select value={form.vehiculo_id || TODOS} onValueChange={(v) => setForm({ ...form, vehiculo_id: v === TODOS ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todas</SelectItem>
                                    {vehiculosDisponibles.map((v) => (
                                        <SelectItem key={v.id} value={String(v.id)}>
                                            {v.placa}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Responsable</Label>
                            <Select value={form.responsable_id || TODOS} onValueChange={(v) => setForm({ ...form, responsable_id: v === TODOS ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    {responsablesDisponibles.map((r) => (
                                        <SelectItem key={r.id} value={String(r.id)}>
                                            {r.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Causal</Label>
                            <Select value={form.causal_id || TODOS} onValueChange={(v) => setForm({ ...form, causal_id: v === TODOS ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todas</SelectItem>
                                    {causalesDisponibles.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                            {c.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Resultado</Label>
                            <Select value={form.resultado || TODOS} onValueChange={(v) => setForm({ ...form, resultado: v === TODOS ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    <SelectItem value="sin_novedades">Sin novedades</SelectItem>
                                    <SelectItem value="con_novedades">Con novedades</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Buscar SKU</Label>
                            <Input
                                value={form.sku}
                                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                                className="h-8 text-xs"
                                placeholder="Código de producto"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button size="sm" onClick={aplicar} className="h-8 gap-1.5 bg-green-700 text-white hover:bg-green-800">
                                <Search className="size-3.5" /> Filtrar
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Hora</TableHead>
                                    <TableHead>Placa</TableHead>
                                    <TableHead>Responsable</TableHead>
                                    <TableHead>Resultado</TableHead>
                                    <TableHead className="text-right">Novedades</TableHead>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {revisiones.data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                                            No se encontraron revisiones con estos filtros.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {revisiones.data.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell>
                                            {r.fecha} <span className="text-xs text-muted-foreground">#{r.numero_del_dia}</span>
                                        </TableCell>
                                        <TableCell>{r.hora ?? '—'}</TableCell>
                                        <TableCell className="font-mono font-bold text-green-700 dark:text-green-400">{r.placa}</TableCell>
                                        <TableCell>{r.responsable}</TableCell>
                                        <TableCell>
                                            <Badge variant={r.resultado === 'con_novedades' ? 'destructive' : 'default'}>
                                                {r.resultado === 'con_novedades' ? 'Con novedades' : 'Sin novedades'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">{r.total_novedades}</TableCell>
                                        <TableCell>{r.usuario}</TableCell>
                                        <TableCell>
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={route('reparto.revision-aleatoria.show', r.id)}>Ver</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {revisiones.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {revisiones.links.map((link, index) => (
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
