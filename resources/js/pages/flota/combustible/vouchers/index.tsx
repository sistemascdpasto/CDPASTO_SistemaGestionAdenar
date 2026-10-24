import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw, ZoomIn } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Análisis de Combustible', href: '/modules/flota/combustible' },
    { title: 'Vouchers de Tanqueo', href: '/modules/flota/combustible/vouchers' },
];

type Estado = 'pendiente' | 'procesado' | 'error' | 'revisado';

const ESTADO_LABELS: Record<Estado, string> = {
    pendiente: 'En proceso',
    procesado: 'Leído por IA',
    error: 'Error de lectura',
    revisado: 'Revisado',
};

const ESTADO_VARIANTS: Record<Estado, 'default' | 'secondary' | 'destructive'> = {
    pendiente: 'secondary',
    procesado: 'secondary',
    error: 'destructive',
    revisado: 'default',
};

interface VoucherRow {
    id: number;
    placa: string;
    foto_url: string;
    estado: Estado;
    galones: string | null;
    total_pagado: string | null;
    precio_galon: string | null;
    fecha_voucher: string | null;
    gemini_error: string | null;
    colaborador: string | null;
    revisado_por: string | null;
    created_at: string;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface VouchersPaginator {
    data: VoucherRow[];
    links: PaginationLink[];
    from: number | null;
}

export default function CombustibleVouchersIndex({ vouchers, filters }: { vouchers: VouchersPaginator; filters: { estado: string } }) {
    const { flash } = usePage<{ flash?: { status?: { message: string; type: string } } }>().props;
    const [editando, setEditando] = useState<VoucherRow | null>(null);
    const [form, setForm] = useState({ placa: '', galones: '', total_pagado: '', precio_galon: '', fecha_voucher: '' });
    const [guardando, setGuardando] = useState(false);
    const [reprocesandoId, setReprocesandoId] = useState<number | null>(null);
    const [imagenAmpliada, setImagenAmpliada] = useState<string | null>(null);

    const abrirEdicion = (v: VoucherRow) => {
        setEditando(v);
        setForm({
            placa: v.placa,
            galones: v.galones ?? '',
            total_pagado: v.total_pagado ?? '',
            precio_galon: v.precio_galon ?? '',
            fecha_voucher: v.fecha_voucher ?? '',
        });
    };

    const guardar: FormEventHandler = (e) => {
        e.preventDefault();
        if (!editando) return;
        setGuardando(true);
        router.put(route('flota.combustible.vouchers.update', editando.id), form, {
            onSuccess: () => setEditando(null),
            onFinish: () => setGuardando(false),
        });
    };

    const reprocesar = (id: number) => {
        setReprocesandoId(id);
        router.post(route('flota.combustible.vouchers.reprocesar', id), {}, { onFinish: () => setReprocesandoId(null) });
    };

    const cambiarFiltro = (estado: string) => {
        router.get(route('flota.combustible.vouchers.index'), { estado }, { preserveState: true, replace: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Vouchers de Tanqueo" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall
                    title="Vouchers de Tanqueo"
                    description="Revisa y confirma los datos leídos por IA antes de que cuenten en el rendimiento km/gl."
                />

                {flash?.status && (
                    <div
                        className={`flex items-center gap-2 rounded-lg border p-4 text-sm font-medium shadow-xs ${
                            flash.status.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                    >
                        {flash.status.type === 'success' ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
                        <span>{flash.status.message}</span>
                    </div>
                )}

                <div className="flex rounded-md border border-sidebar-border/70 p-1 w-fit">
                    {(['pendientes', 'revisado', 'todos'] as const).map((opcion) => (
                        <Button
                            key={opcion}
                            type="button"
                            variant={filters.estado === opcion ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => cambiarFiltro(opcion)}
                        >
                            {opcion === 'pendientes' ? 'Pendientes de revisión' : opcion === 'revisado' ? 'Revisados' : 'Todos'}
                        </Button>
                    ))}
                </div>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Foto</TableHead>
                                <TableHead>Placa</TableHead>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Galones</TableHead>
                                <TableHead>Total pagado</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vouchers.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                                        No hay vouchers en este filtro.
                                    </TableCell>
                                </TableRow>
                            )}
                            {vouchers.data.map((v) => (
                                <TableRow key={v.id}>
                                    <TableCell>
                                        <button type="button" onClick={() => setImagenAmpliada(v.foto_url)} aria-label="Ampliar imagen del voucher">
                                            <img src={v.foto_url} alt="Voucher" className="h-12 w-12 cursor-zoom-in rounded-md border border-border object-cover" />
                                        </button>
                                    </TableCell>
                                    <TableCell className="font-medium">{v.placa}</TableCell>
                                    <TableCell className="text-muted-foreground">{v.colaborador ?? '—'}</TableCell>
                                    <TableCell>{v.galones ?? '—'}</TableCell>
                                    <TableCell>{v.total_pagado ? Number(v.total_pagado).toLocaleString('es-CO') : '—'}</TableCell>
                                    <TableCell>
                                        <Badge variant={ESTADO_VARIANTS[v.estado]}>{ESTADO_LABELS[v.estado]}</Badge>
                                        {v.gemini_error && <p className="mt-1 max-w-48 text-[11px] text-muted-foreground">{v.gemini_error}</p>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {v.estado === 'error' && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={reprocesandoId === v.id}
                                                    onClick={() => reprocesar(v.id)}
                                                    aria-label="Reprocesar con IA"
                                                >
                                                    {reprocesandoId === v.id ? (
                                                        <LoaderCircle className="size-4 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="size-4" />
                                                    )}
                                                </Button>
                                            )}
                                            <Button type="button" variant="outline" size="sm" onClick={() => abrirEdicion(v)}>
                                                Revisar
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {vouchers.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {vouchers.links.map((link, index) => (
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

            <Dialog open={editando !== null} onOpenChange={(open) => !open && setEditando(null)}>
                <DialogContent>
                    <DialogTitle>Revisar voucher — {editando?.placa}</DialogTitle>
                    {editando && (
                        <form onSubmit={guardar} className="space-y-4">
                            <button
                                type="button"
                                onClick={() => setImagenAmpliada(editando.foto_url)}
                                className="group relative block w-full"
                                aria-label="Ampliar imagen del voucher"
                            >
                                <img
                                    src={editando.foto_url}
                                    alt="Voucher"
                                    className="max-h-64 w-full cursor-zoom-in rounded-md border border-border object-contain"
                                />
                                <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                                    <ZoomIn className="size-3.5" />
                                    Ampliar
                                </span>
                            </button>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1">
                                    <Label>Placa</Label>
                                    <Input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} />
                                </div>
                                <div className="grid gap-1">
                                    <Label>Fecha del voucher</Label>
                                    <Input
                                        type="date"
                                        value={form.fecha_voucher}
                                        onChange={(e) => setForm({ ...form, fecha_voucher: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label>Galones</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={form.galones}
                                        onChange={(e) => setForm({ ...form, galones: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label>Total pagado</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={form.total_pagado}
                                        onChange={(e) => setForm({ ...form, total_pagado: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label>Precio/galón (opcional)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={form.precio_galon}
                                        onChange={(e) => setForm({ ...form, precio_galon: e.target.value })}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={guardando}>
                                    {guardando && <LoaderCircle className="size-4 animate-spin" />}
                                    Confirmar y marcar como revisado
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={imagenAmpliada !== null} onOpenChange={(open) => !open && setImagenAmpliada(null)}>
                <DialogContent className="max-h-[95vh] max-w-5xl overflow-y-auto p-2">
                    <DialogTitle className="sr-only">Voucher ampliado</DialogTitle>
                    {imagenAmpliada && <img src={imagenAmpliada} alt="Voucher ampliado" className="h-auto w-full rounded-md object-contain" />}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
