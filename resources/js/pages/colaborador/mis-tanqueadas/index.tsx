import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { AlertTriangle, Camera, CheckCircle2, LoaderCircle, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Mis Tanqueadas', href: '/portal/mis-tanqueadas' },
];

type Estado = 'pendiente' | 'procesado' | 'error' | 'revisado';

const ESTADO_LABELS: Record<Estado, string> = {
    pendiente: 'En proceso',
    procesado: 'Leído, pendiente de revisión',
    error: 'No se pudo leer, pendiente de revisión manual',
    revisado: 'Confirmado por Flota',
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
    fecha_voucher: string | null;
    created_at: string;
}

export default function MisTanqueadasIndex({ vouchers, placas }: { vouchers: VoucherRow[]; placas: string[] }) {
    const { flash } = usePage<{ flash?: { status?: { message: string; type: string } } }>().props;
    const [placa, setPlaca] = useState<string>('');
    const [foto, setFoto] = useState<{ file: File; preview: string } | null>(null);
    const [enviando, setEnviando] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const camaraRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    const elegirFoto = (file: File) => setFoto({ file, preview: URL.createObjectURL(file) });

    const enviar = () => {
        if (!placa || !foto) {
            setError('Elige la placa y toma o sube la foto del voucher.');
            return;
        }
        setError(null);
        setEnviando(true);

        const fd = new FormData();
        fd.append('placa', placa);
        fd.append('foto', foto.file);

        router.post(route('portal.mis-tanqueadas.store'), fd, {
            forceFormData: true,
            onSuccess: () => {
                setPlaca('');
                setFoto(null);
            },
            onError: (errs) => setError(Object.values(errs)[0] as string),
            onFinish: () => setEnviando(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mis Tanqueadas" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall
                    title="Mis Tanqueadas"
                    description="Sube la foto del voucher de la estación de servicio. Leemos los datos automáticamente y un supervisor de Flota los confirma."
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

                <div className="flex flex-col gap-4 rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                    <Select value={placa} onValueChange={setPlaca}>
                        <SelectTrigger className="w-full sm:w-64">
                            <SelectValue placeholder="¿A qué vehículo le tanqueaste?" />
                        </SelectTrigger>
                        <SelectContent>
                            {placas.map((p) => (
                                <SelectItem key={p} value={p}>
                                    {p}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {foto ? (
                        <div className="relative w-40">
                            <img src={foto.preview} alt="Voucher" className="h-40 w-40 rounded-lg border border-border object-cover" />
                            <button
                                type="button"
                                onClick={() => setFoto(null)}
                                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                                aria-label="Quitar foto"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <input
                                ref={inputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && elegirFoto(e.target.files[0])}
                            />
                            {/* capture="environment" abre la app de cámara nativa del celular (no
                                la cámara web vía getUserMedia): la foto sale en la resolución y
                                calidad reales del sensor, no comprimida por el navegador. */}
                            <input
                                ref={camaraRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && elegirFoto(e.target.files[0])}
                            />
                            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                                <Upload className="size-4" />
                                Subir foto
                            </Button>
                            <Button type="button" variant="outline" onClick={() => camaraRef.current?.click()}>
                                <Camera className="size-4" />
                                Tomar foto
                            </Button>
                        </div>
                    )}

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <Button type="button" disabled={enviando} onClick={enviar} className="w-fit">
                        {enviando && <LoaderCircle className="size-4 animate-spin" />}
                        Subir voucher
                    </Button>
                </div>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Placa</TableHead>
                                <TableHead>Galones</TableHead>
                                <TableHead>Total pagado</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vouchers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                                        Todavía no has subido ningún voucher.
                                    </TableCell>
                                </TableRow>
                            )}
                            {vouchers.map((v) => (
                                <TableRow key={v.id}>
                                    <TableCell>{new Date(v.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell className="font-medium">{v.placa}</TableCell>
                                    <TableCell>{v.galones ?? '—'}</TableCell>
                                    <TableCell>{v.total_pagado ? Number(v.total_pagado).toLocaleString('es-CO') : '—'}</TableCell>
                                    <TableCell>
                                        <Badge variant={ESTADO_VARIANTS[v.estado]}>{ESTADO_LABELS[v.estado]}</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}
