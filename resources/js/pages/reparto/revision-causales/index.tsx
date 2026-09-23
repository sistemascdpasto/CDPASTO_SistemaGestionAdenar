import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Plus, Power } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Revisión Aleatoria', href: '/modules/reparto/revision-aleatoria' },
    { title: 'Causales', href: '/modules/reparto/revision-causales' },
];

interface CausalRow {
    id: number;
    nombre: string;
    requiere_especificacion: boolean;
    is_active: boolean;
}

export default function RevisionCausalesIndex({ causales }: { causales: CausalRow[] }) {
    const toggleActivo = (c: CausalRow) => {
        router.patch(route('reparto.revision-causales.toggle-activo', c.id), {}, { preserveScroll: true });
    };

    const eliminar = (c: CausalRow) => {
        router.delete(route('reparto.revision-causales.destroy', c.id), { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Causales de Novedad" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <HeadingSmall title="Causales de Novedad" description="Motivos disponibles al registrar una novedad en la Revisión Aleatoria." />
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href={route('reparto.revision-aleatoria.index')}>
                                <ArrowLeft className="size-4" /> Volver
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href={route('reparto.revision-causales.create')}>
                                <Plus className="size-4" /> Nueva causal
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Pide especificar motivo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {causales.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                                        No hay causales configuradas.
                                    </TableCell>
                                </TableRow>
                            )}
                            {causales.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.nombre}</TableCell>
                                    <TableCell>{c.requiere_especificacion ? 'Sí' : 'No'}</TableCell>
                                    <TableCell>
                                        <Badge variant={c.is_active ? 'default' : 'destructive'}>{c.is_active ? 'Activa' : 'Inactiva'}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={route('reparto.revision-causales.edit', c.id)}>Editar</Link>
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => toggleActivo(c)}
                                                aria-label={c.is_active ? 'Desactivar' : 'Activar'}
                                                title={c.is_active ? 'Desactivar' : 'Activar'}
                                                className={c.is_active ? 'text-emerald-600' : 'text-muted-foreground'}
                                            >
                                                <Power className="size-4" />
                                            </Button>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="destructive" size="sm">
                                                        Eliminar
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogTitle>¿Eliminar la causal "{c.nombre}"?</DialogTitle>
                                                    <DialogDescription>
                                                        Si ya está usada en novedades registradas, no se podrá eliminar — desactívala en su lugar.
                                                    </DialogDescription>
                                                    <DialogFooter>
                                                        <DialogClose asChild>
                                                            <Button variant="secondary">Cancelar</Button>
                                                        </DialogClose>
                                                        <Button variant="destructive" onClick={() => eliminar(c)}>
                                                            Eliminar
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
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
