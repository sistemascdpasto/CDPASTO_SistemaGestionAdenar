import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Calendar, Edit, FileText, Trash2, Truck, User } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Medición de Tiempos en Inventario', href: '/modules/reparto/medicion-tiempos-inventario' },
    { title: 'Detalle', href: '' },
];

interface ColaboradorInfo { nombre_completo: string; cedula: string; }
interface VehiculoInfo    { placa: string; modelo: string; }

interface Registro {
    id: number;
    fecha_medicion: string | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    duracion_minutos: number | null;
    tipo_inventario: string | null;
    creado_por: string | null;
    fecha_creacion: string | null;
    usuario: string | null;
    colaborador_info: ColaboradorInfo | null;
    vehiculo_info: VehiculoInfo | null;
}

interface Props { registro: Registro; }

function formatHora(h: string | null) {
    if (!h) return '—';
    const [hh, mm] = h.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function formatFecha(f: string | null) {
    if (!f) return '—';
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
}

function formatDuracion(min: number | null) {
    if (!min) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Fila({ icono, etiqueta, valor }: { icono: React.ReactNode; etiqueta: string; valor: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-3 border-b border-sidebar-border/60 last:border-0 dark:border-sidebar-border">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                {icono}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">{etiqueta}</p>
                <p className="text-sm sm:text-base font-semibold text-foreground break-words">{valor}</p>
            </div>
        </div>
    );
}

export default function MedicionTiemposInventarioShow({ registro }: Props) {
    const yaFinalizado = !!registro.hora_fin;

    const handleEliminar = () => {
        if (confirm('¿Estás seguro de eliminar esta medición?')) {
            router.delete(route('reparto.medicion-tiempos-inventario.destroy', registro.id));
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Detalle de Medición #${registro.id}`} />

            <div className="space-y-6 w-full max-w-2xl mx-auto px-2 sm:px-0">

                {/* Cabecera */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <HeadingSmall>Medición #{registro.id}</HeadingSmall>
                    <div className="flex flex-wrap gap-2">
                        <Link href={route('reparto.medicion-tiempos-inventario.edit', registro.id)}>
                            <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                                <Edit className="mr-1.5 h-3.5 w-3.5" />
                                {yaFinalizado ? 'Ver / Editar' : 'Finalizar'}
                            </Button>
                        </Link>
                        <Button variant="destructive" size="sm" className="text-xs sm:text-sm" onClick={handleEliminar}>
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Eliminar
                        </Button>
                    </div>
                </div>

                {/* Card única con todos los datos */}
                <div className="w-full rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border">

                    {/* Estado — encabezado de color */}
                    <div className={`flex items-center justify-between rounded-t-xl px-4 sm:px-5 py-3 ${
                        yaFinalizado
                            ? 'bg-rose-50 dark:bg-rose-900/20'
                            : 'bg-emerald-50 dark:bg-emerald-900/20'
                    }`}>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</span>
                        <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold ${
                            yaFinalizado
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}>
                            {yaFinalizado ? 'Finalizado' : 'En curso'}
                        </span>
                    </div>

                    <div className="px-4 sm:px-5 pb-2">

                        {/* Tiempos — destacados, apilan en móvil */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-4 py-4 border-b border-sidebar-border/60 dark:border-sidebar-border">
                            <div className="text-center">
                                <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Inicio</p>
                                <p className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                    {formatHora(registro.hora_inicio)}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Fin</p>
                                <p className={`text-lg sm:text-2xl font-black ${yaFinalizado ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
                                    {formatHora(registro.hora_fin)}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Duración</p>
                                <p className="text-lg sm:text-2xl font-black text-foreground">
                                    {formatDuracion(registro.duracion_minutos)}
                                </p>
                            </div>
                        </div>

                        {/* Resto de datos */}
                        <Fila
                            icono={<Calendar className="size-3.5" />}
                            etiqueta="Fecha de registro"
                            valor={registro.fecha_creacion
                                ? <>
                                    {new Date(registro.fecha_creacion).toLocaleDateString('es-CO')}
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                                        {new Date(registro.fecha_creacion).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </span>
                                  </>
                                : '—'}
                        />
                        <Fila
                            icono={<Calendar className="size-3.5" />}
                            etiqueta="Fecha de medición"
                            valor={
                                <>
                                    {formatFecha(registro.fecha_medicion)}
                                    {registro.hora_fin && (
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                                            {formatHora(registro.hora_fin)}
                                        </span>
                                    )}
                                </>
                            }
                        />
                        <Fila
                            icono={<Truck className="size-3.5" />}
                            etiqueta="Vehículo"
                            valor={registro.vehiculo_info?.placa ?? '—'}
                        />
                        <Fila
                            icono={<User className="size-3.5" />}
                            etiqueta="Colaborador"
                            valor={registro.colaborador_info
                                ? <>{registro.colaborador_info.nombre_completo} <span className="ml-1 font-mono text-xs text-muted-foreground">{registro.colaborador_info.cedula}</span></>
                                : '—'}
                        />
                        <Fila
                            icono={<FileText className="size-3.5" />}
                            etiqueta="Registrado por"
                            valor={registro.usuario ?? registro.creado_por ?? '—'}
                        />
                    </div>
                </div>

                <div className="flex justify-start">
                    <Link href={route('reparto.medicion-tiempos-inventario.index')}>
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver al listado
                        </Button>
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
}
