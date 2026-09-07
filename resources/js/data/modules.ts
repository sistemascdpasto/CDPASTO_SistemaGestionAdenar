import {
    Activity,
    AlertTriangle,
    BadgeCheck,
    Ban,
    BarChart3,
    BellRing,
    BookOpen,
    CalendarDays,
    Car,
    ClipboardCheck,
    ClipboardList,
    Clock,
    Cpu,
    DollarSign,
    FileSpreadsheet,
    FileStack,
    Folder,
    Fuel,
    Gauge,
    Gavel,
    GraduationCap,
    Grid3x3,
    HeartHandshake,
    HeartPulse,
    ListChecks,
    ListTodo,
    Map,
    MapPin,
    Megaphone,
    QrCode,
    ShieldCheck,
    Star,
    Stethoscope,
    TestTube,
    Timer,
    Trophy,
    Truck,
    UserCheck,
    Users,
    Wine,
    Wrench,
    type LucideIcon,
} from 'lucide-react';

export interface SubModuleDef {
    title: string;
    /** Presente en los ítems "hoja" (tienen su propia página). Ausente en los ítems que solo agrupan otros submódulos. */
    slug?: string;
    icon: LucideIcon;
    /** Presente en los ítems que agrupan otros submódulos (se despliegan en el sidebar en vez de navegar). */
    submodules?: SubModuleDef[];
    /**
     * Para ítems inyectados dinámicamente dentro de la sección de OTRO rol
     * (ej. el enlace de solo lectura a Colaboradores que se agrega a la
     * sección de Seguridad/Reparto/Flota — ver `colaboradoresReadOnlySubmodule`
     * y app-sidebar.tsx). Si se omite, la URL usa el slug del módulo padre
     * como de costumbre.
     */
    moduleSlugOverride?: string;
    /**
     * URL absoluta a usar en el sidebar en vez de la ruta calculada
     * `/modules/<slug>/<sub-slug>` (para submódulos que viven en su propia
     * ruta fuera del prefijo del módulo, ej. `/cinco-porques`).
     */
    href?: string;
    /**
     * Lista de roles que pueden ver este submódulo en el sidebar.
     * Si se omite, el ítem es visible para todos los usuarios con acceso
     * al módulo padre. 'Administrador' siempre tiene acceso independientemente
     * de este campo (se controla en app-sidebar.tsx).
     */
    allowedRoles?: string[];
}

export interface ModuleDef {
    title: string;
    slug: string;
    icon: LucideIcon;
    /** Brand accent used sparingly to tell pillars apart across sidebar, dashboard and module pages. */
    accent: string;
    submodules: SubModuleDef[];
}

