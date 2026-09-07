import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Evaluaciones OWD', href: '/modules/seguridad/evaluaciones-owd' },
    { title: 'Historial de Cargas', href: '/modules/seguridad/evaluaciones-owd-importaciones' },
];

interface QrSinCoincidencia {
    qr: string;
    evaluado: string | null;
    agencia: string | null;
    total_filas: number;
    ultima_fecha: string | null;
}

interface SinCoincidenciaItem {
    qr: string;
    evaluado: string | null;
    agencia: string | null;
    total_filas: number;
    ultima_fecha: string | null;
}
interface Importacion {
    id: number;
    nombre_archivo: string;
    created_at: string;
    usuario: { name: string } | null;
    registros_leidos: number;
    evaluaciones_identificadas: number;
    registros_nuevos: number;
    registros_duplicados: number;
    registros_sin_coincidencia_qr: number;
    registros_error: number;
    columnas_nuevas_detectadas: string[] | null;
    qrs_sin_coincidencia: QrSinCoincidencia[] | Record<string, QrSinCoincidencia> | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface ImportacionesPaginator {
    data: Importacion[];
    links: PaginationLink[];
}

// Normaliza el campo qrs_sin_coincidencia sea array u objeto
function normalizeQrs(raw: QrSinCoincidencia[] | Record<string, QrSinCoincidencia> | null): QrSinCoincidencia[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return Object.values(raw);
}

function CeldaSinQr({ importacion }: { importacion: Importacion }) {
    const [open, setOpen] = useState(false);
    const qrs = normalizeQrs(importacion.qrs_sin_coincidencia);
    const count = importacion.registros_sin_coincidencia_qr;

    if (count === 0) return <span className="text-muted-foreground">0</span>;

    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1 font-semibold text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 transition-colors"
            >
                <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400">
                    {count}
                </Badge>
                {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            {open && qrs.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-amber-200 dark:border-amber-900/40">
                                <th className="px-2 py-1 text-left font-semibold text-amber-700 dark:text-amber-400">QR Safety</th>
                                <th className="px-2 py-1 text-left font-semibold text-amber-700 dark:text-amber-400">Nombre en Excel</th>
                            </tr>
                        </thead>
                        <tbody>
                            {qrs.map((item, idx) => (
                                <tr key={idx} className="border-b border-amber-100 last:border-0 dark:border-amber-900/20">
                                    <td className="px-2 py-1 font-mono text-slate-700 dark:text-slate-300">{item.qr}</td>
                                    <td className="px-2 py-1 text-slate-600 dark:text-slate-400">{item.evaluado ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {open && qrs.length === 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                    (Importación anterior — QRs no registrados)
                </p>
            )}
        </div>
    );
}

export default function EvaluacionesOwdImportaciones({ importaciones, sin_coincidencia = [] }: {
    importaciones: ImportacionesPaginator;
    sin_coincidencia: SinCoincidenciaItem[];
}) {
    const [busqueda, setBusqueda] = useState('');
    const [seccionAbierta, setSeccionAbierta] = useState(true);

    const filtrados = useMemo(() => {
        const q = busqueda.toLowerCase().trim();
        if (!q) return sin_coincidencia;
        return sin_coincidencia.filter(
            (item) =>
                item.qr.toLowerCase().includes(q) ||
                (item.evaluado ?? '').toLowerCase().includes(q) ||
                (item.agencia ?? '').toLowerCase().includes(q),
        );
    }, [busqueda, sin_coincidencia]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Historial de cargas OWD" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title="Historial de cargas OWD" description="Archivos Excel importados al módulo de Evaluaciones OWD." />

                {/* ── Sección QRs sin coincidencia ── */}
                {sin_coincidencia.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <button
                            type="button"
                            onClick={() => setSeccionAbierta(v => !v)}
                            className="flex w-full items-center justify-between px-5 py-4 text-left"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500">
                                    <AlertTriangle className="size-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                        QRs sin coincidencia en el sistema
                                    </p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                        {sin_coincidencia.length} colaboradores distintos no encontrados en la BD —
                                        sus evaluaciones fueron descartadas
                                    </p>
                                </div>
                            </div>
                            <div className="text-amber-500">
                                {seccionAbierta ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                            </div>
                        </button>

                        {seccionAbierta && (
                            <div className="border-t border-amber-200 px-5 pb-5 dark:border-amber-900/40">
                                <div className="mt-4 flex items-center gap-2">
                                    <div className="relative flex-1 max-w-sm">
                                        <Search className="absolute left-2.5 top-2.5 size-4 text-amber-400" />
                                        <Input
                                            className="pl-8 border-amber-300 bg-white dark:bg-amber-950/30 dark:border-amber-800"
                                            placeholder="Buscar por QR, nombre o agencia..."
                                            value={busqueda}
                                            onChange={e => setBusqueda(e.target.value)}
                                        />
                                    </div>
                                    <span className="text-xs text-amber-600 dark:text-amber-400">
                                        {filtrados.length} de {sin_coincidencia.length}
                                    </span>
                                </div>

                                <div className="mt-3 max-h-96 overflow-y-auto rounded-lg border border-amber-200 dark:border-amber-900/40">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-amber-100/70 dark:bg-amber-950/40">
                                                <TableHead className="text-amber-700 dark:text-amber-400">QR Safety</TableHead>
                                                <TableHead className="text-amber-700 dark:text-amber-400">Nombre en Excel</TableHead>
                                                <TableHead className="text-amber-700 dark:text-amber-400">Agencia</TableHead>
                                                <TableHead className="text-right text-amber-700 dark:text-amber-400">Filas descartadas</TableHead>
                                                <TableHead className="text-amber-700 dark:text-amber-400">Última fecha</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filtrados.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">
                                                        Sin resultados para "{busqueda}"
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {filtrados.map((item) => (
                                                <TableRow key={item.qr}>
                                                    <TableCell className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                        {item.qr}
                                                    </TableCell>
                                                    <TableCell>{item.evaluado ?? '—'}</TableCell>
                                                    <TableCell>{item.agencia ?? '—'}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
                                                            {item.total_filas}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {item.ultima_fecha
                                                            ? new Date(item.ultima_fecha).toLocaleDateString('es-CO')
                                                            : '—'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Historial de importaciones ── */}
                <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Archivo</TableHead>
                                <TableHead>Fecha y hora</TableHead>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Leídos</TableHead>
                                <TableHead>Evaluaciones</TableHead>
                                <TableHead>Nuevos</TableHead>
                                <TableHead>Duplicados</TableHead>
                                <TableHead>Sin QR</TableHead>
                                <TableHead>Errores</TableHead>
                                <TableHead>Columnas nuevas</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {importaciones.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">
                                        No se han importado archivos todavía.
                                    </TableCell>
                                </TableRow>
                            )}
                            {importaciones.data.map((importacion) => (
                                <TableRow key={importacion.id}>
                                    <TableCell className="font-medium">{importacion.nombre_archivo}</TableCell>
                                    <TableCell>{new Date(importacion.created_at).toLocaleString()}</TableCell>
                                    <TableCell>{importacion.usuario?.name ?? '—'}</TableCell>
                                    <TableCell>{importacion.registros_leidos}</TableCell>
                                    <TableCell>{importacion.evaluaciones_identificadas}</TableCell>
                                    <TableCell>{importacion.registros_nuevos}</TableCell>
                                    <TableCell>{importacion.registros_duplicados}</TableCell>
                                    <TableCell className="align-top">
                                        <CeldaSinQr importacion={importacion} />
                                    </TableCell>
                                    <TableCell>
                                        {importacion.registros_error > 0
                                            ? <Badge variant="destructive">{importacion.registros_error}</Badge>
                                            : 0}
                                    </TableCell>
                                    <TableCell>
                                        {importacion.columnas_nuevas_detectadas && importacion.columnas_nuevas_detectadas.length > 0
                                            ? importacion.columnas_nuevas_detectadas.join(', ')
                                            : '—'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {importaciones.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {importaciones.links.map((link, index) => (
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
