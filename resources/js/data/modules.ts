import {
    Activity,
    AlertTriangle,
    BadgeCheck,
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
    Gavel,
    GraduationCap,
    Grid3x3,
    HeartHandshake,
    HeartPulse,
    ListChecks,
    ListTodo,
    Map,
    QrCode,
    ShieldCheck,
    Stethoscope,
    TestTube,
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
     * Submódulo transversal inyectado en la sección de varios pilares a la vez
     * (Capacitaciones, Colaboradores de solo lectura, Asistencia GeoVictoria).
     * El sidebar lo muestra y lo resalta al navegarlo, pero NO lo usa para
     * decidir si un grupo colapsable arranca abierto — si no, al abrir uno de
     * estos se desplegarían todos los pilares que lo contienen.
     */
    shared?: boolean;
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
            { title: 'Condiciones de Salud', slug: 'condiciones-salud', icon: HeartPulse },
            { title: 'Tablero de Indicadores', slug: 'indicador', icon: BarChart3 },
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
            { title: 'Consultas SIMIT', slug: 'simit-consultas', icon: Gavel },
            { title: 'Control de Varadas', slug: 'varadas', icon: Wrench },
            { title: 'Actas de Taller', slug: 'actas-taller', icon: ClipboardList },
        ],
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
    shared: true,
};

/**
 * Capacitaciones es un recurso transversal (mismos materiales para todos los
 * pilares), así que en vez de ser un módulo suelto en el sidebar se inyecta
 * como submódulo dentro de la sección de cada pilar al que el usuario tiene
 * acceso (ver app-sidebar.tsx). Su ruta real vive en routes/capacitaciones.php.
 */
export const capacitacionesSubmodule: SubModuleDef = {
    title: 'Capacitaciones',
    slug: 'capacitaciones',
    href: '/modules/capacitaciones',
    icon: GraduationCap,
    shared: true,
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
    shared: true,
};

export function findModule(moduleSlug: string): ModuleDef | undefined {
    return modules.find((mod) => mod.slug === moduleSlug);
}

/**
 * URL a la que navega un submódulo "hoja" desde la vista del módulo o el
 * sidebar: respeta `href` (ruta propia fuera del prefijo del módulo) y
 * `moduleSlugOverride` (submódulo inyectado que vive bajo otro pilar).
 */
export function submoduleHref(mod: ModuleDef, sub: SubModuleDef): string {
    return sub.href ?? (sub.slug ? `/modules/${sub.moduleSlugOverride ?? mod.slug}/${sub.slug}` : `/modules/${mod.slug}`);
}

/** Sección de la vista de un módulo: un grupo de submódulos afines con su encabezado. */
export interface ModuleSection {
    /** `null` para los submódulos sueltos (sin grupo): se muestran primero y sin encabezado. */
    title: string | null;
    icon: LucideIcon | null;
    items: SubModuleDef[];
}

/**
 * Reorganiza los submódulos de un pilar en secciones para la vista del módulo:
 * primero los submódulos sueltos y luego cada grupo afín (ACIS, OWD, Exámenes
 * Médicos, ...) con su propio encabezado, en vez de una única grilla plana.
 * Respeta `allowedRoles` de cada submódulo (Administrador siempre puede ver).
 */
export function buildModuleSections(mod: ModuleDef, userRoles: string[], isAdmin: boolean): ModuleSection[] {
    const puedeVer = (sub: SubModuleDef) => isAdmin || !sub.allowedRoles || sub.allowedRoles.some((r) => userRoles.includes(r));

    const sueltos: SubModuleDef[] = [];
    const grupos: ModuleSection[] = [];

    for (const sub of mod.submodules) {
        if (sub.submodules) {
            const items = sub.submodules.filter(puedeVer);
            if (items.length > 0) {
                grupos.push({ title: sub.title, icon: sub.icon, items });
            }
        } else if (puedeVer(sub)) {
            sueltos.push(sub);
        }
    }

    return [...(sueltos.length > 0 ? [{ title: null, icon: null, items: sueltos } satisfies ModuleSection] : []), ...grupos];
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