export const modules: ModuleDef[] = [
    {
        title: 'Seguridad',
        slug: 'seguridad',
        icon: ShieldCheck,
        accent: '#3F7A22',
        submodules: [
            {
                title: 'Alcoholimetría',
                icon: Wine,
                submodules: [
                    { title: 'Dispositivos', slug: 'dispositivos', icon: Cpu },
                    { title: 'Pruebas de Alcoholemia', slug: 'pruebas', icon: TestTube },
                ],
            },
            { title: 'Asignaciones de conductores', slug: 'asignaciones-conductores', icon: Truck },
            { title: 'Condiciones de Salud', slug: 'condiciones-salud', icon: HeartPulse },
            { title: 'Indicador', slug: 'indicador', icon: Activity },
            { title: 'Alertas', slug: 'alertas', icon: BellRing },
            {
                title: 'ACIS',
                icon: ShieldCheck,
                submodules: [
                    { title: 'Reportes ACI', slug: 'acis', icon: ClipboardList },
                    { title: 'Indicadores', slug: 'acis-indicadores', icon: BarChart3 },
                    { title: 'Consultar QR SKAP', slug: 'acis-consultar-qr', icon: QrCode },
                ],
            },
            {
                title: 'Evaluaciones OWD',
                icon: ClipboardCheck,
                submodules: [
                    { title: 'Evaluaciones', slug: 'evaluaciones-owd', icon: ClipboardList },
                    { title: 'Indicadores', slug: 'evaluaciones-owd-indicadores', icon: BarChart3 },
                    { title: 'Incumplimientos', slug: 'evaluaciones-owd-incumplimientos', icon: AlertTriangle },
                    { title: 'Planes de Acción', slug: 'planes-accion-owd', icon: ListTodo },
                    { title: 'Historial de Cargas', slug: 'evaluaciones-owd-importaciones', icon: FileStack },
                ],
            },
            {
                title: 'Exámenes Médicos',
                icon: Stethoscope,
                submodules: [
                    { title: 'Bandeja', slug: 'examenes-medicos', icon: ListChecks },
                    { title: 'Indicadores', slug: 'examenes-medicos-indicadores', icon: BarChart3 },
                    { title: 'Catálogo de exámenes', slug: 'examenes-medicos-catalogo', icon: FileStack },
                    { title: 'Matriz Cargo-Examen', slug: 'examenes-medicos-matriz', icon: Grid3x3 },
                    { title: 'Conceptos de aptitud', slug: 'examenes-medicos-conceptos', icon: BadgeCheck },
                    { title: 'Catálogo de recomendaciones', slug: 'examenes-medicos-recomendaciones', icon: ListTodo },
                ],
            },
            {
                title: 'Encuestas de Morbilidad',
                icon: Stethoscope,
                submodules: [
                    { title: 'Respuestas', slug: 'encuestas-morbilidad', icon: ClipboardList },
                    { title: 'Catálogo de Preguntas', slug: 'encuestas-morbilidad-preguntas', icon: ListChecks },
                ],
            },
            { title: 'Jornada Laboral', slug: 'jornada-laboral', icon: Timer },
            { title: 'Excesos en Curvas', slug: 'excesos-en-curvas', icon: AlertTriangle },

            { title: 'Glosario', slug: 'glosario', icon: BookOpen },

            { title: 'Mapa de Rutas Críticas', slug: 'rutas-criticas', icon: Map },
        ],
    },
    {
        title: 'Reparto',
        slug: 'reparto',
        icon: Truck,
        accent: '#D4102A',
        submodules: [
            { title: 'Calificaciones Negativas', slug: 'calificaciones-negativas', icon: Star },
            { title: 'Entrega en Rango', slug: 'entrega-en-rango', icon: MapPin },
            { title: 'Planeación de ruta', slug: 'modulacion', icon: BarChart3 },
            { title: 'Historial de Planeaciones', slug: 'modulacion-historial', icon: FileStack },
            { title: 'Eventos de Tripulación', slug: 'eventos-tripulacion', icon: Users },
            { title: 'Indicadores de Velocidad', slug: 'indicadores', icon: Map },
            { title: 'Indicadores de Adherencia', slug: 'indicadores-adherencia', icon: ClipboardCheck },
            { title: 'Adherencia al Tiempo', slug: 'indicadores-tiempo', icon: Clock },
            { title: 'Entrega en Rango Ind.', slug: 'indicadores-entrega-rango', icon: Activity },
            { title: 'Resumen Ejecutivo', slug: 'indicadores-resumen', icon: BarChart3 },
            { title: 'Compensación Variable', slug: 'compensacion-variable', icon: DollarSign, allowedRoles: ['Administrador', 'Colaborador'] },
            { title: 'Compensación Variable Diaria', slug: 'compensacion-variable-diaria', icon: CalendarDays },
            { title: '5 Por Qué', slug: 'cinco-porques', href: '/cinco-porques', icon: ListChecks },
        ],
    },
    {
        title: 'Gente',
        slug: 'gente',
        icon: Users,
        accent: '#E3A11E',
        submodules: [
            { title: 'Colaboradores', slug: 'colaboradores', icon: UserCheck },
            { title: 'Corrección de Marcaciones', slug: 'correccion-marcaciones', icon: FileSpreadsheet },
            { title: 'Malas Marcaciones', slug: 'malas-marcaciones', icon: Ban },
            { title: 'Inducciones', slug: 'inducciones', icon: Megaphone },
            { title: 'Seguimiento Pruebas y Plan Padrinos', slug: 'plan-padrinos', icon: HeartHandshake },
            { title: 'Plan Premiación', slug: 'plan-premiacion', icon: Trophy },
            { title: 'Calificaciones', slug: 'calificaciones', icon: GraduationCap },
            { title: 'DPO Academy', slug: 'dpo-academy', icon: BookOpen },
            { title: 'Ausentismo', slug: 'ausentismo', icon: CalendarDays },
            { title: 'SAC', slug: 'sac', icon: FileSpreadsheet },
            { title: 'Asistencia GeoVictoria', slug: 'asistencia-geovictoria', icon: Clock },
        ],
    },
    {
        title: 'Flota',
        slug: 'flota',
        icon: Car,
        accent: '#2B6CB0',
        submodules: [
            { title: 'Documentación', slug: 'vehiculos', icon: Truck },
            { title: 'Checklist', slug: 'checklist', icon: ClipboardCheck },
            { title: 'Combustible', slug: 'combustible', icon: Fuel },
            { title: 'Calibración de Llantas', slug: 'calibracion-llantas', icon: Gauge },
            { title: 'Consultas SIMIT', slug: 'simit-consultas', icon: Gavel },
            { title: 'Control de Varadas', slug: 'varadas', icon: Wrench },
            { title: 'Actas de Taller', slug: 'actas-taller', icon: ClipboardList },
        ],
    },
    {
        title: 'Capacitaciones',
        slug: 'capacitaciones',
        icon: GraduationCap,
        accent: '#0D9488',
        submodules: [{ title: 'Materiales y Carpetas', slug: '', icon: Folder }],
    },
];

