import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { BookOpen, Download, GraduationCap, Percent, Search, Trash2, Upload, Users } from 'lucide-react';
import { useState } from 'react';
import { ImportarCalificacionesDialog } from './importar-dialog';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Calificaciones', href: '/modules/gente/calificaciones' },
];

interface CalificacionRow {
    id: number;
    colaborador_id: number | null;
    identificacion: string;
    colaborador: string | null;
    cargo: string | null;
    centro_distribucion: string | null;
    modulo_id_externo: string | null;
    modulo: string;
    nota_modulo: number | string | null;
    created_at: string;
}

interface Resumen {
    total_registros: number;
    total_colaboradores: number;
    total_modulos: number;
    promedio_nota: number;
}

interface Catalogos {
    modulos: string[];
    centros_distribucion: string[];
    cargos: string[];
}

interface Filters {
    search: string;
    modulo: string;
    centro_distribucion: string;
    cargo: string;
}

interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface Props {
    calificaciones: PaginatedData<CalificacionRow>;
    resumen: Resumen;
    catalogos: Catalogos;
    filtros: Filters;
}

export default function CalificacionesIndex({ calificaciones, resumen, catalogos, filtros }: Props) {
    const [search, setSearch] = useState(filtros.search || '');
    const [modulo, setModulo] = useState(filtros.modulo || 'todos');
    const [centro, setCentro] = useState(filtros.centro_distribucion || 'todos');
    const [cargo, setCargo] = useState(filtros.cargo || 'todos');

    const handleFilter = (
        newSearch = search,
        newModulo = modulo,
        newCentro = centro,
        newCargo = cargo,
    ) => {
        router.get(
            '/modules/gente/calificaciones',
            {
                search: newSearch,
                modulo: newModulo === 'todos' ? '' : newModulo,
                centro_distribucion: newCentro === 'todos' ? '' : newCentro,
                cargo: newCargo === 'todos' ? '' : newCargo,
            },
            { preserveState: true, replace: true },
        );
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        handleFilter(val, modulo, centro, cargo);
    };

    const handleModuloChange = (val: string) => {
        setModulo(val);
        handleFilter(search, val, centro, cargo);
    };

    const handleCentroChange = (val: string) => {
        setCentro(val);
        handleFilter(search, modulo, val, cargo);
    };

    const handleCargoChange = (val: string) => {
        setCargo(val);
        handleFilter(search, modulo, centro, val);
    };

    const handleLimpiar = () => {
        if (confirm('¿Estás seguro de que deseas eliminar todas las calificaciones importadas?')) {
            router.post('/modules/gente/calificaciones/limpiar');
        }
    };

    const exportUrl = `/modules/gente/calificaciones/exportar?modulo=${modulo === 'todos' ? '' : modulo}&centro_distribucion=${centro === 'todos' ? '' : centro}&cargo=${cargo === 'todos' ? '' : cargo}`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Calificaciones de Módulos - Gente" />

            <div className="space-y-6 p-6">
                {/* Header Banner */}
                <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 shadow-sm dark:border-amber-900/50 dark:from-amber-950/20">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <GraduationCap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                    Calificaciones de Módulos
                                </h1>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Registro, carga masiva desde Excel y consulta de notas obtenidas por colaboradores en cada módulo.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <ImportarCalificacionesDialog
                                trigger={
                                    <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                                        <Upload className="mr-2 h-4 w-4" />
                                        Importar Excel
                                    </Button>
                                }
                            />
                            <Button asChild variant="outline">
                                <a href={exportUrl} target="_blank" rel="noopener noreferrer">
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar CSV
                                </a>
                            </Button>
                            {resumen.total_registros > 0 && (
                                <Button variant="ghost" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={handleLimpiar}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* KPI Resumen Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Total Registros</CardTitle>
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{resumen.total_registros}</div>
                            <p className="text-xs text-muted-foreground">Calificaciones registradas</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Colaboradores Evaluados</CardTitle>
                            <Users className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{resumen.total_colaboradores}</div>
                            <p className="text-xs text-muted-foreground">Colaboradores únicos</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Total Módulos</CardTitle>
                            <GraduationCap className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{resumen.total_modulos}</div>
                            <p className="text-xs text-muted-foreground">Módulos evaluados</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Promedio General Nota</CardTitle>
                            <Percent className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{resumen.promedio_nota}</div>
                            <p className="text-xs text-muted-foreground">Promedio de nota acumulado</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filtros */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold">Filtros y Búsqueda</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Buscar</label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Nombre, cédula, módulo..."
                                        value={search}
                                        onChange={handleSearchChange}
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Módulo</label>
                                <Select value={modulo} onValueChange={handleModuloChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos los Módulos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los Módulos</SelectItem>
                                        {catalogos.modulos.map((m) => (
                                            <SelectItem key={m} value={m}>
                                                {m}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Centro Distribución</label>
                                <Select value={centro} onValueChange={handleCentroChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos los Centros" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los Centros</SelectItem>
                                        {catalogos.centros_distribucion.map((c) => (
                                            <SelectItem key={c} value={c}>
                                                {c}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Cargo</label>
                                <Select value={cargo} onValueChange={handleCargoChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos los Cargos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los Cargos</SelectItem>
                                        {catalogos.cargos.map((cg) => (
                                            <SelectItem key={cg} value={cg}>
                                                {cg}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabla de Calificaciones */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">
                            Registros ({calificaciones.total})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Colaborador</TableHead>
                                        <TableHead>Cargo</TableHead>
                                        <TableHead>Centro Distribución</TableHead>
                                        <TableHead>ID Módulo</TableHead>
                                        <TableHead>Módulo</TableHead>
                                        <TableHead className="text-right">Nota Módulo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {calificaciones.data.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                                                No se encontraron calificaciones con los filtros seleccionados.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        calificaciones.data.map((row) => {
                                            const notaNum = row.nota_modulo !== null ? Number(row.nota_modulo) : null;
                                            return (
                                                <TableRow key={row.id}>
                                                    <TableCell>
                                                        <div>
                                                            <div className="font-semibold text-foreground">
                                                                {row.colaborador ?? 'Sin nombre'}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">C.C. {row.identificacion}</div>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-foreground text-xs font-medium">
                                                        {row.cargo ?? '-'}
                                                    </TableCell>

                                                    <TableCell className="text-muted-foreground text-xs">
                                                        {row.centro_distribucion ?? '-'}
                                                    </TableCell>

                                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                                        {row.modulo_id_externo ?? '-'}
                                                    </TableCell>

                                                    <TableCell className="font-medium text-foreground text-xs">
                                                        {row.modulo}
                                                    </TableCell>

                                                    <TableCell className="text-right font-bold">
                                                        {notaNum !== null ? (
                                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                                                                notaNum >= 80 || notaNum >= 8.0 || notaNum >= 4.0
                                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                                    : notaNum >= 60 || notaNum >= 6.0 || notaNum >= 3.0
                                                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                                            }`}>
                                                                {row.nota_modulo}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs font-normal">S/N</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Paginación */}
                        {calificaciones.last_page > 1 && (
                            <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
                                <span className="text-xs text-muted-foreground">
                                    Página {calificaciones.current_page} de {calificaciones.last_page}
                                </span>
                                <div className="flex items-center gap-2">
                                    {calificaciones.prev_page_url && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => router.get(calificaciones.prev_page_url!, {}, { preserveState: true })}
                                        >
                                            Anterior
                                        </Button>
                                    )}
                                    {calificaciones.next_page_url && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => router.get(calificaciones.next_page_url!, {}, { preserveState: true })}
                                        >
                                            Siguiente
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
