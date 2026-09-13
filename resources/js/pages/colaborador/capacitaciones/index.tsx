import { FileIcon, getFileCategoryInfo } from '@/components/capacitaciones/file-icon';
import { type BreadcrumbItem } from '@/types';
import { NotificationsBell } from '@/components/notifications-bell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import AppLayoutNoHeader from '@/layouts/app-layout-no-header';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowRight,
    BookOpen,
    CheckCircle2,
    ChevronRight,
    Clock,
    GraduationCap,
    Rocket,
    Search,
    Star,
    Target,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Mi Centro de Capacitaciones', href: '/portal/capacitaciones' },
];

interface CarpetaProgreso {
    id: number;
    nombre: string;
    descripcion: string | null;
    color: string;
    icono: string;
    portada_url?: string | null;
    total_materiales: number;
    revisados_count: number;
    porcentaje: number;
    completada: boolean;
}

interface MaterialItem {
    id: number;
    titulo: string;
    descripcion: string | null;
    tipo: string;
    tamano_humano: string | null;
    archivo_url?: string | null;
    enlace_externo: string | null;
    revisada?: boolean;
    carpeta: { id: number; nombre: string; color: string | null } | null;
    revisada_humano?: string;
}

interface ProgresoGeneral {
    total_categorias: number;
    categorias_completadas: number;
    porcentaje_general: number;
}

interface MediaItem {
    id: number;
    titulo: string;
    descripcion: string | null;
    tipo: string;
    mime_type: string | null;
    archivo_url: string | null;
    enlace_externo: string | null;
    carpeta: { id: number; nombre: string; color: string | null } | null;
}

// ── helpers carrusel ──────────────────────────────────────────────────────

/** Extrae el ID de YouTube de una URL */
function youtubeId(url: string): string | null {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
}

/** ¿Es un video local? */
function esVideoLocal(item: MediaItem): boolean {
    if (item.tipo === 'video' && item.archivo_url) return true;
    if (item.mime_type?.startsWith('video/')) return true;
    return false;
}

/** ¿Es YouTube? */
function esYoutube(item: MediaItem): boolean {
    if (!item.enlace_externo) return false;
    return /youtube\.com|youtu\.be/.test(item.enlace_externo);
}

/** ¿Es imagen? */
function esImagen(item: MediaItem): boolean {
    return item.tipo === 'imagen' || !!item.mime_type?.startsWith('image/');
}

