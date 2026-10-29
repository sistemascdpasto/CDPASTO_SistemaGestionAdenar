import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link, usePage } from '@inertiajs/react';
import {
    Bell,
    CalendarClock,
    ChevronRight,
    FileWarning,
    HeartPulse,
    ListChecks,
    Loader2,
    Shirt,
    ShieldAlert,
    Stethoscope,
    Truck,
    Wrench,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface NotificacionItem {
    titulo: string;
    detalle: string | null;
    fecha: string | null;
    url: string;
    critico?: boolean;
}

interface NotificacionGrupo {
    key: string;
    titulo: string;
    icono: string;
    color: string;
    total: number;
    items: NotificacionItem[];
    ver_todos: { label: string; url: string };
}

interface NotificacionesResponse {
    total: number;
    grupos: NotificacionGrupo[];
}

const ICONOS: Record<string, LucideIcon> = {
    'calendar-clock': CalendarClock,
    'shield-alert': ShieldAlert,
    'heart-pulse': HeartPulse,
    stethoscope: Stethoscope,
    truck: Truck,
    wrench: Wrench,
    'list-checks': ListChecks,
    'file-warning': FileWarning,
    shirt: Shirt,
};

// ── Componente ────────────────────────────────────────────────────────────────

export function NotificationsBell() {
    const page = usePage();
    const [data, setData] = useState<NotificacionesResponse>({ total: 0, grupos: [] });
    const [loading, setLoading] = useState(true);
    // Claves descartadas persisten en localStorage (solo oculta de la campana,
    // no borra de la BD ni de la vista modules/seguridad/alertas)
    const [descartados, setDescartados] = useState<Set<string>>(new Set());

    const STORAGE_KEY = 'bell_descartadas';

    // Cargar descartadas de localStorage al montar
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setDescartados(new Set(JSON.parse(raw)));
        } catch { /* ignore */ }
    }, []);

    const cargar = useCallback(() => {
        setLoading(true);
        fetch('/notificaciones', { headers: { Accept: 'application/json' } })
            .then((r) => (r.ok ? r.json() : null))
            .then((json: NotificacionesResponse | null) => {
                if (json) setData(json);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar, page.url]);

    const descartar = (e: React.MouseEvent, clave: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDescartados((prev) => {
            const next = new Set(prev).add(clave);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
            return next;
        });
    };

    // Clave estable: grupo + url + titulo (no depende del índice del array)
    const claveItem = (grupoKey: string, item: NotificacionItem) =>
        `${grupoKey}::${item.url}::${item.titulo}`;

    // Filtrar items descartados y recalcular totales
    const gruposFiltrados = data.grupos
        .map((grupo) => ({
            ...grupo,
            items: grupo.items.filter((item) => !descartados.has(claveItem(grupo.key, item))),
        }))
        .filter((grupo) => grupo.items.length > 0)
        .map((grupo) => ({ ...grupo, total: grupo.items.length }));

    const total = gruposFiltrados.reduce((acc, g) => acc + g.total, 0);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="group relative h-9 w-9 cursor-pointer text-muted-foreground hover:text-foreground"
                    title="Notificaciones"
                >
                    <Bell className="h-5 w-5 transition-transform group-hover:scale-110" />
                    {total > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-extrabold text-white shadow-sm">
                            {total > 99 ? '99+' : total}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-80 border p-0 shadow-lg md:w-96" align="end">
                <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                        <Bell className="h-4 w-4 text-amber-600" />
                        Notificaciones
                    </span>
                    {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                        <Badge variant={total > 0 ? 'destructive' : 'outline'} className="text-[10px]">
                            {total} pendientes
                        </Badge>
                    )}
                </div>

                <div className="max-h-[28rem] overflow-y-auto">
                    {!loading && gruposFiltrados.length === 0 && (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                            <Bell className="mx-auto mb-2 h-7 w-7 text-muted-foreground/30" />
                            No tienes notificaciones pendientes.
                        </div>
                    )}

                    {gruposFiltrados.map((grupo) => {
                        const Icono = ICONOS[grupo.icono] ?? Bell;
                        return (
                            <div key={grupo.key} className="border-b last:border-b-0">
                                <div className="flex items-center justify-between bg-muted/30 px-4 py-2">
                                    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                        <Icono className="h-3.5 w-3.5" style={{ color: grupo.color }} />
                                        {grupo.titulo}
                                    </span>
                                    <Badge variant="outline" className="text-[10px]" style={{ borderColor: grupo.color, color: grupo.color }}>
                                        {grupo.total}
                                    </Badge>
                                </div>

                                <div className="divide-y">
                                    {grupo.items.map((item, idx) => {
                                        const clave = claveItem(grupo.key, item);
                                        return (
                                            <div
                                                key={clave}
                                                className="group relative flex flex-col gap-0.5 px-4 py-2.5 text-xs transition-colors hover:bg-muted/50"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => descartar(e, clave)}
                                                    title="Quitar de la campana"
                                                    className="absolute right-2 top-2 flex size-5 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/30"
                                                >
                                                    <X className="size-3.5" />
                                                </button>
                                                <Link href={item.url} className="flex flex-col gap-0.5 pr-6">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span
                                                            className={`text-[13px] font-semibold ${item.critico ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}
                                                        >
                                                            {item.titulo}
                                                        </span>
                                                        {item.fecha && <span className="shrink-0 text-[10px] text-muted-foreground">{item.fecha}</span>}
                                                    </div>
                                                    {item.detalle && <span className="leading-snug text-muted-foreground">{item.detalle}</span>}
                                                </Link>
                                            </div>
                                        );
                                    })}
                                </div>

                                <Link
                                    href={grupo.ver_todos.url}
                                    className="flex items-center justify-center gap-1 bg-muted/20 py-2 text-[11px] font-semibold text-primary hover:underline"
                                >
                                    {grupo.ver_todos.label}
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        );
                    })}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
