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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

/* ── Tipos ─────────────────────────────────────────────────────────────── */

interface OpcionItem {
    id: number;
    nombre: string;
    es_personalizado: boolean;
}

interface CategoriaData {
    etiqueta: string;
    opciones: OpcionItem[];
}

interface CargoItem {
    id: number;
    nombre: string;
}

interface PerfilItem {
    id: number;
    nombre: string;
    observaciones: string;
}

interface Props {
    tiposDocumento: OpcionItem[];
    opcionesPorCategoria: Record<string, CategoriaData>;
    cargos: CargoItem[];
    perfilesCargos: PerfilItem[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Configuración del formulario', href: '/modules/gente/configuracion-catalogo' },
];

/* ── Componente de tabla reutilizable ──────────────────────────────────── */

function TablaOpciones({
    titulo,
    opciones,
    rutaStore,
    rutaUpdate,
    rutaDestroy,
    campoExtra,
}: {
    titulo: string;
    opciones: OpcionItem[];
    rutaStore: string;
    rutaUpdate: (id: number) => string;
    rutaDestroy: (id: number) => string;
    campoExtra?: { label: string; name: string; tipo: 'input' | 'textarea' };
}) {
    const [editando, setEditando] = useState<OpcionItem | null>(null);

    const formCrear = useForm<Record<string, string>>({ nombre: '', ...(campoExtra ? { [campoExtra.name]: '' } : {}) });
    const formEditar = useForm<Record<string, string>>({ nombre: '', ...(campoExtra ? { [campoExtra.name]: '' } : {}) });

    const handleCrear: FormEventHandler = (e) => {
        e.preventDefault();
        formCrear.post(rutaStore, {
            preserveScroll: true,
            onSuccess: () => formCrear.reset(),
        });
    };

    const handleEditar: FormEventHandler = (e) => {
        e.preventDefault();
        if (!editando) return;
        formEditar.patch(rutaUpdate(editando.id), {
            preserveScroll: true,
            onSuccess: () => setEditando(null),
        });
    };

    const handleEliminar = (opcion: OpcionItem) => {
        if (!confirm(`¿Eliminar "${opcion.nombre}"? Los colaboradores que la usaban quedarán con ese campo vacío.`)) return;
        router.delete(rutaDestroy(opcion.id), { preserveScroll: true });
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>

                {/* Botón agregar */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1.5">
                            <Plus className="size-3.5" />
                            Agregar
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Agregar opción — {titulo}</DialogTitle>
                            <DialogDescription className="text-xs">
                                La nueva opción quedará disponible inmediatamente en los formularios.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCrear} className="space-y-4 pt-2">
                            <div className="grid gap-2">
                                <Label htmlFor={`crear_nombre_${titulo}`}>Nombre</Label>
                                <Input
                                    id={`crear_nombre_${titulo}`}
                                    value={formCrear.data.nombre}
                                    onChange={(e) => formCrear.setData('nombre', e.target.value)}
                                    maxLength={150}
                                    disabled={formCrear.processing}
                                    autoFocus
                                />
                                <InputError message={formCrear.errors.nombre} />
                            </div>
                            {campoExtra && (
                                <div className="grid gap-2">
                                    <Label htmlFor={`crear_extra_${titulo}`}>{campoExtra.label}</Label>
                                    {campoExtra.tipo === 'textarea' ? (
                                        <Textarea
                                            id={`crear_extra_${titulo}`}
                                            value={formCrear.data[campoExtra.name] ?? ''}
                                            onChange={(e) => formCrear.setData(campoExtra.name, e.target.value)}
                                            rows={4}
                                            disabled={formCrear.processing}
                                        />
                                    ) : (
                                        <Input
                                            id={`crear_extra_${titulo}`}
                                            value={formCrear.data[campoExtra.name] ?? ''}
                                            onChange={(e) => formCrear.setData(campoExtra.name, e.target.value)}
                                            disabled={formCrear.processing}
                                        />
                                    )}
                                    <InputError message={formCrear.errors[campoExtra.name]} />
                                </div>
                            )}
                            <DialogFooter className="gap-2 pt-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="outline" size="sm" disabled={formCrear.processing}>Cancelar</Button>
                                </DialogClose>
                                <Button type="submit" size="sm" disabled={formCrear.processing || !formCrear.data.nombre.trim()}>
                                    {formCrear.processing && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                                    Guardar
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/40">
                            <TableHead className="font-semibold">Nombre</TableHead>
                            {campoExtra && <TableHead className="font-semibold">{campoExtra.label}</TableHead>}
                            <TableHead className="w-24 text-right font-semibold">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {opciones.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={campoExtra ? 3 : 2} className="py-6 text-center text-xs text-muted-foreground">
                                    Sin opciones registradas.
                                </TableCell>
                            </TableRow>
                        )}
                        {opciones.map((op) => (
                            <TableRow key={op.id}>
                                <TableCell className="font-medium text-sm">{op.nombre}</TableCell>
                                {campoExtra && (
                                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                                        {(op as unknown as Record<string, string>)[campoExtra.name] ?? '—'}
                                    </TableCell>
                                )}
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        {/* Botón editar */}
                                        <Dialog open={editando?.id === op.id} onOpenChange={(open) => {
                                            if (open) {
                                                setEditando(op);
                                                formEditar.setData('nombre', op.nombre);
                                                if (campoExtra) {
                                                    const val = (op as unknown as Record<string, string>)[campoExtra.name] ?? '';
                                                    formEditar.setData(campoExtra.name, val);
                                                }
                                            } else {
                                                setEditando(null);
                                            }
                                        }}>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" title="Editar">
                                                    <Pencil className="size-3.5" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle>Editar — {titulo}</DialogTitle>
                                                    <DialogDescription className="text-xs">
                                                        Al guardar se actualizará en todos los colaboradores que la usen.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <form onSubmit={handleEditar} className="space-y-4 pt-2">
                                                    <div className="grid gap-2">
                                                        <Label>Nombre</Label>
                                                        <Input
                                                            value={formEditar.data.nombre}
                                                            onChange={(e) => formEditar.setData('nombre', e.target.value)}
                                                            maxLength={150}
                                                            disabled={formEditar.processing}
                                                            autoFocus
                                                        />
                                                        <InputError message={formEditar.errors.nombre} />
                                                    </div>
                                                    {campoExtra && (
                                                        <div className="grid gap-2">
                                                            <Label>{campoExtra.label}</Label>
                                                            {campoExtra.tipo === 'textarea' ? (
                                                                <Textarea
                                                                    value={formEditar.data[campoExtra.name] ?? ''}
                                                                    onChange={(e) => formEditar.setData(campoExtra.name, e.target.value)}
                                                                    rows={4}
                                                                    disabled={formEditar.processing}
                                                                />
                                                            ) : (
                                                                <Input
                                                                    value={formEditar.data[campoExtra.name] ?? ''}
                                                                    onChange={(e) => formEditar.setData(campoExtra.name, e.target.value)}
                                                                    disabled={formEditar.processing}
                                                                />
                                                            )}
                                                            <InputError message={formEditar.errors[campoExtra.name]} />
                                                        </div>
                                                    )}
                                                    <DialogFooter className="gap-2 pt-2">
                                                        <DialogClose asChild>
                                                            <Button type="button" variant="outline" size="sm" disabled={formEditar.processing}>Cancelar</Button>
                                                        </DialogClose>
                                                        <Button type="submit" size="sm" disabled={formEditar.processing || !formEditar.data.nombre.trim()}>
                                                            {formEditar.processing && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                                                            Guardar cambios
                                                        </Button>
                                                    </DialogFooter>
                                                </form>
                                            </DialogContent>
                                        </Dialog>

                                        {/* Botón eliminar */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7 text-muted-foreground hover:text-destructive"
                                            title="Eliminar"
                                            onClick={() => handleEliminar(op)}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

/* ── Página principal ──────────────────────────────────────────────────── */

export default function ConfiguracionCatalogo({
    tiposDocumento,
    opcionesPorCategoria,
    cargos,
    perfilesCargos,
}: Props) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Configuración del formulario" />
            <div className="flex h-full flex-1 flex-col gap-8 rounded-xl p-4">

                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Configuración del formulario de colaboradores
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Administra las opciones de los campos con "Agregar otro". Los cambios se reflejan de inmediato en los formularios.
                    </p>
                </div>

                {/* ── Tipos de documento ── */}
                <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
                    <h2 className="border-l-4 border-emerald-500 pl-3 text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                        Tipos de documento
                    </h2>
                    <TablaOpciones
                        titulo="Tipos de documento"
                        opciones={tiposDocumento}
                        rutaStore={route('gente.tipos-documento.store')}
                        rutaUpdate={(id) => route('gente.tipos-documento.update', id)}
                        rutaDestroy={(id) => route('gente.tipos-documento.destroy', id)}
                    />
                </section>

                {/* ── Opciones de catálogo por categoría ── */}
                {Object.entries(opcionesPorCategoria).map(([categoria, { etiqueta, opciones }]) => (
                    <section key={categoria} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
                        <h2 className="border-l-4 border-emerald-500 pl-3 text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                            {etiqueta}
                        </h2>
                        <TablaOpciones
                            titulo={etiqueta}
                            opciones={opciones}
                            rutaStore={route('gente.opciones-catalogo.store')}
                            rutaUpdate={(id) => route('gente.opciones-catalogo.update', id)}
                            rutaDestroy={(id) => route('gente.opciones-catalogo.destroy', id)}
                        />
                    </section>
                ))}

                {/* ── Cargos ── */}
                <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
                    <h2 className="border-l-4 border-emerald-500 pl-3 text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                        Cargos
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Los cargos se sincronizan automáticamente desde GeoVictoria. Aquí puedes eliminar los que ya no existen.
                    </p>
                    <TablaOpciones
                        titulo="Cargos"
                        opciones={cargos.map((c) => ({ ...c, es_personalizado: true }))}
                        rutaStore={route('gente.tipos-documento.store')}
                        rutaUpdate={(id) => route('gente.cargos.update', id)}
                        rutaDestroy={(id) => route('gente.cargos.destroy', id)}
                    />
                </section>

                {/* ── Perfiles / Funciones de cargo ── */}
                <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
                    <h2 className="border-l-4 border-emerald-500 pl-3 text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                        Perfiles / Funciones del cargo
                    </h2>
                    <TablaOpciones
                        titulo="Perfiles"
                        opciones={perfilesCargos.map((p) => ({ id: p.id, nombre: p.nombre, es_personalizado: true, observaciones: p.observaciones }))}
                        rutaStore={route('gente.perfiles-cargos.store')}
                        rutaUpdate={(id) => route('gente.perfiles-cargos.update', id)}
                        rutaDestroy={(id) => route('gente.perfiles-cargos.destroy', id)}
                        campoExtra={{ label: 'Funciones / Observaciones', name: 'observaciones', tipo: 'textarea' }}
                    />
                </section>

            </div>
        </AppLayout>
    );
}
