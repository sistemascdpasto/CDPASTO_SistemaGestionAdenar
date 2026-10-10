import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Dotación y EPP', href: '/modules/seguridad/dotacion-epp' },
];

const PAGE_SIZES = [10, 25, 50, 100];
const TODOS = 'todos';

interface ItemEstado {
    fecha: string | null;
    estado: 'al_dia' | 'proximo' | 'vencido';
}

interface Fila {
    id: number;
    nombre_completo: string;
    cedula: string;
    centro: string | null;
    area: string | null;
    cargo: string | null;
    items: Record<string, ItemEstado>;
    estado: 'al_dia' | 'proximo' | 'vencido';
}

interface Kpis {
    total: number;
    al_dia: number;
    proximos: number;
    vencidos: number;
}

const ESTADO_LABEL: Record<string, string> = { al_dia: 'Al día', proximo: 'Próximo a vencer', vencido: 'Vencido' };
const ESTADO_DOT: Record<string, string> = { al_dia: 'bg-green-600', proximo: 'bg-amber-500', vencido: 'bg-red-600' };
const ESTADO_BADGE: Record<string, string> = {
    al_dia: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
    proximo: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    vencido: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

function Punto({ item }: { item: ItemEstado }) {
    return (
        <span
            className={`inline-block size-2.5 rounded-full ${ESTADO_DOT[item.estado]}`}
            title={item.fecha ? `Última entrega: ${item.fecha}` : 'Sin entregas registradas'}
        />
    );
}

export default function DotacionEppIndex({
    filas,
    kpis,
    items_labels,
    opciones,
    filters,
}: {
    filas: Fila[];
    kpis: Kpis;
    items_labels: Record<string, string>;
    opciones: { centros: string[]; areas: string[]; cargos: string[] };
    filters: { centro: string; area: string; cargo: string; estado: string };
}) {
    const [centro, setCentro] = useState(filters.centro);
    const [area, setArea] = useState(filters.area);
    const [cargo, setCargo] = useState(filters.cargo);
    const [estado, setEstado] = useState(filters.estado);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const aplicar = (overrides: Partial<{ centro: string; area: string; cargo: string; estado: string }>) => {
        const next = { centro, area, cargo, estado, ...overrides };
        setCentro(next.centro);
        setArea(next.area);
        setCargo(next.cargo);
        setEstado(next.estado);
        setPage(1);
        router.get(route('seguridad.dotacion-epp.index'), next, { preserveState: true, replace: true });
    };

    const totalPages = Math.max(1, Math.ceil(filas.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const filasPagina = useMemo(() => filas.slice((safePage - 1) * pageSize, safePage * pageSize), [filas, safePage, pageSize]);

    const itemKeys = Object.keys(items_labels);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dotación y EPP" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Dotación y EPP</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        Estado de entrega de elementos de protección personal por colaborador — renovación cada 4 meses.
                    </p>
                </div>

                {/* Filtros */}
                <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border px-4 py-3">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Centro</Label>
                            <Select value={centro || TODOS} onValueChange={(v) => aplicar({ centro: v === TODOS ? '' : v })}>
                                <SelectTrigger className="h-8 w-40 text-xs">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    {opciones.centros.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {c}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Área</Label>
                            <Select value={area || TODOS} onValueChange={(v) => aplicar({ area: v === TODOS ? '' : v })}>
                                <SelectTrigger className="h-8 w-40 text-xs">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todas</SelectItem>
                                    {opciones.areas.map((a) => (
                                        <SelectItem key={a} value={a}>
                                            {a}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Cargo</Label>
                            <Select value={cargo || TODOS} onValueChange={(v) => aplicar({ cargo: v === TODOS ? '' : v })}>
                                <SelectTrigger className="h-8 w-44 text-xs">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    {opciones.cargos.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {c}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Estado</Label>
                            <Select value={estado || TODOS} onValueChange={(v) => aplicar({ estado: v === TODOS ? '' : v })}>
                                <SelectTrigger className="h-8 w-40 text-xs">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    <SelectItem value="al_dia">Al día</SelectItem>
                                    <SelectItem value="proximo">Próximo a vencer</SelectItem>
                                    <SelectItem value="vencido">Vencido</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard label="Colaboradores evaluados" value={kpis.total} icon={Users} color="#2563eb" />
                    <KpiCard label="Al día" value={kpis.al_dia} icon={CheckCircle2} color="#15803d" />
                    <KpiCard label="Próximos a vencer" value={kpis.proximos} icon={Clock} color="#d97706" />
                    <KpiCard label="Vencidos" value={kpis.vencidos} icon={AlertTriangle} color="#dc2626" />
                </KpiCardGrid>

                <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sidebar-border/70 px-4 py-3 dark:border-sidebar-border">
                        <p className="text-sm font-semibold text-foreground">
                            Tablero de estado ({filas.length})
                            {totalPages > 1 && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    — mostrando {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filas.length)} de {filas.length}
                                </span>
                            )}
                        </p>
                        <div className="flex items-center gap-1">
                            {PAGE_SIZES.map((n) => (
                                <button
                                    key={n}
                                    onClick={() => {
                                        setPageSize(n);
                                        setPage(1);
                                    }}
                                    className={`rounded px-2 py-0.5 text-xs border transition-colors ${
                                        pageSize === n
                                            ? 'bg-foreground text-background border-transparent'
                                            : 'bg-card text-muted-foreground border-sidebar-border/70 hover:bg-muted/60 dark:border-sidebar-border'
                                    }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Centro / Área / Cargo</TableHead>
                                    {itemKeys.map((key) => (
                                        <TableHead key={key} className="text-center text-[10px]">
                                            {items_labels[key]}
                                        </TableHead>
                                    ))}
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filasPagina.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={itemKeys.length + 3} className="py-6 text-center text-sm text-muted-foreground">
                                            No hay colaboradores que coincidan con el filtro.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {filasPagina.map((fila) => (
                                    <TableRow
                                        key={fila.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => router.get(route('seguridad.dotacion-epp.show', fila.id))}
                                    >
                                        <TableCell className="font-medium">
                                            {fila.nombre_completo}
                                            <p className="text-xs text-muted-foreground">{fila.cedula}</p>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {[fila.centro, fila.area, fila.cargo].filter(Boolean).join(' · ') || '—'}
                                        </TableCell>
                                        {itemKeys.map((key) => (
                                            <TableCell key={key} className="text-center">
                                                <Punto item={fila.items[key]} />
                                            </TableCell>
                                        ))}
                                        <TableCell>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_BADGE[fila.estado]}`}>
                                                {ESTADO_LABEL[fila.estado]}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sidebar-border/70 px-4 py-3 dark:border-sidebar-border">
                            <p className="text-sm text-muted-foreground">
                                Página <span className="font-semibold text-foreground">{safePage}</span> de{' '}
                                <span className="font-semibold text-foreground">{totalPages}</span>
                            </p>
                            <div className="flex items-center gap-1">
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={safePage === 1}>
                                    <ChevronsLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={safePage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={safePage === totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>
                                    <ChevronsRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
