import HeadingSmall from '@/components/heading-small';
import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, LoaderCircle, Map as MapIcon, RefreshCw, Timer, User, Warehouse } from 'lucide-react';
import { useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Vehículos Detenidos', href: '/modules/reparto/vehiculos-detenidos' },
];

interface VehiculoDetenido {
    placa: string;
    minutos_detenido: number | null;
    detenido_desde: string | null;
    latitud: number | null;
    longitud: number | null;
    ultima_posicion_en: string | null;
    conductor: string | null;
    ruta: string | null;
    en_bodega: boolean;
}

function severidadColor(minutos: number | null, enBodega: boolean): string {
    if (enBodega) return '#64748b';
    if (minutos === null) return '#64748b';
    if (minutos >= 30) return '#dc2626';
    if (minutos >= 15) return '#f97316';
    return '#2563eb';
}

type LeafletComponentes = {
    MapContainer: React.ElementType;
    TileLayer: React.ElementType;
    CircleMarker: React.ElementType;
    Tooltip: React.ElementType;
};

// Mismo patrón que MapaVelocidad en reparto/indicadores/index.tsx: import
// dinámico (evita SSR) + CSS por CDN, CircleMarker en vez del pin default
// de Leaflet (así se evita el fix de íconos de bundler).
function MapaDetenidos({ vehiculos }: { vehiculos: VehiculoDetenido[] }) {
    const [mc, setMc] = useState<LeafletComponentes | null>(null);

    useEffect(() => {
        const id = 'leaflet-css';
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }
        Promise.all([import('leaflet'), import('react-leaflet')]).then(([, RL]) => {
            setMc({ MapContainer: RL.MapContainer, TileLayer: RL.TileLayer, CircleMarker: RL.CircleMarker, Tooltip: RL.Tooltip });
        });
    }, []);

    const conUbicacion = vehiculos.filter((v) => v.latitud !== null && v.longitud !== null);

    if (!mc) {
        return (
            <div className="flex h-[420px] w-full items-center justify-center rounded-xl bg-muted">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapIcon className="h-5 w-5 animate-pulse text-red-500" />
                    Cargando mapa...
                </div>
            </div>
        );
    }

    const { MapContainer, TileLayer, CircleMarker, Tooltip } = mc;
    const centro: [number, number] =
        conUbicacion.length > 0 ? [conUbicacion[0].latitud as number, conUbicacion[0].longitud as number] : [1.2136, -77.2811];

    return (
        <MapContainer center={centro} zoom={12} style={{ height: '420px', width: '100%', borderRadius: '0.75rem' }}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {conUbicacion.map((v) => (
                <CircleMarker
                    key={v.placa}
                    center={[v.latitud as number, v.longitud as number]}
                    radius={8}
                    pathOptions={{
                        color: severidadColor(v.minutos_detenido, v.en_bodega),
                        fillColor: severidadColor(v.minutos_detenido, v.en_bodega),
                        fillOpacity: 0.75,
                        weight: 1.5,
                    }}
                >
                    <Tooltip>
                        <div className="min-w-[160px] space-y-1 text-xs">
                            <div className="mb-1 border-b pb-1 text-sm font-bold">{v.placa}</div>
                            <div>Detenido hace {v.minutos_detenido ?? '—'} min</div>
                            {v.conductor && <div>Conductor: {v.conductor}</div>}
                            {v.ruta && <div>Ruta: {v.ruta}</div>}
                            {v.en_bodega && <div className="font-medium text-muted-foreground">En centro de distribución</div>}
                        </div>
                    </Tooltip>
                </CircleMarker>
            ))}
        </MapContainer>
    );
}

export default function VehiculosDetenidosIndex({
    vehiculos,
    kpis,
}: {
    vehiculos: VehiculoDetenido[];
    kpis: { total_detenidos: number; detenidos_30_mas: number; en_bodega: number };
}) {
    const { flash } = usePage<{ flash?: { status?: { message: string; type: string } } }>().props;
    const [actualizando, setActualizando] = useState(false);

    const actualizar = () => {
        setActualizando(true);
        router.post(route('reparto.vehiculos-detenidos.actualizar'), {}, { preserveScroll: true, onFinish: () => setActualizando(false) });
    };

    // Trae lo que ya sincronizó el comando programado (cada 2 min) sin tocar
    // MyGeotab en vivo. router.reload() ya preserva scroll y estado por
    // definición, así que no hay flash ni animación de refresco de página —
    // el mapa y la tabla solo cambian sus datos in-place.
    useEffect(() => {
        const intervalo = setInterval(() => {
            router.reload({ only: ['vehiculos', 'kpis'] });
        }, 30000);
        return () => clearInterval(intervalo);
    }, []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Vehículos Detenidos" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <HeadingSmall
                        title="Vehículos Detenidos"
                        description="Ubicación en vivo (MyGeotab). A los 30+ minutos detenidos se avisa por correo a Reparto y Administrador, salvo en horario fuera de 6am-10pm, sin ruta hoy, o en el centro de distribución."
                    />
                    <Button type="button" variant="outline" disabled={actualizando} onClick={actualizar}>
                        {actualizando ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        Actualizar ahora
                    </Button>
                </div>

                {flash?.status && (
                    <div
                        className={`flex items-center gap-2 rounded-lg border p-4 text-sm font-medium shadow-xs ${
                            flash.status.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                    >
                        {flash.status.type === 'success' ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
                        <span>{flash.status.message}</span>
                    </div>
                )}

                <KpiCardGrid className="sm:grid-cols-3">
                    <KpiCard label="Vehículos detenidos ahora" value={kpis.total_detenidos} icon={Timer} color="#2563eb" />
                    <KpiCard label="Detenidos 30+ minutos" value={kpis.detenidos_30_mas} icon={AlertTriangle} color="#dc2626" />
                    <KpiCard label="En el centro de distribución" value={kpis.en_bodega} icon={Warehouse} color="#64748b" />
                </KpiCardGrid>

                <MapaDetenidos vehiculos={vehiculos} />

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Placa</TableHead>
                                <TableHead>Conductor</TableHead>
                                <TableHead>Ruta</TableHead>
                                <TableHead>Detenido desde</TableHead>
                                <TableHead className="text-right">Minutos</TableHead>
                                <TableHead>Última posición</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vehiculos.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                                        Ningún vehículo detenido en este momento.
                                    </TableCell>
                                </TableRow>
                            )}
                            {vehiculos.map((v) => (
                                <TableRow key={v.placa}>
                                    <TableCell className="font-medium">{v.placa}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {v.conductor ? (
                                            <span className="flex items-center gap-1">
                                                <User className="size-3.5" /> {v.conductor}
                                            </span>
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{v.ruta ?? '—'}</TableCell>
                                    <TableCell>{v.detenido_desde ?? '—'}</TableCell>
                                    <TableCell className="text-right font-medium">{v.minutos_detenido ?? '—'}</TableCell>
                                    <TableCell>
                                        {v.en_bodega ? (
                                            <Badge variant="secondary" className="gap-1">
                                                <Warehouse className="size-3" /> Centro de distribución
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground">{v.ultima_posicion_en ?? '—'}</span>
                                        )}
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
