import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Pruebas de Alcoholemia', href: '/modules/seguridad/pruebas' },
    { title: 'Calendario', href: '/modules/seguridad/pruebas/calendario' },
];

interface PruebaDelDia {
    id: number;
    hora: string;
    tipo: string;
    colaborador: string | null;
}

const TIPO_LABELS: Record<string, string> = { pre_ruta: 'Pre Ruta', ruta: 'Ruta', post_ruta: 'Post Ruta', jl: 'JL', segundo_viaje: 'Segundo viaje' };

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function PruebasCalendario({ mes, pruebasPorDia }: { mes: string; pruebasPorDia: Record<string, PruebaDelDia[]> }) {
    const [anioStr, mesStr] = mes.split('-');
    const anio = Number(anioStr);
    const mesIndex = Number(mesStr) - 1;

    const primerDia = new Date(anio, mesIndex, 1);
    const diasEnMes = new Date(anio, mesIndex + 1, 0).getDate();
    const offset = (primerDia.getDay() + 6) % 7; // lunes = 0

    const celdas: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)];

    const irAMes = (delta: number) => {
        const nuevaFecha = new Date(anio, mesIndex + delta, 1);
        const nuevoMes = `${nuevaFecha.getFullYear()}-${String(nuevaFecha.getMonth() + 1).padStart(2, '0')}`;
        router.get(route('seguridad.pruebas.calendario'), { mes: nuevoMes }, { preserveState: true });
    };

    const fechaKey = (dia: number) => `${anioStr}-${mesStr}-${String(dia).padStart(2, '0')}`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Calendario de pruebas" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <HeadingSmall title="Calendario de pruebas programadas" description="Vista mensual de las pruebas de alcoholemia programadas." />
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => irAMes(-1)} aria-label="Mes anterior">
                            <ChevronLeft className="size-4" />
                        </Button>
                        <span className="min-w-36 text-center font-medium">
                            {MESES[mesIndex]} {anio}
                        </span>
                        <Button variant="outline" size="icon" onClick={() => irAMes(1)} aria-label="Mes siguiente">
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-sidebar-border/70 bg-sidebar-border/70 dark:border-sidebar-border dark:bg-sidebar-border">
                    {DIAS_SEMANA.map((dia) => (
                        <div key={dia} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">
                            {dia}
                        </div>
                    ))}
                    {celdas.map((dia, index) => (
                        <div key={index} className="min-h-28 bg-background p-1.5">
                            {dia && (
                                <>
                                    <span className="text-xs text-muted-foreground">{dia}</span>
                                    <div className="mt-1 flex flex-col gap-1">
                                        {(pruebasPorDia[fechaKey(dia)] ?? []).map((prueba) => (
                                            <Link
                                                key={prueba.id}
                                                href={route('seguridad.pruebas.show', prueba.id)}
                                                className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary hover:bg-primary/20"
                                                title={`${prueba.hora} · ${prueba.colaborador} (${TIPO_LABELS[prueba.tipo] ?? prueba.tipo})`}
                                            >
                                                {prueba.hora} {prueba.colaborador}
                                            </Link>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