// ── Carrusel de media con slide horizontal ────────────────────────────────
function CarruselMedia({ items }: { items: MediaItem[] }) {
    const [idx, setIdx]         = useState(0);
    const [prev_, setPrev]      = useState<number | null>(null);
    const [dir, setDir]         = useState<'left' | 'right'>('left');
    const [animating, setAnim]  = useState(false);
    const [playing, setPlaying] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const total = items.length;

    const goTo = (nuevoIdx: number, direction: 'left' | 'right' = 'left') => {
        if (animating || nuevoIdx === idx) return;
        if (videoRef.current) videoRef.current.pause();
        setPlaying(false);
        setDir(direction);
        setPrev(idx);
        setIdx(nuevoIdx);
        setAnim(true);
        setTimeout(() => { setPrev(null); setAnim(false); }, 500);
    };

    const goPrev = () => goTo((idx - 1 + total) % total, 'right');
    const goNext = () => goTo((idx + 1) % total, 'left');

    // Auto-avance solo si no hay video reproduciendo
    useEffect(() => {
        if (total <= 1 || playing) return;
        const t = setTimeout(() => goNext(), 5000);
        return () => clearTimeout(t);
    }, [idx, total, playing]);

    if (total === 0) return null;

    const renderItem = (item: MediaItem, role: 'current' | 'prev') => {
        if (esVideoLocal(item)) {
            return (
                <video
                    ref={role === 'current' ? videoRef : undefined}
                    key={item.id}
                    src={item.archivo_url!}
                    className="h-full w-full object-contain bg-black"
                    controls={role === 'current'}
                    autoPlay={role === 'current'}
                    muted
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                />
            );
        }
        if (esYoutube(item)) {
            const vid = youtubeId(item.enlace_externo!);
            return (
                <iframe
                    key={item.id}
                    className="h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${vid}?rel=0`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={item.titulo}
                />
            );
        }
        if (esImagen(item) && item.archivo_url) {
            return <img key={item.id} src={item.archivo_url} alt={item.titulo} className="h-full w-full object-cover" />;
        }
        return (
            <div key={item.id} className="flex h-full w-full items-center justify-center bg-slate-800">
                <p className="text-slate-400 text-sm">{item.titulo}</p>
            </div>
        );
    };

    // Clases de animación para el slide que entra (current) y el que sale (prev)
    const enterCls = animating
        ? dir === 'left'
            ? 'animate-slide-in-right'
            : 'animate-slide-in-left'
        : '';
    const exitCls = animating
        ? dir === 'left'
            ? 'animate-slide-out-left'
            : 'animate-slide-out-right'
        : 'hidden';

    return (
        <section className="space-y-3">
            <style>{`
                @keyframes slideInRight  { from { transform: translateX(100%); } to { transform: translateX(0); } }
                @keyframes slideInLeft   { from { transform: translateX(-100%); } to { transform: translateX(0); } }
                @keyframes slideOutLeft  { from { transform: translateX(0); } to { transform: translateX(-100%); } }
                @keyframes slideOutRight { from { transform: translateX(0); } to { transform: translateX(100%); } }
                .animate-slide-in-right  { animation: slideInRight  0.5s cubic-bezier(.4,0,.2,1) forwards; }
                .animate-slide-in-left   { animation: slideInLeft   0.5s cubic-bezier(.4,0,.2,1) forwards; }
                .animate-slide-out-left  { animation: slideOutLeft  0.5s cubic-bezier(.4,0,.2,1) forwards; }
                .animate-slide-out-right { animation: slideOutRight 0.5s cubic-bezier(.4,0,.2,1) forwards; }
            `}</style>

            <div
                className="relative overflow-hidden rounded-2xl bg-black shadow-lg w-full"
                style={{ aspectRatio: '16/9' }}
            >
                {/* Slide que sale */}
                {prev_ !== null && (
                    <div className={`absolute inset-0 ${exitCls}`}>
                        {renderItem(items[prev_], 'prev')}
                    </div>
                )}

                {/* Slide que entra (actual) */}
                <div className={`absolute inset-0 ${enterCls}`}>
                    {renderItem(items[idx], 'current')}
                </div>

                {/* Flechas */}
                {total > 1 && (
                    <>
                        <button onClick={goPrev} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/70">
                            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={goNext} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/70">
                            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </>
                )}

                {/* Dots */}
                {total > 1 && (
                    <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 flex gap-1.5">
                        {items.map((_, i) => (
                            <button key={i} onClick={() => goTo(i, i > idx ? 'left' : 'right')}
                                className={`rounded-full transition-all duration-300 ${i === idx ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/70'}`}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Miniaturas */}
            {total > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {items.map((it, i) => (
                        <button key={it.id} onClick={() => goTo(i, i > idx ? 'left' : 'right')}
                            className={`relative shrink-0 h-16 w-28 overflow-hidden rounded-lg border-2 transition-all ${
                                i === idx ? 'border-emerald-500 shadow-md scale-105' : 'border-transparent opacity-50 hover:opacity-90'
                            }`}
                        >
                            {esImagen(it) && it.archivo_url ? (
                                <img src={it.archivo_url} alt={it.titulo} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white text-xs">
                                    {esYoutube(it) ? '▶ YT' : esVideoLocal(it) ? '▶' : '🖼'}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}

// ── Tarjeta de carpeta/curso ───────────────────────────────────────────────
function CursoCard({ carpeta }: { carpeta: CarpetaProgreso }) {
    const color = carpeta.color || '#0D9488';
    const pct   = carpeta.porcentaje;

    return (
        <Link
            href={route('portal.capacitaciones.carpetas.show', carpeta.id)}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm
                       transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-lg"
        >
            {/* ── Imagen grande (ocupa la mayor parte) ── */}
            <div className="relative h-56 w-full overflow-hidden bg-[#0d1f35]">
                {carpeta.portada_url ? (
                    <img
                        src={carpeta.portada_url}
                        alt={carpeta.nombre}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div
                        className="h-full w-full"
                        style={{ background: `linear-gradient(135deg, ${color}cc, ${color}33)` }}
                    />
                )}

                {/* Gradiente inferior para que el texto se lea */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Badge completada */}
                {carpeta.completada && (
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                        <CheckCircle2 className="size-3" /> Completado
                    </span>
                )}

                {/* Nombre + descripción encima del gradiente, pegado abajo */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-bold text-white leading-tight line-clamp-2 transition-colors group-hover:text-emerald-300">
                        {carpeta.nombre}
                    </h3>
                    {carpeta.descripcion && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-white/60">{carpeta.descripcion}</p>
                    )}
                </div>
            </div>

            {/* ── Franja inferior: progreso + CTA ── */}
            <div className="flex flex-col gap-2 p-3 bg-white">
                {/* Barra de progreso */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{carpeta.revisados_count} / {carpeta.total_materiales} revisados</span>
                        <span className="font-bold text-slate-600">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${pct}%`,
                                backgroundColor: carpeta.completada ? '#10b981' : color,
                            }}
                        />
                    </div>
                </div>

                {/* CTA */}
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-600">
                    <span>{carpeta.completada ? 'Repasar' : pct > 0 ? 'Continuar' : 'Comenzar'}</span>
                    <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
            </div>
        </Link>
    );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function CentroCapacitacionesIndex({
    carpetas,
    progreso,
    destacadas,
    recientes,
    resultadosBusqueda,
    portalConfig,
    mediaCarrusel = [],
    filters,
}: {
    carpetas: CarpetaProgreso[];
    progreso: ProgresoGeneral;
    destacadas: MaterialItem[];
    recientes: MaterialItem[];
    resultadosBusqueda: MaterialItem[] | null;
    portalConfig?: { titulo_hero: string; subtitulo_hero: string | null; imagen_hero_url: string | null };
    mediaCarrusel?: MediaItem[];
    filters: { buscar?: string };
}) {
    const [busqueda, setBusqueda] = useState(filters.buscar || '');

    const handleBuscar: FormEventHandler = (e) => {
        e.preventDefault();
        if (!busqueda.trim()) return;
        router.get(route('portal.capacitaciones.index'), { buscar: busqueda }, { preserveState: true, replace: true });
    };

    const limpiarBusqueda = () => {
        setBusqueda('');
        router.get(route('portal.capacitaciones.index'), {}, { preserveState: true, replace: true });
    };

    const carpetasFiltradas = useMemo(() => {
        if (!busqueda.trim() || resultadosBusqueda !== null) return carpetas;
        const q = busqueda.toLowerCase();
        return carpetas.filter((c) =>
            c.nombre.toLowerCase().includes(q) || c.descripcion?.toLowerCase().includes(q),
        );
    }, [carpetas, busqueda, resultadosBusqueda]);

    // Stats dinámicas
    const totalMateriales = carpetas.reduce((s, c) => s + c.total_materiales, 0);
    const totalRevisados  = carpetas.reduce((s, c) => s + c.revisados_count, 0);

    return (
        <AppLayoutNoHeader>
            <Head title="Centro de Capacitaciones" />

            {/* ── WRAPPER que envuelve toda la página ── */}
            <div className="bg-[#0a1628] text-white">

                {/* ══════════════════════════════════════════
                    HERO — sticky, se queda fijo al hacer scroll
                ══════════════════════════════════════════ */}
                <div className="sticky top-0 z-0 overflow-hidden">
                    {/* Imagen de fondo del admin o gradiente por defecto */}
                    {portalConfig?.imagen_hero_url ? (
                        <>
                            <img
                                src={portalConfig.imagen_hero_url}
                                alt="Hero capacitaciones"
                                className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628]/90 via-[#0d2240]/80 to-[#0a3320]/70" />
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0d2240] to-[#0a3320]" />
                    )}

                    {/* ── Barra superior: sidebar trigger + notificaciones ── */}
                    <div className="relative z-20 flex items-center justify-between px-4 pt-3 sm:px-6">
                        <SidebarTrigger className="text-white/70 hover:text-white hover:bg-white/10 rounded-md p-1.5" />
                        <NotificationsBell />
                    </div>
                    {/* Destellos decorativos */}
                    <div className="absolute -top-20 right-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
                    <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-teal-400/5 blur-3xl" />

                    <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
                        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">

                            {/* Columna izquierda: texto */}
                            <div className="space-y-6">
                                {/* Chip */}
                                {/* Título */}
                                <div>
                                    <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                                        {portalConfig?.titulo_hero ?? 'Atraemos talento, desarrollamos potencial.'}
                                    </h1>
                                    <p className="mt-4 max-w-lg text-sm text-white/60 sm:text-base">
                                        {portalConfig?.subtitulo_hero ?? 'Capacitaciones certificadas para el crecimiento profesional de tu equipo. Aprende a tu ritmo, avanza con propósito.'}
                                    </p>
                                </div>

                                {/* CTA */}
                                <div>
                                    <Link
                                        href="#cursos"
                                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/30"
                                    >
                                        <Rocket className="size-4" /> Explorar cursos →
                                    </Link>
                                </div>

                                {/* Stats en fila */}
                                <div className="flex flex-wrap gap-4 pt-2">
                                    {[
                                        { icon: GraduationCap, label: 'Módulos disponibles', value: totalMateriales },
                                        { icon: CheckCircle2,   label: 'Revisados',            value: totalRevisados },
                                        { icon: Target,         label: 'Tu avance',            value: `${progreso.porcentaje_general}%` },
                                        { icon: Star,           label: 'Destacados',           value: destacadas.length },
                                    ].map((stat) => (
                                        <div key={stat.label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
                                            <stat.icon className="size-4 text-emerald-400" />
                                            <div>
                                                <p className="text-lg font-extrabold leading-none text-white">{stat.value}</p>
                                                <p className="text-[10px] text-white/50">{stat.label}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Columna derecha: tarjetas flotantes decorativas + progreso */}
                            <div className="hidden lg:flex flex-col items-end gap-4">
                                {/* Barra de progreso general */}
                                <div className="w-72 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                    <div className="mb-3 flex items-center justify-between">
                                        <p className="text-sm font-bold text-white">Mi Progreso General</p>
                                        <TrendingUp className="size-4 text-emerald-400" />
                                    </div>
                                    <div className="mb-2 flex items-end gap-1">
                                        <span className="text-4xl font-extrabold text-emerald-400">{progreso.porcentaje_general}%</span>
                                        <span className="mb-1 text-xs text-white/50">completado</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                                            style={{ width: `${progreso.porcentaje_general}%` }}
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-white/40">
                                        {progreso.categorias_completadas} de {progreso.total_categorias} categorías completadas
                                    </p>
                                </div>

                                {/* Chip decorativo */}
                                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                                    <Users className="size-5 text-teal-400" />
                                    <div>
                                        <p className="text-sm font-bold text-white">Equipos más fuertes</p>
                                        <p className="text-xs text-white/50">Aprende con tu equipo</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════════════════════════════════════════
                    CONTENIDO PRINCIPAL — sube y tapa el hero
                ══════════════════════════════════════════ */}
                <div className="relative z-10 -mt-8 bg-sidebar shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
                <div className="mx-auto max-w-7xl space-y-12 px-4 pt-10 pb-10 sm:px-6">

                    {/* Resultados de búsqueda global */}
                    {resultadosBusqueda !== null && (
                        <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                            <div className="flex items-center justify-between">
                                <h2 className="flex items-center gap-2 font-bold text-slate-800">
                                    <Search className="size-4 text-emerald-600" />
                                    {resultadosBusqueda.length} resultado(s) para "{busqueda}"
                                </h2>
                                <Button variant="ghost" size="sm" onClick={limpiarBusqueda} className="text-slate-500 hover:text-slate-800">
                                    Ver todos
                                </Button>
                            </div>
                            {resultadosBusqueda.length === 0 ? (
                                <p className="py-4 text-center text-sm text-slate-400">No se encontraron capacitaciones.</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {resultadosBusqueda.map((mat) => {
                                        const ci = getFileCategoryInfo(mat.tipo);
                                        return (
                                            <div key={mat.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${ci.bgColor}`}>
                                                    <FileIcon tipo={mat.tipo} className="size-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-semibold text-slate-800 text-sm">{mat.titulo}</p>
                                                    {mat.carpeta && (
                                                        <Link
                                                            href={route('portal.capacitaciones.carpetas.show', mat.carpeta.id)}
                                                            className="mt-1 flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                                                        >
                                                            {mat.carpeta.nombre} <ArrowRight className="size-3" />
                                                        </Link>
                                                    )}
                                                </div>
                                                {mat.revisada && <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                    {/* Destacadas */}
                    {destacadas.length > 0 && (
                        <section className="space-y-4">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                                <Star className="size-5 fill-amber-400 text-amber-400" />
                                Capacitaciones Destacadas
                            </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {destacadas.map((d) => {
                                    const ci = getFileCategoryInfo(d.tipo);
                                    return (
                                        <div
                                            key={d.id}
                                            className="group relative overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 p-5 transition-all hover:border-amber-300 hover:shadow-md"
                                        >
                                            <div className="mb-3 flex items-start justify-between">
                                                <div className={`flex size-11 items-center justify-center rounded-xl ${ci.bgColor}`}>
                                                    <FileIcon tipo={d.tipo} className="size-6" />
                                                </div>
                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                                    Destacada
                                                </span>
                                            </div>
                                            <h3 className="line-clamp-1 font-bold text-slate-800 group-hover:text-amber-700 transition-colors">
                                                {d.titulo}
                                            </h3>
                                            {d.descripcion && (
                                                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{d.descripcion}</p>
                                            )}
                                            {d.carpeta && (
                                                <Link
                                                    href={route('portal.capacitaciones.carpetas.show', d.carpeta.id)}
                                                    className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
                                                >
                                                    {d.carpeta.nombre} <ArrowRight className="size-3" />
                                                </Link>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Carrusel de videos e imágenes */}
                    {mediaCarrusel.length > 0 && (
                        <CarruselMedia items={mediaCarrusel} />
                    )}

                    {/* ── Título + buscador + chips de carpetas ── */}
                    <div className="px-4 pt-4 sm:px-10">
                        {/* Fila: texto izq + buscador der */}
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            {/* Texto */}
                            <div>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Portal de Aprendizaje
                                </span>
                                <h2 className="mt-3 text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
                                    Mi Centro de<br />
                                    <span className="text-4xl text-emerald-500 sm:text-5xl">Capacitaciones</span>
                                </h2>
                            </div>

                            {/* Buscador */}
                            <form onSubmit={handleBuscar} className="flex w-full shrink-0 items-center gap-2 sm:w-80 sm:self-center">
                                <div className="relative flex-1">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        placeholder="Buscar carpetas, temas o materiales…"
                                        value={busqueda}
                                        onChange={(e) => setBusqueda(e.target.value)}
                                        className="h-10 pl-9 pr-4 text-sm"
                                    />
                                </div>
                                <Button type="submit" className="h-10 bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-500">
                                    Buscar
                                </Button>
                                {busqueda && (
                                    <Button type="button" variant="ghost" size="icon" onClick={limpiarBusqueda} className="h-10 w-10 text-slate-400 hover:text-slate-700">
                                        <X className="size-4" />
                                    </Button>
                                )}
                            </form>
                        </div>

                        {/* Chips de carpetas */}
                        {carpetas.length > 0 && (
                            <div className="mt-5 flex flex-wrap gap-2">
                                <span className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white">
                                    Todos
                                </span>
                                {carpetas.map((c) => (
                                    <a
                                        key={c.id}
                                        href="#cursos"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            document.getElementById('cursos')?.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                                    >
                                        {c.nombre}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Catálogo de cursos */}
                    <section id="cursos" className="space-y-5 scroll-mt-8">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-800">
                                Explora por Categoría
                                <span className="ml-2 text-sm font-normal text-slate-400">({carpetasFiltradas.length})</span>
                            </h2>
                        </div>

                        {carpetasFiltradas.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center">
                                <BookOpen className="size-12 text-slate-300" />
                                <p className="mt-4 text-base font-medium text-slate-500">
                                    {busqueda ? 'Sin coincidencias' : 'No hay categorías disponibles'}
                                </p>
                                <p className="mt-1 text-sm text-slate-400">
                                    {busqueda ? 'Intenta otra búsqueda.' : 'El equipo administrativo publicará módulos próximamente.'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {carpetasFiltradas.map((carpeta) => (
                                    <CursoCard key={carpeta.id} carpeta={carpeta} />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Recientes */}
                    {recientes.length > 0 && (
                        <section className="space-y-4 pb-10">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                                <Clock className="size-5 text-teal-600" />
                                Consultados Recientemente
                            </h2>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {recientes.map((r) => {
                                    const ci = getFileCategoryInfo(r.tipo);
                                    return (
                                        <div
                                            key={r.id}
                                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-teal-300 hover:shadow-md"
                                        >
                                            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${ci.bgColor}`}>
                                                <FileIcon tipo={r.tipo} className="size-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-slate-800">{r.titulo}</p>
                                                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                                                    {r.carpeta && (
                                                        <span className="text-teal-600">{r.carpeta.nombre}</span>
                                                    )}
                                                    {r.carpeta && <span>·</span>}
                                                    <span>{r.revisada_humano}</span>
                                                </div>
                                            </div>
                                            {r.carpeta && (
                                                <Link
                                                    href={route('portal.capacitaciones.carpetas.show', r.carpeta.id)}
                                                    className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-400 transition-all hover:border-teal-400 hover:text-teal-600"
                                                >
                                                    <ArrowRight className="size-3.5" />
                                                </Link>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>
                </div>
            </div>
        </AppLayoutNoHeader>
    );
}
