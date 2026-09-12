import HeadingSmall from '@/components/heading-small';
import { IconActionButton } from '@/components/icon-action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { FirmaPad, type FirmaPadHandle } from '@/pages/seguridad/pruebas/firma-pad';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FileSpreadsheet, FileText, LoaderCircle, Pencil, PenLine, Search, Trash2 } from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Condiciones de Salud', href: '/modules/seguridad/condiciones-salud' },
];

const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
    Bueno: 'default',
    Regular: 'secondary',
    Malo: 'destructive',
};

function EstadoBadge({ estado }: { estado: string | null }) {
    if (!estado) return <span className="text-muted-foreground">—</span>;
    return <Badge variant={ESTADO_VARIANT[estado] ?? 'secondary'}>{estado}</Badge>;
}

const TURNO_LABELS: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };

interface RegistroFila {
    fecha: string;
    colaborador: {
        nombres: string;
        apellidos: string;
        cedula: string;
        cargo: string | null;
        area: string | null;
        turno: string | null;
    };
    hora_ingreso: string | null;
    estado_ingreso: string | null;
    observacion_ingreso: string | null;
    ingreso_id: number | null;
    hora_salida: string | null;
    estado_salida: string | null;
    observacion_salida: string | null;
    salida_id: number | null;
    firma_colaborador_url: string | null;
    firma_supervisor_url: string | null;
    firmado_en: string | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface RegistrosPaginator {
    data: RegistroFila[];
    links: PaginationLink[];
}

interface Filters {
    identificacion: string;
    nombre: string;
    desde: string;
    hasta: string;
    [key: string]: string;
}

function FirmaThumb({ url, alt }: { url: string; alt: string }) {
    return <img src={url} alt={alt} className="h-10 w-20 rounded border border-border bg-white object-contain" />;
}

function FirmarSupervisorDialog({ salidaId }: { salidaId: number }) {
    const [open, setOpen] = useState(false);
    const firmaRef = useRef<FirmaPadHandle>(null);
    const { post, processing, transform } = useForm<{ firma: File | null }>({ firma: null });

    const submit: FormEventHandler = async (e) => {
        e.preventDefault();
        const firma = await firmaRef.current?.getFile();
        if (!firma) return;

        transform((data) => ({ ...data, firma }));
        post(route('seguridad.condiciones-salud.firmar', salidaId), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <PenLine className="size-3.5" />
                    Firmar
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Firma del supervisor</DialogTitle>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <FirmaPad ref={firmaRef} />
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Guardar firma
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface EditarCondicionDialogProps {
    condicionId: number;
    momento: 'ingreso' | 'salida';
    estadoActual: string | null;
    observacionActual: string | null;
    colaboradorNombre: string;
    fecha: string;
}

function EditarCondicionDialog({
    condicionId,
    momento,
    estadoActual,
    observacionActual,
    colaboradorNombre,
    fecha,
}: EditarCondicionDialogProps) {
    const [open, setOpen] = useState(false);
    const { data, setData, patch, processing, errors, reset } = useForm<{ estado: string; observacion: string }>({
        estado: estadoActual ?? 'Bueno',
        observacion: observacionActual ?? '',
    });

    useEffect(() => {
        if (open) {
            setData({ estado: estadoActual ?? 'Bueno', observacion: observacionActual ?? '' });
        }
    }, [open, estadoActual, observacionActual, setData]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(route('seguridad.condiciones-salud.update', condicionId), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });
    };

    const momentoLabel = momento === 'ingreso' ? 'Ingreso' : 'Salida';
    const requiereObservacion = data.estado === 'Regular' || data.estado === 'Malo';

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <IconActionButton icon={Pencil} label={`Editar ${momentoLabel}`} />
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Editar condición de salud — {momentoLabel}
                    </DialogTitle>
                    <DialogDescription>
                        {colaboradorNombre} · {fecha}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor={`estado-${condicionId}-${momento}`}>Estado</Label>
                        <Select value={data.estado} onValueChange={(value) => setData('estado', value)}>
                            <SelectTrigger id={`estado-${condicionId}-${momento}`}>
                                <SelectValue placeholder="Seleccione el estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Bueno">Bueno</SelectItem>
                                <SelectItem value="Regular">Regular</SelectItem>
                                <SelectItem value="Malo">Malo</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.estado && <p className="text-xs text-destructive">{errors.estado}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor={`observacion-${condicionId}-${momento}`}>
                            Observación {requiereObservacion && <span className="text-destructive">*</span>}
                        </Label>
                        <Textarea
                            id={`observacion-${condicionId}-${momento}`}
                            value={data.observacion}
                            onChange={(e) => setData('observacion', e.target.value)}
                            placeholder={requiereObservacion ? 'Describa la condición del colaborador' : 'Observaciones adicionales (opcional)'}
                            rows={3}
                        />
                        {errors.observacion && <p className="text-xs text-destructive">{errors.observacion}</p>}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Guardar cambios
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface EliminarCondicionDialogProps {
    condicionId: number;
    momento: 'ingreso' | 'salida';
    colaboradorNombre: string;
    fecha: string;
}

function EliminarCondicionDialog({ condicionId, momento, colaboradorNombre, fecha }: EliminarCondicionDialogProps) {
    const momentoLabel = momento === 'ingreso' ? 'Ingreso' : 'Salida';

    const destroy = () => {
        router.delete(route('seguridad.condiciones-salud.destroy', condicionId), { preserveScroll: true });
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <IconActionButton
                    icon={Trash2}
                    label={`Eliminar ${momentoLabel}`}
                    className="text-destructive hover:text-destructive"
                />
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        ¿Eliminar registro de {momentoLabel.toLowerCase()}?
                    </DialogTitle>
                    <DialogDescription>
                        Esta acción eliminará permanentemente el registro de condición de salud de{' '}
                        <strong>{colaboradorNombre}</strong> del día {fecha}.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button variant="destructive" onClick={destroy}>
                        Eliminar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AccionesFila({ fila }: { fila: RegistroFila }) {
    const nombreCompleto = `${fila.colaborador.nombres} ${fila.colaborador.apellidos}`;

    return (
        <div className="flex flex-col gap-2">
            {fila.ingreso_id && (
                <div className="flex items-center gap-1">
                    <span className="text-[10px] uppercase text-muted-foreground w-14">Ingreso</span>
                    <EditarCondicionDialog
                        condicionId={fila.ingreso_id}
                        momento="ingreso"
                        estadoActual={fila.estado_ingreso}
                        observacionActual={fila.observacion_ingreso}
                        colaboradorNombre={nombreCompleto}
                        fecha={fila.fecha}
                    />
                    <EliminarCondicionDialog
                        condicionId={fila.ingreso_id}
                        momento="ingreso"
                        colaboradorNombre={nombreCompleto}
                        fecha={fila.fecha}
                    />
                </div>
            )}
            {fila.salida_id && (
                <div className="flex items-center gap-1">
                    <span className="text-[10px] uppercase text-muted-foreground w-14">Salida</span>
                    <EditarCondicionDialog
                        condicionId={fila.salida_id}
                        momento="salida"
                        estadoActual={fila.estado_salida}
                        observacionActual={fila.observacion_salida}
                        colaboradorNombre={nombreCompleto}
                        fecha={fila.fecha}
                    />
                    <EliminarCondicionDialog
                        condicionId={fila.salida_id}
                        momento="salida"
                        colaboradorNombre={nombreCompleto}
                        fecha={fila.fecha}
                    />
                </div>
            )}
        </div>
    );
}

export default function CondicionesSaludIndex({ registros, filters }: { registros: RegistrosPaginator; filters: Filters }) {
    const [form, setForm] = useState(filters);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        router.get(route('seguridad.condiciones-salud.index'), form, { preserveState: true, replace: true });
    };

    const exportUrl = (ruta: string) => route(ruta, { ...form });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Condiciones de Salud" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall
                    title="Condiciones de Salud"
                    description="Historial de autorregistro de condición de salud de los colaboradores, agrupado por día."
                />

                <form onSubmit={submit} className="grid gap-4 sm:grid-cols-4">
                    <div className="grid gap-2">
                        <Label htmlFor="identificacion">Identificación</Label>
                        <Input
                            id="identificacion"
                            value={form.identificacion}
                            onChange={(e) => setForm({ ...form, identificacion: e.target.value })}
                            placeholder="Cédula"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="nombre">Nombre</Label>
                        <Input
                            id="nombre"
                            value={form.nombre}
                            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                            placeholder="Nombre o apellido"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="desde">Desde</Label>
                        <Input id="desde" type="date" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="hasta">Hasta</Label>
                        <div className="flex gap-2">
                            <Input id="hasta" type="date" value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} />
                            <Button type="submit" variant="secondary" size="icon" aria-label="Filtrar">
                                <Search className="size-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-2 sm:col-span-4">
                        <Button type="button" variant="outline" asChild>
                            <a href={exportUrl('seguridad.condiciones-salud.exportar-pdf')}>
                                <FileText className="size-4" />
                                Exportar PDF
                            </a>
                        </Button>
                        <Button type="button" variant="outline" asChild>
                            <a href={exportUrl('seguridad.condiciones-salud.exportar-excel')}>
                                <FileSpreadsheet className="size-4" />
                                Exportar Excel
                            </a>
                        </Button>
                    </div>
                </form>

                <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Cargo / Área</TableHead>
                                <TableHead>Turno</TableHead>
                                <TableHead>Hora ingreso</TableHead>
                                <TableHead>Estado ingreso</TableHead>
                                <TableHead>Observación ingreso</TableHead>
                                <TableHead>Hora salida</TableHead>
                                <TableHead>Estado salida</TableHead>
                                <TableHead>Observación salida</TableHead>
                                <TableHead>Firma Colaborador</TableHead>
                                <TableHead>Firma Supervisor</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {registros.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={13} className="text-muted-foreground py-6 text-center">
                                        No se encontraron registros en el rango seleccionado.
                                    </TableCell>
                                </TableRow>
                            )}
                            {registros.data.map((fila, index) => (
                                <TableRow key={`${fila.colaborador.cedula}-${fila.fecha}-${index}`}>
                                    <TableCell>{fila.fecha}</TableCell>
                                    <TableCell className="font-medium">
                                        {fila.colaborador.nombres} {fila.colaborador.apellidos}
                                        <div className="text-xs text-muted-foreground">{fila.colaborador.cedula}</div>
                                    </TableCell>
                                    <TableCell>{[fila.colaborador.cargo, fila.colaborador.area].filter(Boolean).join(' / ') || '—'}</TableCell>
                                    <TableCell>{fila.colaborador.turno ? (TURNO_LABELS[fila.colaborador.turno] ?? fila.colaborador.turno) : '—'}</TableCell>
                                    <TableCell>{fila.hora_ingreso ?? '—'}</TableCell>
                                    <TableCell>
                                        <EstadoBadge estado={fila.estado_ingreso} />
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">{fila.observacion_ingreso ?? '—'}</TableCell>
                                    <TableCell>{fila.hora_salida ?? '—'}</TableCell>
                                    <TableCell>
                                        <EstadoBadge estado={fila.estado_salida} />
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">{fila.observacion_salida ?? '—'}</TableCell>
                                    <TableCell>
                                        {fila.firma_colaborador_url ? (
                                            <FirmaThumb url={fila.firma_colaborador_url} alt="Firma del colaborador" />
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {fila.firma_supervisor_url ? (
                                            <FirmaThumb url={fila.firma_supervisor_url} alt="Firma del supervisor" />
                                        ) : fila.salida_id ? (
                                            <FirmarSupervisorDialog salidaId={fila.salida_id} />
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <AccionesFila fila={fila} />
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
