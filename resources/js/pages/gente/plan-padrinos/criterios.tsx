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
    Calendar,
    CheckCircle2,
    Clock,
    Download,
    FileSpreadsheet,
    Filter,
    HeartHandshake,
    ListChecks,
    Plus,
    QrCode,
    Search,
    Shield,
    Sparkles,
    Trash2,
    Upload,
    UserCheck,
    Users,
    X,
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
    aci_realizadas: number;
    porcentaje_aci: number;
    porcentaje_owd_ruta: number | null;
    porcentaje_owd_ruta_label: string;
    safety_together: boolean;
    comunicacion_asertiva: boolean;
    habilidades: boolean;
    eventos_seguridad: boolean;
    columnas_extra_valores: Record<number, boolean>; // columna_id → valor
    criterio_evaluacion: CriterioEvaluacion | null;
}

interface ColumnaExtra {
    id: number;
    nombre: string;
    orden: number;
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
    mes: number;
    anio: number;
}

interface Props {
    colaboradores: ColaboradorOperativoRow[];
    metrics: Metrics;
    cargos: string[];
    filters: Filters;
    nivelesAutonomiaOpciones: string[];
    columnas_extra: ColumnaExtra[];
}

// Componente reutilizable para los toggles de indicadores
function ToggleBadge({
    activo,
    disabled,
    onClick,
}: {
    activo: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            title={disabled ? undefined : `Cambiar a ${activo ? '0%' : '100%'}`}
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold transition-all
                ${activo
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50'
                    : 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50'
                }
                ${disabled ? 'cursor-default' : 'cursor-pointer hover:scale-105 shadow-xs'}
            `}
        >
            {activo ? '100%' : '0%'}
        </button>
    );
}

export default function CriteriosPlanPadrinoIndex({
    colaboradores,
    metrics,
    cargos,
    filters,
    nivelesAutonomiaOpciones,
    columnas_extra,
}: Props) {
    const { auth } = usePage<SharedData>().props;
    const canManage = auth.isAdmin || auth.roles.includes('Gente');

    const [search, setSearch] = useState(filters.search || '');
    const [cargoFiltro, setCargoFiltro] = useState(filters.cargo || '');
    const [autonomiaFiltro, setAutonomiaFiltro] = useState(filters.autonomia || '');
    const [mes, setMes] = useState<number>(filters.mes || new Date().getMonth() + 1);
    const [anio, setAnio] = useState<number>(filters.anio || new Date().getFullYear());
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    // Estado modal Nueva Columna
    const [nuevaColumnaOpen, setNuevaColumnaOpen] = useState(false);
    const [nuevaColumnaNombre, setNuevaColumnaNombre] = useState('');

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
            { search: val, cargo: cargoFiltro, autonomia: autonomiaFiltro, mes, anio },
            { preserveState: true, replace: true }
        );
    };

    const handleCargoChange = (nuevoCargo: string) => {
        const val = nuevoCargo === 'todos' ? '' : nuevoCargo;
        setCargoFiltro(val);
        router.get(
            route('gente.plan-padrinos.criterios'),
            { search, cargo: val, autonomia: autonomiaFiltro, mes, anio },
            { preserveState: true, replace: true }
        );
    };

    const handleAutonomiaFilterChange = (nuevaAutonomia: string) => {
        const val = nuevaAutonomia === 'todas' ? '' : nuevaAutonomia;
        setAutonomiaFiltro(val);
        router.get(
            route('gente.plan-padrinos.criterios'),
            { search, cargo: cargoFiltro, autonomia: val, mes, anio },
            { preserveState: true, replace: true }
        );
    };

    const handleMesChange = (nuevoMes: string) => {
        const val = parseInt(nuevoMes, 10);
        setMes(val);
        router.get(
            route('gente.plan-padrinos.criterios'),
            { search, cargo: cargoFiltro, autonomia: autonomiaFiltro, mes: val, anio },
            { preserveState: true, replace: true }
        );
    };

    const handleAnioChange = (nuevoAnio: string) => {
        const val = parseInt(nuevoAnio, 10);
        setAnio(val);
        router.get(
            route('gente.plan-padrinos.criterios'),
            { search, cargo: cargoFiltro, autonomia: autonomiaFiltro, mes, anio: val },
            { preserveState: true, replace: true }
        );
    };

    const handleCrearColumnaExtra = (e: React.FormEvent) => {
        e.preventDefault();
        const nombre = nuevaColumnaNombre.trim();
        if (!nombre) return;
        router.post(
            route('gente.plan-padrinos.criterios.columna-extra.crear'),
            { nombre },
            {
                preserveScroll: true,
                onSuccess: () => { setNuevaColumnaOpen(false); setNuevaColumnaNombre(''); },
            }
        );
    };

    const handleEliminarColumnaExtra = (columnaId: number) => {
        if (!confirm('¿Eliminar esta columna permanentemente? Se perderán todos sus valores en todos los meses.')) return;
        router.delete(
            route('gente.plan-padrinos.criterios.columna-extra.eliminar', columnaId),
            { preserveScroll: true }
        );
    };

    const handleToggleColumnaExtra = (columnaId: number, colaboradorId: number) => {
        router.post(
            route('gente.plan-padrinos.criterios.columna-extra.toggle', columnaId),
            { colaborador_id: colaboradorId, mes, anio },
            { preserveScroll: true }
        );
    };

    const handleToggleIndicador = (colaboradorId: number, campo: string) => {
        router.post(
            route('gente.plan-padrinos.criterios.toggle-indicador'),
            { colaborador_id: colaboradorId, campo, mes, anio },
            { preserveScroll: true }
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
                            {/* Botón Nueva Columna */}
                            <Dialog open={nuevaColumnaOpen} onOpenChange={setNuevaColumnaOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="gap-2 font-semibold border-indigo-400 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-600 dark:text-indigo-300">
                                        <Plus className="h-4 w-4" />
                                        Nueva Columna
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-sm">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <Plus className="h-5 w-5 text-indigo-600" />
                                            Nueva Columna
                                        </DialogTitle>
                                        <DialogDescription>
                                            Ingresa el nombre de la nueva columna. Todos los colaboradores iniciarán en <strong>100%</strong>.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleCrearColumnaExtra} className="space-y-4 py-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="nombre_columna">Nombre de la columna</Label>
                                            <Input
                                                id="nombre_columna"
                                                placeholder="Ej: Puntualidad, Actitud, Liderazgo..."
                                                value={nuevaColumnaNombre}
                                                onChange={(e) => setNuevaColumnaNombre(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button type="button" variant="outline" onClick={() => setNuevaColumnaOpen(false)}>
                                                Cancelar
                                            </Button>
                                            <Button
                                                type="submit"
                                                disabled={!nuevaColumnaNombre.trim()}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Crear
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
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

                        {/* Selector de Mes */}
                        <Select value={String(mes)} onValueChange={handleMesChange}>
                            <SelectTrigger className="w-[130px] h-9 text-xs">
                                <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                            <SelectContent>
                                {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((label, i) => (
                                    <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Selector de Año */}
                        <Select value={String(anio)} onValueChange={handleAnioChange}>
                            <SelectTrigger className="w-[90px] h-9 text-xs">
                                <SelectValue placeholder="Año" />
                            </SelectTrigger>
                            <SelectContent>
                                {[2024, 2025, 2026, 2027].map((a) => (
                                    <SelectItem key={a} value={String(a)} className="text-xs">{a}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                                    <TableHead className="w-[160px] text-center font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                                        % ACI
                                    </TableHead>
                                    <TableHead className="w-[160px] text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-500/5">
                                        % OWD RUTA
                                    </TableHead>
                                    <TableHead className="w-[130px] text-center font-bold text-orange-700 dark:text-orange-400 bg-orange-500/5">
                                        SAFETY TOGETHER
                                    </TableHead>
                                    <TableHead className="w-[150px] text-center font-bold text-teal-700 dark:text-teal-400 bg-teal-500/5">
                                        COM. ASERTIVA
                                    </TableHead>
                                    <TableHead className="w-[130px] text-center font-bold text-violet-700 dark:text-violet-400 bg-violet-500/5">
                                        HABILIDADES
                                    </TableHead>
                                    <TableHead className="w-[140px] text-center font-bold text-rose-700 dark:text-rose-400 bg-rose-500/5">
                                        EVENTOS SEG.
                                    </TableHead>
                                    <TableHead className="w-[200px] text-center font-bold text-foreground">NIVEL DE AUTONOMÍA</TableHead>
                                    {columnas_extra.map((col) => (
                                        <TableHead key={col.id} className="w-[130px] text-center font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/5">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="truncate max-w-[90px]" title={col.nombre}>
                                                    {col.nombre.toUpperCase()}
                                                </span>
                                                {canManage && (
                                                    <button
                                                        type="button"
                                                        title="Eliminar columna"
                                                        onClick={() => handleEliminarColumnaExtra(col.id)}
                                                        className="ml-1 flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </TableHead>
                                    ))}
                                    <TableHead className="w-[150px] text-center font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/10">
                                        DESEMPEÑO
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {colaboradores.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11 + columnas_extra.length} className="h-32 text-center text-muted-foreground">
                                            No se encontraron colaboradores operativos activos que coincidan con los criterios de búsqueda.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    colaboradores.map((colaborador) => {
                                        const isUpdating = updatingId === colaborador.id;

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

                                                {/* % ACI */}
                                                <TableCell className="align-middle text-center bg-emerald-500/5">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-16 overflow-hidden rounded-full bg-muted h-2">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                                        colaborador.porcentaje_aci >= 100
                                                                            ? 'bg-emerald-500'
                                                                            : colaborador.porcentaje_aci >= 50
                                                                              ? 'bg-amber-500'
                                                                              : colaborador.porcentaje_aci > 0
                                                                                ? 'bg-blue-500'
                                                                                : 'bg-muted-foreground/30'
                                                                    }`}
                                                                    style={{ width: `${Math.min(100, colaborador.porcentaje_aci)}%` }}
                                                                />
                                                            </div>
                                                            <span className="font-bold text-sm text-foreground min-w-[40px]">
                                                                {colaborador.porcentaje_aci}%
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {colaborador.aci_realizadas} / 32 realizadas
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                {/* % OWD Ruta */}
                                                <TableCell className="align-middle text-center bg-blue-500/5">
                                                    {colaborador.porcentaje_owd_ruta !== null ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="w-16 overflow-hidden rounded-full bg-muted h-2">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                                        colaborador.porcentaje_owd_ruta >= 100
                                                                            ? 'bg-emerald-500'
                                                                            : colaborador.porcentaje_owd_ruta >= 50
                                                                              ? 'bg-amber-500'
                                                                              : 'bg-rose-500'
                                                                    }`}
                                                                    style={{ width: `${Math.min(100, colaborador.porcentaje_owd_ruta)}%` }}
                                                                />
                                                            </div>
                                                            <span className={`font-bold text-sm min-w-[40px] ${
                                                                colaborador.porcentaje_owd_ruta >= 100
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : colaborador.porcentaje_owd_ruta >= 50
                                                                      ? 'text-amber-600 dark:text-amber-400'
                                                                      : 'text-rose-600 dark:text-rose-400'
                                                            }`}>
                                                                {colaborador.porcentaje_owd_ruta_label}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground border-input">N/A</Badge>
                                                    )}
                                                </TableCell>

                                                {/* Safety Together */}
                                                <TableCell className="align-middle text-center bg-orange-500/5" onClick={(e) => e.stopPropagation()}>
                                                    <ToggleBadge
                                                        activo={colaborador.safety_together}
                                                        disabled={!canManage}
                                                        onClick={() => handleToggleIndicador(colaborador.id, 'safety_together')}
                                                    />
                                                </TableCell>

                                                {/* Comunicación Asertiva */}
                                                <TableCell className="align-middle text-center bg-teal-500/5" onClick={(e) => e.stopPropagation()}>
                                                    <ToggleBadge
                                                        activo={colaborador.comunicacion_asertiva}
                                                        disabled={!canManage}
                                                        onClick={() => handleToggleIndicador(colaborador.id, 'comunicacion_asertiva')}
                                                    />
                                                </TableCell>

                                                {/* Habilidades */}
                                                <TableCell className="align-middle text-center bg-violet-500/5" onClick={(e) => e.stopPropagation()}>
                                                    <ToggleBadge
                                                        activo={colaborador.habilidades}
                                                        disabled={!canManage}
                                                        onClick={() => handleToggleIndicador(colaborador.id, 'habilidades')}
                                                    />
                                                </TableCell>

                                                {/* Eventos de Seguridad */}
                                                <TableCell className="align-middle text-center bg-rose-500/5" onClick={(e) => e.stopPropagation()}>
                                                    <ToggleBadge
                                                        activo={colaborador.eventos_seguridad}
                                                        disabled={!canManage}
                                                        onClick={() => handleToggleIndicador(colaborador.id, 'eventos_seguridad')}
                                                    />
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

                                                {/* Columnas extra dinámicas */}
                                                {columnas_extra.map((col) => {
                                                    const val = colaborador.columnas_extra_valores[col.id] ?? true;
                                                    return (
                                                        <TableCell key={col.id} className="align-middle text-center bg-indigo-500/5" onClick={(e) => e.stopPropagation()}>
                                                            <ToggleBadge
                                                                activo={val}
                                                                disabled={!canManage}
                                                                onClick={() => handleToggleColumnaExtra(col.id, colaborador.id)}
                                                            />
                                                        </TableCell>
                                                    );
                                                })}

                                                {/* DESEMPEÑO — promedio de todas las columnas métricas */}
                                                {(() => {
                                                    const valores: number[] = [];
                                                    valores.push(Math.min(100, colaborador.porcentaje_aci));
                                                    if (colaborador.porcentaje_owd_ruta !== null) {
                                                        valores.push(colaborador.porcentaje_owd_ruta);
                                                    }
                                                    valores.push(colaborador.safety_together ? 100 : 0);
                                                    valores.push(colaborador.comunicacion_asertiva ? 100 : 0);
                                                    valores.push(colaborador.habilidades ? 100 : 0);
                                                    valores.push(colaborador.eventos_seguridad ? 100 : 0);
                                                    // Columnas extra
                                                    columnas_extra.forEach((col) => {
                                                        const val = colaborador.columnas_extra_valores[col.id] ?? true;
                                                        valores.push(val ? 100 : 0);
                                                    });

                                                    const desempeno = Math.round(
                                                        valores.reduce((a, b) => a + b, 0) / valores.length
                                                    );

                                                    const colorClass =
                                                        desempeno >= 80
                                                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-400/50'
                                                            : desempeno >= 60
                                                              ? 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 border-amber-400/50'
                                                              : 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30 border-rose-400/50';

                                                    return (
                                                        <TableCell className="align-middle text-center bg-indigo-500/10">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-extrabold ${colorClass}`}>
                                                                    {desempeno}%
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {valores.length} indicadores
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                    );
                                                })()}
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
