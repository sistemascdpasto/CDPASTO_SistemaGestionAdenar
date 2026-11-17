import { IconActionButton } from '@/components/icon-action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link, router } from '@inertiajs/react';
import { Check, X } from 'lucide-react';

const PILAR_LABELS: Record<string, string> = {
    seguridad: 'Seguridad',
    gente: 'Gente',
    flota: 'Flota',
    reparto: 'Reparto',
};

export interface AlertaRow {
    id: number;
    tipo: string;
    tipo_label: string;
    pilar: string;
    mensaje: string;
    atendida: boolean;
    created_at: string;
    colaborador: { id: number; nombres: string; apellidos: string; fecha_retiro_empresa: string | null; cantidad_prorrogas: number } | null;
    alcoholimetro: { codigo: string } | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export interface AlertasPaginator {
    data: AlertaRow[];
    links: PaginationLink[];
}

/**
 * Pantalla de Alertas compartida entre Seguridad/Gente/Flota — extraída de
 * la página original de Seguridad. Administrador ve alertas de cualquier
 * pilar (el backend no filtra para él), por eso siempre se muestra la
 * columna "Pilar"; para un usuario normal todas sus filas comparten el
 * mismo pilar, así que la columna no estorba.
 */
export default function AlertasIndex({
    routeIndex,
    routeAtender,
    routeDestroy,
    alertas,
    filters,
}: {
    routeIndex: string;
    routeAtender: string;
    routeDestroy: string;
    alertas: AlertasPaginator;
    filters: { estado: string };
}) {
    const filtrarPorEstado = (estado: string) => {
        router.get(route(routeIndex), { estado }, { preserveState: true, replace: true });
    };

    const atender = (alerta: AlertaRow) => {
        router.patch(route(routeAtender, alerta.id), {}, { preserveScroll: true });
    };

    const eliminar = (alerta: AlertaRow) => {
        if (!confirm(`¿Estás seguro de eliminar esta alerta?\n\n"${alerta.mensaje}"\n\nEsta acción no se puede deshacer.`)) return;
        router.delete(route(routeDestroy, alerta.id), { preserveScroll: true });
    };

    return (
        <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
            <Select value={filters.estado} onValueChange={filtrarPorEstado}>
                <SelectTrigger className="w-48">
                    <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="pendientes">Pendientes</SelectItem>
                    <SelectItem value="atendidas">Atendidas</SelectItem>
                    <SelectItem value="todas">Todas</SelectItem>
                </SelectContent>
            </Select>

            <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Pilar</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Mensaje</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {alertas.data.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                                    No hay alertas.
                                </TableCell>
                            </TableRow>
                        )}
                        {alertas.data.map((alerta) => (
                            <TableRow key={alerta.id}>
                                <TableCell>{new Date(alerta.created_at).toLocaleString()}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{PILAR_LABELS[alerta.pilar] ?? alerta.pilar}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={alerta.atendida ? 'secondary' : 'destructive'}>{alerta.tipo_label}</Badge>
                                </TableCell>
                                <TableCell className="max-w-md">{alerta.mensaje}</TableCell>
                                <TableCell>{alerta.atendida ? 'Atendida' : 'Pendiente'}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        {!alerta.atendida && (
                                            <IconActionButton icon={Check} label="Marcar como atendida" onClick={() => atender(alerta)} />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => eliminar(alerta)}
                                            title="Eliminar alerta"
                                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {alertas.links.length > 3 && (
                <div className="flex flex-wrap gap-1">
                    {alertas.links.map((link, index) => (
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
    );
}