/**
 * Entrada de "Colaboradores" que app-sidebar.tsx inyecta como submódulo de
 * solo lectura dentro de la sección propia de Seguridad, Reparto o Flota
 * (los roles que no son dueños del módulo pero conservan acceso de solo
 * lectura). La entrada "real", con permisos de escritura, vive en
 * `modules` bajo Gente.submodules.
 */
export const colaboradoresReadOnlySubmodule: SubModuleDef = {
    title: 'Colaboradores',
    slug: 'colaboradores',
    icon: UserCheck,
    moduleSlugOverride: 'gente',
};

/**
 * Entrada de "Asistencia GeoVictoria" que app-sidebar.tsx inyecta como
 * submódulo de solo lectura dentro de la sección de Reparto (la ruta real
 * vive bajo Gente, ver routes/gente.php: role Administrador|Gente|Reparto).
 */
export const geovictoriaAsistenciaReadOnlySubmodule: SubModuleDef = {
    title: 'Asistencia GeoVictoria',
    slug: 'asistencia-geovictoria',
    icon: Clock,
    moduleSlugOverride: 'gente',
};

export function findModule(moduleSlug: string): ModuleDef | undefined {
    return modules.find((mod) => mod.slug === moduleSlug);
}

/** Convierte el árbol de submódulos en una lista plana de solo los ítems "hoja" (los que tienen página propia). */
export function flattenSubmodules(submodules: SubModuleDef[]): SubModuleDef[] {
    return submodules.flatMap((sub) => (sub.submodules ? flattenSubmodules(sub.submodules) : [sub]));
}

export function findSubmodule(moduleSlug: string, submoduleSlug: string): { module: ModuleDef; submodule: SubModuleDef } | undefined {
    const module = findModule(moduleSlug);
    const submodule = module && flattenSubmodules(module.submodules).find((sub) => sub.slug === submoduleSlug);
    return module && submodule ? { module, submodule } : undefined;
}
