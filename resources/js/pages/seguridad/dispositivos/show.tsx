import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    Calendar,
    CalendarClock,
    ClipboardList,
    Cpu,
    ExternalLink,
    FileSpreadsheet,
    FileText,
    Gauge,
    ImageIcon,
    Pencil,
    Wrench,
} from 'lucide-react';
import { useState } from 'react';

interface DocumentoItem {
    id: number;
    url: string;
    nombre_original: string;
}

interface MantenimientoRow {
    id: number;
    fecha: string;
    descripcion: string;
    realizado_por: { name: string } | null;
}

interface DispositivoDetalle {
    id: number;
    codigo: string;
    marca: string | null;
    modelo: string | null;
    estado: string;
    fecha_calibracion: string | null;
    fecha_vencimiento_certificado: string | null;
    valor_min: string;
    valor_max: string;
    calibracion_proxima: boolean;
    imagenes_paths?: string[];
    documentos_paths?: DocumentoItem[];
}

const ESTADO_COLOR: Record<string, string> = {
    Disponible: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    'En uso': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    'En mantenimiento': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    'Fuera de servicio': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function DocIcon({ nombre }: { nombre: string }) {
    const ext = nombre.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="size-4 shrink-0 text-red-500" />;
    return <FileSpreadsheet className="size-4 shrink-0 text-emerald-600" />;
}

export default function DispositivoShow({
    dispositivo,
    mantenimientos,
}: {
    dispositivo: DispositivoDetalle;
    mantenimientos: MantenimientoRow[];
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Seguridad', href: '/modules/seguridad' },
        { title: 'Dispositivos', href: '/modules/seguridad/dispositivos' },
        { title: dispositivo.codigo, href: `/modules/seguridad/dispositivos/${dispositivo.id}` },
    ];

    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Dispositivo ${dispositivo.codigo}`} />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">

                {/* ── Header ───────────────────────────────────────────── */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                {dispositivo.codigo}
                            </h1>
                            <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_COLOR[dispositivo.estado] ?? 'bg-muted text-muted-foreground'}`}
                            >
                                {dispositivo.estado}
                            </span>
                            {dispositivo.calibracion_proxima && (
                                <Badge variant="destructive" className="gap-1">
                                    <AlertTriangle className="size-3" />
                                    Calibración próxima a vencer
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {[dispositivo.marca, dispositivo.modelo].filter(Boolean).join(' · ') || 'Alcoholímetro'}
                        </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                        <Link href={route('seguridad.dispositivos.edit', dispositivo.id)}>
                            <Pencil className="mr-1.5 size-3.5" />
                            Editar
                        </Link>
                    </Button>
                </div>

                {/* ── Datos técnicos ────────────────────────────────────── */}
                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            <Cpu className="size-4" />
                            Datos técnicos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                                <dt className="text-xs font-medium text-muted-foreground">Código / Serial</dt>
                                <dd className="mt-0.5 font-semibold text-foreground">{dispositivo.codigo}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-muted-foreground">Marca</dt>
                                <dd className="mt-0.5 text-foreground">{dispositivo.marca ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-muted-foreground">Modelo</dt>
                                <dd className="mt-0.5 text-foreground">{dispositivo.modelo ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-muted-foreground">Rango válido</dt>
                                <dd className="mt-0.5 text-foreground">
                                    {dispositivo.valor_min} — {dispositivo.valor_max}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Calendar className="size-3" /> Fecha de calibración
                                </dt>
                                <dd className="mt-0.5 text-foreground">{dispositivo.fecha_calibracion ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <CalendarClock className="size-3" /> Vencimiento certificado
                                </dt>
                                <dd className={`mt-0.5 font-medium ${dispositivo.calibracion_proxima ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                                    {dispositivo.fecha_vencimiento_certificado ?? '—'}
                                </dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>

                {/* ── Imágenes ──────────────────────────────────────────── */}
                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            <ImageIcon className="size-4" />
                            Imágenes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {dispositivo.imagenes_paths && dispositivo.imagenes_paths.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                {dispositivo.imagenes_paths.map((path, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setSelectedImage(path)}
                                        className="group overflow-hidden rounded-lg border border-border"
                                    >
                                        <SafeImage
                                            src={path}
                                            alt={`Imagen ${i + 1}`}
                                            className="h-28 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                        />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No se han cargado imágenes.</p>
                        )}
                    </CardContent>
                </Card>

                {/* ── Documentos ────────────────────────────────────────── */}
                {dispositivo.documentos_paths && dispositivo.documentos_paths.length > 0 && (
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                <FileText className="size-4" />
                                Documentos
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="flex flex-col gap-2">
                                {dispositivo.documentos_paths.map((doc) => (
                                    <li key={doc.id}>
                                        <a
                                            href={doc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-muted"
                                        >
                                            <DocIcon nombre={doc.nombre_original} />
                                            <span className="flex-1 truncate font-medium text-foreground">
                                                {doc.nombre_original}
                                            </span>
                                            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}

                {/* ── Historial de mantenimientos ───────────────────────── */}
                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            <Wrench className="size-4" />
                            Historial de mantenimientos
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">
                            {mantenimientos.length} registro{mantenimientos.length !== 1 ? 's' : ''}
                        </span>
                    </CardHeader>
                    <CardContent className="p-0">
                        {mantenimientos.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                                <ClipboardList className="size-8 opacity-30" />
                                <p>Sin mantenimientos registrados.</p>
                                <p className="text-xs">
                                    Usa el formulario de{' '}
                                    <Link
                                        href={route('seguridad.dispositivos.edit', dispositivo.id)}
                                        className="underline hover:text-foreground"
                                    >
                                        editar dispositivo
                                    </Link>{' '}
                                    para registrar el primer mantenimiento.
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-32">Fecha</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead className="w-44">Registrado por</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mantenimientos.map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell className="font-mono text-xs">{m.fecha}</TableCell>
                                            <TableCell className="whitespace-pre-wrap text-sm">{m.descripcion}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {m.realizado_por?.name ?? '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Lightbox ─────────────────────────────────────────────── */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    onClick={() => setSelectedImage(null)}
                >
                    <img
                        src={selectedImage}
                        alt="Vista previa"
                        className="max-h-[88vh] w-auto max-w-[92vw] rounded-xl object-contain shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </AppLayout>
    );
}
