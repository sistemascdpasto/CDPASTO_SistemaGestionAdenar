import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Search,
    UserCheck,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { ApadrinadoCard } from './apadrinado-card';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Plan Padrinos', href: '/modules/gente/plan-padrinos' },
    { title: 'Apadrinados', href: '/modules/gente/plan-padrinos/apadrinados' },
];

interface PadrinoSummary {
    id: number;
    nombre_completo: string;
    cargo: string;
    imagen: string | null;
}

interface Apadrinado {
    id: number;
    cedula: string;
    nombre_completo: string;
    cargo: string;
    area: string;
    imagen: string | null;
    fecha_ingreso: string;
    antiguedad_texto: string;
    dias_en_empresa: number;
    es_padrino: boolean;
    tipo_padrino: string | null;
    padrino_id: number | null;
    padrino: PadrinoSummary | null;
    nivel_autonomia: string;
    celular?: string | null;
    evidencias: { id: number; url: string; etapa?: string; fecha?: string | null }[];
}

interface Metrics {
    total: number;
    recientes_30: number;
    periodo_prueba_90: number;
}

interface Filters {
    search: string;
}

interface Props {
    apadrinados: Apadrinado[];
    padrinosList: PadrinoSummary[];
    metrics: Metrics;
    filters: Filters;
}

// ─── Mini card del grid ──────────────────────────────────────────────────────
function ApadrinadoMiniCard({ apadrinado, onClick }: { apadrinado: Apadrinado; onClick: () => void }) {
    const partes  = apadrinado.nombre_completo.trim().split(' ');
    const nombre1 = partes[0] ?? '';
    const nombre2 = partes.slice(1, 3).join(' ');

    return (
        <div
            onClick={onClick}
            className="group relative overflow-hidden rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-left bg-white border border-sky-100 hover:border-sky-300 cursor-pointer"
            style={{ aspectRatio: '3/4' }}
        >
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 400" preserveAspectRatio="none">
                <ellipse cx="270" cy="30"  rx="80"  ry="80"  fill="#bae6fd" opacity="0.5" />
                <ellipse cx="-20" cy="380" rx="100" ry="80"  fill="#7dd3fc" opacity="0.4" />
                <path d="M0,300 Q150,250 300,320 L300,400 L0,400 Z" fill="#e0f2fe" opacity="0.6" />
            </svg>

            <div className="relative h-[68%] overflow-hidden">
                {apadrinado.imagen ? (
                    <img
                        src={`/storage/${apadrinado.imagen}`}
                        alt={apadrinado.nombre_completo}
                        className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sky-100 to-sky-200">
                        <UserCheck className="h-16 w-16 text-sky-600" />
                    </div>
                )}
                <svg className="absolute bottom-0 left-0 w-full pointer-events-none" viewBox="0 0 300 40" preserveAspectRatio="none" style={{ height: 40 }}>
                    <path d="M0,20 Q75,0 150,20 Q225,40 300,20 L300,40 L0,40 Z" fill="white" />
                </svg>
                <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    <Users className="h-2.5 w-2.5" /> Apadrinado
                </span>
            </div>

            <div className="relative flex flex-col items-center justify-center px-3 pb-3 pt-1 text-center gap-0.5">
                <p className="text-sm font-black text-sky-500 leading-tight">{nombre1}</p>
                <p className="text-sm font-black text-sky-700 leading-tight">{nombre2}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{apadrinado.cargo}</p>
                <p className="text-[9px] font-semibold text-sky-600 mt-0.5">Ingreso: {apadrinado.fecha_ingreso}</p>
            </div>
        </div>
    );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function ApadrinadosIndex({ apadrinados, filters }: Props) {
    const [search, setSearch]                       = useState(filters.search || '');
    const [detalleApadrinado, setDetalleApadrinado] = useState<Apadrinado | null>(null);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        router.get(
            route('gente.plan-padrinos.apadrinados'),
            { search: val },
            { preserveState: true, replace: true },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Apadrinados — Plan Padrino" />

            <div className="flex flex-col gap-4 rounded-xl p-4 md:p-6">
    <h1 className="w-full text-center text-3xl font-black tracking-tight text-foreground">
        Nuestros Apadrinados
    </h1>

                {/* Pestañas */}
                {/* Filtro */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre, cédula o cargo..."
                            value={search}
                            onChange={handleSearchChange}
                            className="pl-9 text-sm"
                        />
                    </div>
                </div>

                {/* Grid de mini cards */}
                {apadrinados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
                        <Users className="h-16 w-16 opacity-20" />
                        <p className="text-sm">No hay colaboradores pendientes de apadrinamiento.</p>
                        <p className="text-xs">Todos los ingresados en los últimos 90 días ya tienen Padrino Guía asignado.</p>                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {apadrinados.map((item) => (
                            <ApadrinadoMiniCard
                                key={item.id}
                                apadrinado={item}
                                onClick={() => setDetalleApadrinado(item)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal tarjeta corporativa */}
            <Dialog open={!!detalleApadrinado} onOpenChange={(open) => { if (!open) setDetalleApadrinado(null); }}>
                <DialogContent className="w-[85vw] max-w-2xl gap-0 overflow-hidden rounded-2xl border-0 bg-transparent p-0 shadow-2xl sm:max-w-2xl sm:rounded-2xl">
                    <DialogTitle className="sr-only">Apadrinado {detalleApadrinado?.nombre_completo}</DialogTitle>
                    <DialogDescription className="sr-only">
                        Tarjeta de presentación del apadrinado {detalleApadrinado?.nombre_completo}
                    </DialogDescription>
                    {detalleApadrinado && <ApadrinadoCard apadrinado={detalleApadrinado} />}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
