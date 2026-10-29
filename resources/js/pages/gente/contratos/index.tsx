import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { CalendarPlus, Eye, FileDown, FileStack, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { ProrrogarContratoDialog } from '@/pages/gente/colaboradores/prorrogar-contrato-dialog';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Contratos', href: '/modules/gente/contratos' },
];

interface ContratoRow {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
    cargo: string | null;
    tipo_contrato: string | null;
    fecha_ingreso_empresa: string | null;
    fecha_retiro_empresa: string | null;
    is_active: boolean;
    tiene_finalizacion?: boolean;
}

interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface Filters {
    search: string;
    estado: string;
}

interface Props {
    colaboradores: PaginatedData<ContratoRow>;
    filters: Filters;
}

function formatFecha(fecha: string | null): string {
    if (!fecha) return '—';
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
}

function estadoContrato(
    fechaRetiro: string | null,
    isActive = true,
    tieneFinalizacion = false,
): { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } {
    if (tieneFinalizacion || !isActive) {
        return { label: 'Finalizado', variant: 'secondary' };
    }
    if (!fechaRetiro) return { label: 'Sin fecha fin', variant: 'secondary' };
    const hoy = new Date();
    const retiro = new Date(fechaRetiro);
    const diasRestantes = Math.ceil((retiro.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (diasRestantes < 0) return { label: 'Vencido', variant: 'destructive' };
    if (diasRestantes <= 30) return { label: `Vence en ${diasRestantes}d`, variant: 'outline' };
    return { label: 'Vigente', variant: 'default' };
}

export default function ContratosIndex({ colaboradores, filters }: Props) {
    const [search, setSearch] = useState(filters?.search || '');
    const [estado, setEstado] = useState(filters?.estado || 'todos');

    const rows = colaboradores?.data || [];

    const handleFilter = (newSearch = search, newEstado = estado) => {
        router.get(
            '/modules/gente/contratos',
            {
                search: newSearch,
                estado: newEstado === 'todos' ? '' : newEstado,
            },
            { preserveState: true, replace: true },
        );
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        handleFilter(val, estado);
    };

    const handleEstadoChange = (val: string) => {
        setEstado(val);
        handleFilter(search, val);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Contratos - Módulo Gente" />

            <div className="space-y-6 p-6">
                {/* Header Banner */}
                <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 shadow-sm dark:border-amber-900/50 dark:from-amber-950/20">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <FileStack className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">Contratos</h1>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Consulta las fechas de inicio y finalización de contrato de cada colaborador.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>{colaboradores?.total ?? 0} colaboradores</span>
                        </div>
                    </div>
                </div>

                {/* Filtros + Tabla */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold">Lista de contratos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Filtros */}
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Buscar por nombre o cédula..."
                                    value={search}
                                    onChange={handleSearchChange}
                                    className="pl-9"
                                />
                            </div>
                            <Select value={estado} onValueChange={handleEstadoChange}>
                                <SelectTrigger className="w-full sm:w-48">
                                    <SelectValue placeholder="Estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="activo">Activos</SelectItem>
                                    <SelectItem value="inactivo">Inactivos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Tabla */}
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Cédula</TableHead>
                                        <TableHead>Tipo de contrato</TableHead>
                                        <TableHead>Fecha inicio de contrato</TableHead>
                                        <TableHead>Fecha finalización de contrato</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                                                No se encontraron colaboradores.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        rows.map((row) => {
                                            const { label, variant } = estadoContrato(
                                                row.fecha_retiro_empresa,
                                                row.is_active,
                                                Boolean(row.tiene_finalizacion),
                                            );
                                            return (
                                                <TableRow key={row.id}>
                                                    <TableCell className="font-medium">
                                                        {row.nombres} {row.apellidos}
                                                        {row.cargo && (
                                                            <p className="text-xs text-muted-foreground">{row.cargo}</p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm">{row.cedula}</TableCell>
                                                    <TableCell className="text-sm">{row.tipo_contrato ?? '—'}</TableCell>
                                                    <TableCell className="text-sm">{formatFecha(row.fecha_ingreso_empresa)}</TableCell>
                                                    <TableCell className="text-sm">{formatFecha(row.fecha_retiro_empresa)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={variant}>{label}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1.5">
                                                            <Button variant="outline" size="sm" asChild>
                                                                <Link href={`/modules/gente/contratos/${row.id}`}>
                                                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                                                    Ver
                                                                </Link>
                                                            </Button>
                                                            <ProrrogarContratoDialog
                                                                colaboradorId={row.id}
                                                                nombreCompleto={`${row.nombres} ${row.apellidos}`}
                                                                fechaActual={row.fecha_retiro_empresa}
                                                                trigger={
                                                                    <Button variant="outline" size="sm">
                                                                        <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                                                                        Prorrogar
                                                                    </Button>
                                                                }
                                                            />
                                                            <Button variant="outline" size="sm" asChild>
                                                                <a
                                                                    href={`/modules/gente/contratos/${row.id}/prorroga-pdf${row.fecha_retiro_empresa ? `?fecha=${row.fecha_retiro_empresa}` : ''}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    <FileDown className="mr-1.5 h-3.5 w-3.5" />
                                                                    PDF
                                                                </a>
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Paginación */}
                        {(colaboradores?.prev_page_url || colaboradores?.next_page_url) && (
                            <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                                <span>
                                    Página {colaboradores.current_page} de {colaboradores.last_page}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!colaboradores.prev_page_url}
                                        onClick={() =>
                                            colaboradores.prev_page_url &&
                                            router.get(colaboradores.prev_page_url, {}, { preserveState: true })
                                        }
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!colaboradores.next_page_url}
                                        onClick={() =>
                                            colaboradores.next_page_url &&
                                            router.get(colaboradores.next_page_url, {}, { preserveState: true })
                                        }
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
