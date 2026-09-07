import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { AlertCircle, Bell, Calendar, ChevronRight, Clock, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AlertaItem {
    colaborador_id: number;
    colaborador: string;
    cedula: string;
    cargo: string;
    etapa_key: string;
    etapa_label: string;
    fecha_programada: string;
    tipo: 'hoy' | 'atrasada';
    dias_vencido: number;
    mensaje: string;
}

interface AlertasResponse {
    total: number;
    total_hoy: number;
    total_atrasadas: number;
    alertas: AlertaItem[];
}

interface AlertaSeguridad {
    id: number;
    tipo: string;
    mensaje: string;
    created_at: string;
    colaborador: string | null;
    cedula: string | null;
    alcoholimetro: string | null;
}

interface AlertasSeguridadResponse {
    total: number;
    alertas: AlertaSeguridad[];
}

// ── Catálogos de display ──────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
    prueba_positiva:        'Prueba positiva',
    salud_mala:             'Salud: Malo',
    no_apto:                'No apto',
    calibracion_proxima:    'Calibración próxima',
    certificado_vencido:    'Certificado vencido',
    contrato_proximo_vencer:'Contrato por vencer',
};

const TIPO_COLOR: Record<string, string> = {
    prueba_positiva:        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    salud_mala:             'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    no_apto:                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    calibracion_proxima:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    certificado_vencido:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    contrato_proximo_vencer:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

// ── Componente ────────────────────────────────────────────────────────────────

export function NotificationsBell() {
    const page  = usePage<SharedData>();
    const { auth } = page.props;

    // Pruebas de período: Seguridad, Gente y Admin
    const isAuthorized = auth.isAdmin || auth.roles.includes('Seguridad') || auth.roles.includes('Gente');
    // Alertas de seguridad: solo Admin y Seguridad
    const isSeguridad  = auth.isAdmin || auth.roles.includes('Seguridad');

    const [data, setData] = useState<AlertasResponse>({
        total: 0, total_hoy: 0, total_atrasadas: 0, alertas: [],
    });
    const [segData, setSegData] = useState<AlertasSeguridadResponse>({ total: 0, alertas: [] });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isAuthorized) return;
        let mounted = true;
        setLoading(true);

        const promises: Promise<void>[] = [
            fetch('/modules/gente/plan-padrinos/alertas-bell', { headers: { Accept: 'application/json' } })
                .then(r => r.ok ? r.json() : null)
                .then((json: AlertasResponse | null) => { if (mounted && json) setData(json); })
                .catch(() => {}),
        ];

        if (isSeguridad) {
            promises.push(
                fetch('/modules/seguridad/alertas/bell', { headers: { Accept: 'application/json' } })
                    .then(r => r.ok ? r.json() : null)
                    .then((json: AlertasSeguridadResponse | null) => { if (mounted && json) setSegData(json); })
                    .catch(() => {}),
            );
        }

        Promise.all(promises).finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [isAuthorized, isSeguridad, page.url]);

    if (!isAuthorized) return null;

    const totalGlobal = data.total + (isSeguridad ? segData.total : 0);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative group h-9 w-9 cursor-pointer text-muted-foreground hover:text-foreground"
                    title="Alertas"
                >
                    <Bell className="h-5 w-5 transition-transform group-hover:scale-110" />
                    {totalGlobal > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-extrabold text-white shadow-sm animate-pulse">
                            {totalGlobal > 99 ? '99+' : totalGlobal}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-80 md:w-96 p-0 border shadow-lg" align="end">

                {/* ── Sección 1: Pruebas de Período ── */}
                <div className="flex flex-col gap-1 border-b bg-muted/40 p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <Bell className="h-4 w-4 text-amber-600" />
                            Alertas de Pruebas de Período
                        </span>
                        <Badge variant={data.total > 0 ? 'destructive' : 'outline'} className="text-[10px]">
                            {data.total} pendientes
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                        {data.total_atrasadas > 0 && (
                            <span className="inline-flex items-center gap-1 text-red-600 font-semibold dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                                <ShieldAlert className="h-3 w-3" />
                                {data.total_atrasadas} atrasadas
                            </span>
                        )}
                        {data.total_hoy > 0 && (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded">
                                <Clock className="h-3 w-3" />
                                {data.total_hoy} para hoy
                            </span>
                        )}
                        {data.total === 0 && (
                            <span className="text-muted-foreground text-xs">Al día, sin pruebas pendientes</span>
                        )}
                    </div>
                </div>

                <div className="max-h-52 overflow-y-auto divide-y">
                    {data.alertas.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                            <Calendar className="h-6 w-6 mx-auto mb-1 text-muted-foreground/40" />
                            Sin pruebas pendientes para hoy ni atrasadas.
                        </div>
                    ) : (
                        data.alertas.map((alerta, idx) => (
                            <Link
                                key={`${alerta.colaborador_id}-${alerta.etapa_key}-${idx}`}
                                href="/modules/gente/plan-padrinos"
                                className="flex flex-col gap-1.5 p-3 text-xs hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-col">
                                        <strong className="text-foreground text-sm font-semibold">{alerta.colaborador}</strong>
                                        <span className="text-[11px] text-muted-foreground">
                                            {alerta.cargo} • C.C. {alerta.cedula}
                                        </span>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] font-bold shrink-0">
                                        {alerta.etapa_label}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                    {alerta.tipo === 'atrasada' ? (
                                        <span className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400 text-[11px]">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            Atrasada hace {alerta.dias_vencido} {alerta.dias_vencido === 1 ? 'día' : 'días'} ({alerta.fecha_programada})
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 text-[11px]">
                                            <Clock className="h-3.5 w-3.5" />
                                            Programada para hoy ({alerta.fecha_programada})
                                        </span>
                                    )}
                                    <span className="text-muted-foreground text-[11px] font-medium flex items-center">
                                        Ir <ChevronRight className="h-3 w-3 ml-0.5" />
                                    </span>
                                </div>
                            </Link>
                        ))
                    )}
                </div>

                <div className="border-t p-2 text-center bg-muted/20">
                    <Link href="/modules/gente/plan-padrinos" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 py-1">
                        Gestionar en Seguimiento de Pruebas
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                </div>

                {/* ── Sección 2: Alertas de Seguridad (solo Admin y Seguridad) ── */}
                {isSeguridad && (
                    <>
                        <div className="flex items-center justify-between border-t border-b bg-muted/40 px-4 py-3">
                            <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                <ShieldAlert className="h-4 w-4 text-red-600" />
                                Alertas de Seguridad
                            </span>
                            <Badge variant={segData.total > 0 ? 'destructive' : 'outline'} className="text-[10px]">
                                {segData.total} pendientes
                            </Badge>
                        </div>

                        <div className="max-h-52 overflow-y-auto divide-y">
                            {segData.alertas.length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">
                                    <ShieldAlert className="h-6 w-6 mx-auto mb-1 text-muted-foreground/40" />
                                    Sin alertas de seguridad pendientes.
                                </div>
                            ) : (
                                segData.alertas.map((alerta) => (
                                    <Link
                                        key={alerta.id}
                                        href="/modules/seguridad/alertas"
                                        className="flex flex-col gap-1 p-3 text-xs hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${TIPO_COLOR[alerta.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                                                {TIPO_LABELS[alerta.tipo] ?? alerta.tipo}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground shrink-0">{alerta.created_at}</span>
                                        </div>
                                        <p className="text-[11px] text-foreground leading-snug mt-0.5">{alerta.mensaje}</p>
                                        {(alerta.colaborador || alerta.alcoholimetro) && (
                                            <span className="text-[10px] text-muted-foreground">
                                                {alerta.colaborador
                                                    ? `${alerta.colaborador}${alerta.cedula ? ` · ${alerta.cedula}` : ''}`
                                                    : alerta.alcoholimetro}
                                            </span>
                                        )}
                                    </Link>
                                ))
                            )}
                        </div>

                        <div className="border-t p-2 text-center bg-muted/20">
                            <Link href="/modules/seguridad/alertas" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 py-1">
                                Ver todas las alertas de seguridad
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </>
                )}

            </DropdownMenuContent>
        </DropdownMenu>
    );
}
