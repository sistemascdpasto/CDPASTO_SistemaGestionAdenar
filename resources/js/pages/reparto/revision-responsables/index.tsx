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
    { title: 'Responsables', href: '/modules/reparto/revision-responsables' },
];

interface ResponsableRow {
    id: number;
    is_active: boolean;
    colaborador: { id: number; nombre_completo: string; cedula: string | null; cargo: string | null };
}

export default function RevisionResponsablesIndex({ responsables }: { responsables: ResponsableRow[] }) {
    const toggleActivo = (r: ResponsableRow) => {
        router.patch(route('reparto.revision-responsables.toggle-activo', r.id), {}, { preserveScroll: true });
    };

    const quitar = (r: ResponsableRow) => {
        router.delete(route('reparto.revision-responsables.destroy', r.id), { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Responsables de la Ruleta" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <HeadingSmall
                        title="Responsables de la Ruleta"
                        description="Colaboradores que participan en el sorteo de responsable de la Revisión Aleatoria."
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href={route('reparto.revision-aleatoria.index')}>
                                <ArrowLeft className="size-4" /> Volver
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href={route('reparto.revision-responsables.create')}>
                                <Plus className="size-4" /> Agregar responsable
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Cédula</TableHead>
                                <TableHead>Cargo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {responsables.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                                        No hay responsables configurados todavía.
                                    </TableCell>
                                </TableRow>
                            )}
                            {responsables.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell className="font-medium">{r.colaborador.nombre_completo}</TableCell>
                                    <TableCell>{r.colaborador.cedula ?? '—'}</TableCell>
                                    <TableCell>{r.colaborador.cargo ?? '—'}</TableCell>
                                    <TableCell>
                                        <Badge variant={r.is_active ? 'default' : 'destructive'}>{r.is_active ? 'Activo' : 'Inactivo'}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => toggleActivo(r)}
                                                aria-label={r.is_active ? 'Desactivar' : 'Activar'}
                                                title={r.is_active ? 'Desactivar' : 'Activar'}
                                                className={r.is_active ? 'text-emerald-600' : 'text-muted-foreground'}
                                            >
                                                <Power className="size-4" />
                                            </Button>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="destructive" size="sm">
                                                        Quitar
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogTitle>¿Quitar a {r.colaborador.nombre_completo} de la ruleta?</DialogTitle>
                                                    <DialogDescription>
                                                        No participará más en el sorteo de responsable. Puedes volver a agregarlo cuando quieras.
                                                    </DialogDescription>
                                                    <DialogFooter>
                                                        <DialogClose asChild>
                                                            <Button variant="secondary">Cancelar</Button>
                                                        </DialogClose>
                                                        <Button variant="destructive" onClick={() => quitar(r)}>
                                                            Quitar
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
