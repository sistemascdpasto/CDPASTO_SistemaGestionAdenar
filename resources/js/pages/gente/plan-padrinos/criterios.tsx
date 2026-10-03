import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Award,
    Calendar,
    CheckCircle2,
    Clock,
    Download,
    FileSpreadsheet,
    Filter,
    HeartHandshake,
    ListChecks,
    QrCode,
    Search,
    Shield,
    Sparkles,
    Trash2,
    Upload,
    UserCheck,
    Users,
} from 'lucide-react';
import { useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Plan Padrinos', href: '/modules/gente/plan-padrinos' },
    { title: 'Criterios', href: '/modules/gente/plan-padrinos/criterios' },
];

interface CriterioEvaluacion {
    qr_safety: string;
    funcional_7_dias: number | null;
    funcional_30_dias: number | null;
    funcional_90_dias: number | null;
    funcional_total: number | null;
    hab_tecnicas_1: number | null;
    hab_tecnicas_2: number | null;
    hab_tecnicas_3: number | null;
    habilidades_tecnicas_total: number | null;
    autonomia_1: number | null;
    autonomia_2: number | null;
    autonomia_3: number | null;
    autonomia_4: number | null;
    autonomia_total: number | null;
}

interface ColaboradorOperativoRow {
    id: number;
    cedula: string;
    codigo_qr_skap: string | null;
    nombre_completo: string;
    cargo: string;
    area: string;
    imagen: string | null;
    fecha_ingreso: string;
    antiguedad_texto: string;
    dias_en_empresa: number;
    nivel_autonomia: string;
    nivel_autonomia_db: string | null;
    autonomia_sugerida: string;
    es_personalizado: boolean;
    es_padrino: boolean;
    tipo_padrino: string | null;
    criterio_evaluacion: CriterioEvaluacion | null;
}

interface Metrics {
    total_operativos: number;
    autonomos: number;
    en_desarrollo: number;
    total_evaluados_excel: number;
}

interface Filters {
    search: string;
    cargo: string;
    autonomia: string;
}

interface Props {
    colaboradores: ColaboradorOperativoRow[];
    metrics: Metrics;
    cargos: string[];
    filters: Filters;
    nivelesAutonomiaOpciones: string[];
}

export default function CriteriosPlanPadrinoIndex({
    colaboradores,
    metrics,
    cargos,
    filters,
    nivelesAutonomiaOpciones,
}: Props) {
    const { auth } = usePage<SharedData>().props;
    const canManage = auth.isAdmin || auth.roles.includes('Gente');

    const [search, setSearch] = useState(filters.search || '');
    const [cargoFiltro, setCargoFiltro] = useState(filters.cargo || '');
    const [autonomiaFiltro, setAutonomiaFiltro] = useState(filters.autonomia || '');
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    // Modal importación Excel
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        router.get(
            route('gente.plan-padrinos.criterios'),
            { search: val, cargo: cargoFiltro, autonomia: autonomiaFiltro },
            { preserveState: true, replace: true }
        );
    };

    const handleCargoChange = (nuevoCargo: string) => {
        const val = nuevoCargo === 'todos' ? '' : nuevoCargo;
        setCargoFiltro(val);
        router.get(
            route('gente.plan-padrinos.criterios'),
            { search, cargo: val, autonomia: autonomiaFiltro },
            { preserveState: true, replace: true }
        );
    };

    const handleAutonomiaFilterChange = (nuevaAutonomia: string) => {
        const val = nuevaAutonomia === 'todas' ? '' : nuevaAutonomia;
        setAutonomiaFiltro(val);
        router.get(
            route('gente.plan-padrinos.criterios'),
            { search, cargo: cargoFiltro, autonomia: val },
            { preserveState: true, replace: true }
        );
    };

    const handleUpdateAutonomia = (colaboradorId: number, nuevoNivel: string) => {
        setUpdatingId(colaboradorId);
        router.post(
            route('gente.plan-padrinos.criterios.autonomia'),
            {
                colaborador_id: colaboradorId,
                nivel_autonomia: nuevoNivel,
            },
            {
                preserveScroll: true,
                onFinish: () => setUpdatingId(null),
            }
        );
    };

    const handleImportarSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) return;

        setImporting(true);
        const formData = new FormData();
        formData.append('archivo', selectedFile);

        router.post(route('gente.plan-padrinos.criterios.importar'), formData, {
            preserveScroll: true,
            onSuccess: () => {
                setImportDialogOpen(false);
                setSelectedFile(null);
            },
            onFinish: () => setImporting(false),
        });
    };

    const handleLimpiarCriterios = () => {
        if (!confirm('¿Deseas eliminar todas las evaluaciones importadas de la tabla Criterios?')) return;

        router.post(
            route('gente.plan-padrinos.criterios.limpiar'),
            {},
            { preserveScroll: true }
        );
    };

    const getBadgeStyle = (nivel: string) => {
        switch (nivel) {
            case 'Nivel 4':
            case 'Padrino':
                return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
            case 'Nivel 3':
                return 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30';
            case 'Nivel 2':
                return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
            case 'Nivel 1':
                return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30';
            case 'Nivel 0':
            default:
                return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Criterios y Nivel de Autonomía — Plan Padrino" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <HeadingSmall
                        title="Plan Padrino — Criterios y Nivel de Autonomía"
                        description="Visualización del personal operativo de la empresa, antigüedad en la empresa y gestión del Nivel de Autonomía cruzado con QR Safety."
                    />

                    {canManage && (
                        <div className="flex items-center gap-2 shrink-0">
                            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold">
                                        <FileSpreadsheet className="h-4 w-4" />
                                        Importar Excel
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                                            Importar Criterios y Autonomía (Excel)
                                        </DialogTitle>
                                        <DialogDescription>
                                            Sube el archivo Excel con las evaluaciones cruzando por el campo{' '}
                                            <strong className="text-foreground">QR Safety</strong>.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <form onSubmit={handleImportarSubmit} className="space-y-4 py-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="archivo_excel">Seleccionar Archivo (.xlsx, .xls, .csv)</Label>
                                            <Input
                                                id="archivo_excel"
                                                type="file"
                                                ref={fileInputRef}
                                                accept=".xlsx,.xls,.csv"
                                                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Columnas soportadas: QR Safety, Nombre, Funcional 7 días, Funcional 30 días, Funcional 90 días, Funcional, Hab. técnicas 1, 2, 3, Habilidades Técnicas, Autonomía 1, 2, 3, 4, Autonomía.
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between border-t pt-3">
                                            <a
                                                href={route('gente.plan-padrinos.criterios.plantilla')}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                                Descargar Plantilla CSV
                                            </a>
                                        </div>

                                        <DialogFooter className="mt-4">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setImportDialogOpen(false)}
                                                disabled={importing}
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                type="submit"
                                                disabled={!selectedFile || importing}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold"
                                            >
                                                {importing ? (
                                                    <>
                                                        <Upload className="h-4 w-4 animate-bounce" />
                                                        Importando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="h-4 w-4" />
                                                        Cargar Datos
                                                    </>
                                                )}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>

                            {metrics.total_evaluados_excel > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={handleLimpiarCriterios}
                                    className="text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5 text-xs"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Limpiar Excel
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Navegación por pestañas del submódulo */}
                <div className="flex items-center gap-2 border-b pb-2">
                    <Link
                        href="/modules/gente/plan-padrinos"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <HeartHandshake className="h-4 w-4" />
                        Seguimiento de Pruebas (7, 30, 90 días)
                    </Link>
                    <Link
                        href="/modules/gente/plan-padrinos/criterios"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground shadow-xs"
                    >
                        <ListChecks className="h-4 w-4" />
                        Criterios y Nivel de Autonomía
                    </Link>
                </div>

                {/* Tarjetas de Resumen Superior */}
                <div className="grid gap-4 md:grid-cols-4">
                    {/* Card Total Operativos */}
                    <Card className="border-l-4 border-l-blue-500 shadow-sm transition-all hover:shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                                Personal Operativo
                            </CardTitle>
                            <Users className="h-5 w-5 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-300">
                                {metrics.total_operativos}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">colaboradores activos área Operativa</p>
                        </CardContent>
                    </Card>

                    {/* Card Evaluados Excel */}
                    <Card className="border-l-4 border-l-purple-500 shadow-sm transition-all hover:shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-purple-700 dark:text-purple-400">
                                Evaluados por Excel
                            </CardTitle>
                            <FileSpreadsheet className="h-5 w-5 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-300">
                                {metrics.total_evaluados_excel}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">cruzados por QR Safety</p>
                        </CardContent>
                    </Card>

                    {/* Card Autónomos / Alto Nivel */}
                    <Card className="border-l-4 border-l-emerald-500 shadow-sm transition-all hover:shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                Nivel Alto / Autónomo
                            </CardTitle>
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-300">
                                {metrics.autonomos}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">desempeño autónomo consolidado</p>
                        </CardContent>
                    </Card>

                    {/* Card En Desarrollo */}
                    <Card className="border-l-4 border-l-amber-500 shadow-sm transition-all hover:shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                                En Acompañamiento
                            </CardTitle>
                            <Clock className="h-5 w-5 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-300">
                                {metrics.en_desarrollo}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">etapas iniciales o supervisión cercana</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filtros y Búsqueda */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-xl border shadow-sm">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Buscar por operativo, cédula, QR Safety o cargo..."
                            value={search}
                            onChange={handleSearchChange}
                            className="pl-9"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Filtro por Cargo */}
                        <div className="flex items-center gap-1.5">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select value={cargoFiltro || 'todos'} onValueChange={handleCargoChange}>
                                <SelectTrigger className="w-[180px] h-9 text-xs">
                                    <SelectValue placeholder="Todos los cargos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos los cargos</SelectItem>
                                    {cargos.map((cg) => (
                                        <SelectItem key={cg} value={cg}>
                                            {cg}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Filtro por Autonomía */}
                        <div className="flex items-center gap-1.5">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <Select value={autonomiaFiltro || 'todas'} onValueChange={handleAutonomiaFilterChange}>
                                <SelectTrigger className="w-[180px] h-9 text-xs">
                                    <SelectValue placeholder="Todas las autonomías" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">Todas las autonomías</SelectItem>
                                    {nivelesAutonomiaOpciones.map((niv) => (
                                        <SelectItem key={niv} value={niv}>
                                            {niv}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Tabla de Criterios Plan Padrino */}
                <Card className="shadow-sm overflow-hidden border">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[280px] font-bold text-foreground">COLABORADOR OPERATIVO</TableHead>
                                    <TableHead className="w-[140px] font-bold text-foreground">FECHA INGRESO</TableHead>
                                    <TableHead className="w-[180px] font-bold text-foreground">ANTIGÜEDAD</TableHead>
                                    <TableHead className="w-[130px] text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-500/5">
                                        FUNCIONAL
                                    </TableHead>
                                    <TableHead className="w-[150px] text-center font-bold text-purple-700 dark:text-purple-400 bg-purple-500/5">
                                        HAB. TÉCNICAS
                                    </TableHead>
                                    <TableHead className="w-[130px] text-center font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                                        AUTONOMÍA %
                                    </TableHead>
                                    <TableHead className="w-[200px] text-center font-bold text-foreground">NIVEL DE AUTONOMÍA</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {colaboradores.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No se encontraron colaboradores operativos activos que coincidan con los criterios de búsqueda.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    colaboradores.map((colaborador) => {
                                        const isUpdating = updatingId === colaborador.id;
                                        const crit = colaborador.criterio_evaluacion;

                                        return (
                                            <TableRow key={colaborador.id} className="hover:bg-muted/30">
                                                {/* Fotografía y Nombre */}
                                                <TableCell className="align-middle py-3">
                                                    <div className="flex items-center gap-3">
                                                        {colaborador.imagen ? (
                                                            <img
                                                                src={`/storage/${colaborador.imagen}`}
                                                                alt={colaborador.nombre_completo}
                                                                className="h-11 w-11 rounded-full object-cover border border-border/60 shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted border border-border/60">
                                                                <UserCheck className="h-5 w-5 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-sm font-bold text-foreground">
                                                                    {colaborador.nombre_completo}
                                                                </span>
                                                                {colaborador.es_padrino && (
                                                                    <Badge className="bg-purple-600 text-white text-[9px] px-1 py-0 font-semibold">
                                                                        ★ Padrino
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                                                <Badge variant="outline" className="font-medium text-[11px] py-0">
                                                                    {colaborador.cargo}
                                                                </Badge>
                                                                {colaborador.codigo_qr_skap && (
                                                                    <span className="flex items-center gap-0.5 text-[11px] font-mono text-purple-700 dark:text-purple-400 bg-purple-500/10 px-1 rounded">
                                                                        <QrCode className="h-3 w-3" />
                                                                        {colaborador.codigo_qr_skap}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Fecha de Ingreso */}
                                                <TableCell className="align-middle text-xs font-medium">
                                                    <div className="flex items-center gap-1.5 text-foreground">
                                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                        <span>{colaborador.fecha_ingreso}</span>
                                                    </div>
                                                </TableCell>

                                                {/* Antigüedad de Cargo / Empresa */}
                                                <TableCell className="align-middle">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-bold text-foreground">
                                                            {colaborador.antiguedad_texto}
                                                        </span>
                                                        <span className="text-[11px] text-muted-foreground">
                                                            ({colaborador.dias_en_empresa} {colaborador.dias_en_empresa === 1 ? 'día' : 'días'})
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                {/* Funcional (%) */}
                                                <TableCell className="align-middle text-center bg-blue-500/5">
                                                    {crit?.funcional_total !== null && crit?.funcional_total !== undefined ? (
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className="text-sm font-extrabold text-blue-700 dark:text-blue-300">
                                                                {crit.funcional_total}%
                                                            </span>
                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                {crit.funcional_7_dias !== null && <span>7d: {crit.funcional_7_dias}%</span>}
                                                                {crit.funcional_30_dias !== null && <span>30d: {crit.funcional_30_dias}%</span>}
                                                                {crit.funcional_90_dias !== null && <span>90d: {crit.funcional_90_dias}%</span>}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/50">—</span>
                                                    )}
                                                </TableCell>

                                                {/* Habilidades Técnicas (%) */}
                                                <TableCell className="align-middle text-center bg-purple-500/5">
                                                    {crit?.habilidades_tecnicas_total !== null && crit?.habilidades_tecnicas_total !== undefined ? (
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className="text-sm font-extrabold text-purple-700 dark:text-purple-300">
                                                                {crit.habilidades_tecnicas_total}%
                                                            </span>
                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                {crit.hab_tecnicas_1 !== null && <span>H1: {crit.hab_tecnicas_1}%</span>}
                                                                {crit.hab_tecnicas_2 !== null && <span>H2: {crit.hab_tecnicas_2}%</span>}
                                                                {crit.hab_tecnicas_3 !== null && <span>H3: {crit.hab_tecnicas_3}%</span>}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/50">—</span>
                                                    )}
                                                </TableCell>

                                                {/* Autonomía (%) */}
                                                <TableCell className="align-middle text-center bg-emerald-500/5">
                                                    {crit?.autonomia_total !== null && crit?.autonomia_total !== undefined ? (
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                                                                {crit.autonomia_total}%
                                                            </span>
                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                {crit.autonomia_1 !== null && <span>A1: {crit.autonomia_1}%</span>}
                                                                {crit.autonomia_2 !== null && <span>A2: {crit.autonomia_2}%</span>}
                                                                {crit.autonomia_3 !== null && <span>A3: {crit.autonomia_3}%</span>}
                                                                {crit.autonomia_4 !== null && <span>A4: {crit.autonomia_4}%</span>}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/50">—</span>
                                                    )}
                                                </TableCell>

                                                {/* Nivel de Autonomía (Select e indicador) */}
                                                <TableCell className="align-middle text-center">
                                                    <div className="flex flex-col items-center gap-1 justify-center">
                                                        <Select
                                                            disabled={isUpdating || !canManage}
                                                            value={colaborador.nivel_autonomia}
                                                            onValueChange={(val) => handleUpdateAutonomia(colaborador.id, val)}
                                                        >
                                                            <SelectTrigger className={`w-[170px] h-8 font-semibold text-xs border ${getBadgeStyle(colaborador.nivel_autonomia)}`}>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {nivelesAutonomiaOpciones.map((opcion) => (
                                                                    <SelectItem key={opcion} value={opcion} className="text-xs">
                                                                        {opcion}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>

                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                            {colaborador.es_personalizado ? (
                                                                <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                                                                    <Sparkles className="h-3 w-3" />
                                                                    Modificado
                                                                </span>
                                                            ) : (
                                                                <span>Sugerido ({colaborador.autonomia_sugerida})</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}
