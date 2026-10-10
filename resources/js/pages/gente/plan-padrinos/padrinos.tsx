import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Calendar,
    Check,
    ChevronRight,
    HeartHandshake,
    Lightbulb,
    ListChecks,
    Mail,
    Phone,
    Plus,
    Search,
    Sparkles,
    Sprout,
    Star,
    TrendingUp,
    UserCheck,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { useState, type CSSProperties } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Plan Padrinos', href: '/modules/gente/plan-padrinos' },
    { title: 'Padrinos', href: '/modules/gente/plan-padrinos/padrinos' },
];

interface Padrino {
    id: number;
    cedula: string;
    nombre_completo: string;
    cargo: string;
    imagen: string | null;
    mensaje_padrino: string | null;
    correo: string | null;
    celular: string | null;
}

interface ApadrinadoSummary {
    id: number;
    cedula: string;
    nombre_completo: string;
    cargo: string;
    imagen: string | null;
    fecha_ingreso: string;
    padrino_id: number | null;
}

interface Props {
    padrinos: Padrino[];
    apadrinadosList?: ApadrinadoSummary[];
}

// ─── Mini card del grid para Padrinos ───────────────────────────────────────
function MiniCard({
    padrino,
    onClick,
    modoSeleccion,
    isSelected,
    onSelect,
}: {
    padrino: Padrino;
    onClick: () => void;
    modoSeleccion?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
}) {
    const partes = padrino.nombre_completo.trim().split(' ');
    const nombre1 = partes[0] ?? '';
    const nombre2 = partes.slice(1, 3).join(' ');

    return (
        <div
            onClick={onClick}
            className={`group relative overflow-hidden rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-left bg-white border cursor-pointer ${
                isSelected
                    ? 'ring-4 ring-emerald-600 border-emerald-600 scale-[1.02]'
                    : 'border-green-100 hover:border-emerald-300'
            }`}
            style={{ aspectRatio: '3/4' }}
        >
            {/* CÍRCULO CON CHECK DE SELECCIÓN */}
            {modoSeleccion && onSelect && (
                <button
                    type="button"
                    title={isSelected ? 'Padrino seleccionado' : 'Seleccionar este Padrino'}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect();
                    }}
                    className={`absolute top-2.5 left-2.5 z-20 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all shadow-md cursor-pointer ${
                        isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white scale-110'
                            : 'bg-white/95 border-emerald-400 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                    }`}
                >
                    <Check className={`h-4 w-4 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-60'}`} />
                </button>
            )}

            {/* Fondo con ondas decorativas */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 400" preserveAspectRatio="none">
                <ellipse cx="270" cy="30" rx="80" ry="80" fill="#bbf7d0" opacity="0.5" />
                <ellipse cx="-20" cy="380" rx="100" ry="80" fill="#86efac" opacity="0.4" />
                <path d="M0,300 Q150,250 300,320 L300,400 L0,400 Z" fill="#dcfce7" opacity="0.6" />
            </svg>

            {/* Foto grande — 70% superior */}
            <div className="relative h-[68%] overflow-hidden">
                {padrino.imagen ? (
                    <img
                        src={`/storage/${padrino.imagen}`}
                        alt={padrino.nombre_completo}
                        className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg,#d1fae5,#6ee7b7)' }}>
                        <UserCheck className="h-16 w-16 text-green-600" />
                    </div>
                )}
                {/* Onda verde sobre la foto */}
                <svg className="absolute bottom-0 left-0 w-full pointer-events-none" viewBox="0 0 300 40" preserveAspectRatio="none" style={{ height: 40 }}>
                    <path d="M0,20 Q75,0 150,20 Q225,40 300,20 L300,40 L0,40 Z" fill="white" />
                </svg>
                {/* Badge */}
                <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    <Star className="h-2.5 w-2.5 fill-white" /> Padrino
                </span>
            </div>

            {/* Datos — 32% inferior */}
            <div className="relative flex flex-col items-center justify-center px-3 pb-3 pt-1 text-center gap-0.5">
                <p className="text-sm font-black text-green-500 leading-tight">{nombre1}</p>
                <p className="text-sm font-black text-green-700 leading-tight">{nombre2}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{padrino.cargo}</p>
            </div>
        </div>
    );
}

// ─── Mini card del grid para Apadrinados ─────────────────────────────────────
function ApadrinadoMiniCard({
    apadrinado,
    onClick,
    isSelected,
    onSelect,
}: {
    apadrinado: ApadrinadoSummary;
    onClick: () => void;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const partes = apadrinado.nombre_completo.trim().split(' ');
    const nombre1 = partes[0] ?? '';
    const nombre2 = partes.slice(1, 3).join(' ');

    return (
        <div
            onClick={onClick}
            className={`group relative overflow-hidden rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-left bg-white border cursor-pointer ${
                isSelected
                    ? 'ring-4 ring-sky-600 border-sky-600 scale-[1.02]'
                    : 'border-sky-100 hover:border-sky-300'
            }`}
            style={{ aspectRatio: '3/4' }}
        >
            {/* CÍRCULO CON CHECK DE SELECCIÓN */}
            <button
                type="button"
                title={isSelected ? 'Apadrinado seleccionado' : 'Seleccionar este Apadrinado'}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                }}
                className={`absolute top-2.5 left-2.5 z-20 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all shadow-md cursor-pointer ${
                    isSelected
                        ? 'bg-sky-600 border-sky-600 text-white scale-110'
                        : 'bg-white/95 border-sky-400 text-sky-600 hover:bg-sky-600 hover:text-white'
                }`}
            >
                <Check className={`h-4 w-4 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-60'}`} />
            </button>

            {/* Fondo con ondas decorativas azuladas */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 400" preserveAspectRatio="none">
                <ellipse cx="270" cy="30" rx="80" ry="80" fill="#bae6fd" opacity="0.5" />
                <ellipse cx="-20" cy="380" rx="100" ry="80" fill="#7dd3fc" opacity="0.4" />
                <path d="M0,300 Q150,250 300,320 L300,400 L0,400 Z" fill="#e0f2fe" opacity="0.6" />
            </svg>

            {/* Foto grande — 70% superior */}
            <div className="relative h-[68%] overflow-hidden">
                {apadrinado.imagen ? (
                    <img
                        src={`/storage/${apadrinado.imagen}`}
                        alt={apadrinado.nombre_completo}
                        className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sky-100 to-sky-200">
                        <Users className="h-16 w-16 text-sky-600" />
                    </div>
                )}
                {/* Onda sobre la foto */}
                <svg className="absolute bottom-0 left-0 w-full pointer-events-none" viewBox="0 0 300 40" preserveAspectRatio="none" style={{ height: 40 }}>
                    <path d="M0,20 Q75,0 150,20 Q225,40 300,20 L300,40 L0,40 Z" fill="white" />
                </svg>
                {/* Badge */}
                <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    Apadrinado
                </span>
            </div>

            {/* Datos — 32% inferior */}
            <div className="relative flex flex-col items-center justify-center px-3 pb-3 pt-1 text-center gap-0.5">
                <p className="text-sm font-black text-sky-600 leading-tight">{nombre1}</p>
                <p className="text-sm font-black text-sky-800 leading-tight">{nombre2}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{apadrinado.cargo}</p>
                <p className="text-[9px] font-semibold text-sky-700">Ingreso: {apadrinado.fecha_ingreso}</p>
            </div>
        </div>
    );
}

// ─── Helpers de diseño ───────────────────────────────────────────────────────
// Lienzo de referencia 1127 x 713 px. Todo se escala con unidades de contenedor
// (cqw), por lo que la tarjeta se ve igual a cualquier ancho del modal.
const W = 1127;
const H = 713;
const cq = (px: number) => `${((px / W) * 100).toFixed(3)}cqw`;
const at = (x: number, y: number, w?: number): CSSProperties => ({
    position: 'absolute',
    left: `${((x / W) * 100).toFixed(3)}%`,
    top: `${((y / H) * 100).toFixed(3)}%`,
    ...(w ? { width: `${((w / W) * 100).toFixed(3)}%` } : {}),
});
const ic = (px: number): CSSProperties => ({ width: cq(px), height: cq(px) });

const HAND = "'Caveat', 'Segoe Script', cursive";
const SANS = "'Poppins', 'Segoe UI', system-ui, sans-serif";
const INK = '#052e16';
const GREEN = '#1e9a3b';
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Poppins:wght@400;500;600;800&display=swap');`;

const PILARES = [
    { Icon: Users, texto: 'Acompaño' },
    { Icon: Lightbulb, texto: 'Comparto conocimiento' },
    { Icon: TrendingUp, texto: 'Impulso talento' },
    { Icon: Star, texto: 'Construimos grandes resultados' },
];

// ─── Tarjeta corporativa modal ───────────────────────────────────────────────
function PadrinoCard({ padrino, canManage }: { padrino: Padrino; canManage: boolean }) {
    const partes = padrino.nombre_completo.trim().split(' ');
    const primerNombre = partes[0] ?? '';
    const apellido = partes.slice(1, 3).join(' ');

    // Si el nombre es largo, se reduce la letra para no invadir la columna derecha
    const masLargo = Math.max(primerNombre.length, apellido.length, 1);
    const nameSize = Math.max(4, Math.min(68, (68 * 7.5) / masLargo));

    const [mensaje, setMensaje] = useState(padrino.mensaje_padrino ?? '');
    const [editando, setEditando] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaving(true);
        router.post(
            route('gente.plan-padrinos.padrinos.mensaje'),
            { colaborador_id: padrino.id, mensaje_padrino: mensaje },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSaving(false);
                    setSaved(true);
                    setEditando(false);
                    setTimeout(() => setSaved(false), 2500);
                },
                onError: () => setSaving(false),
            },
        );
    };

    const contactos = [
        { Icon: Mail,  texto: padrino.correo   || '—' },
        { Icon: Phone, texto: padrino.celular_1 || '—' },
    ];

    const lineasMensaje = mensaje.trim().split('\n').filter(Boolean);

    return (
        <div
            className="relative w-full overflow-hidden rounded-2xl bg-white shadow-2xl"
            style={{ aspectRatio: `${W} / ${H}`, containerType: 'inline-size', fontFamily: SANS }}
        >
            <style>{FONTS}</style>

            {/* ───────────── Fondo con curvas ───────────── */}
            <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                aria-hidden
            >
                <defs>
                    <linearGradient id="pc-bg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor="#ecfbef" />
                    </linearGradient>
                    <linearGradient id="pc-swoosh" x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0%" stopColor="#d9f99d" />
                        <stop offset="100%" stopColor="#4ade80" />
                    </linearGradient>
                </defs>
                <rect width={W} height={H} fill="url(#pc-bg)" />
                {/* Curva superior que sale de la foto */}
                <path d="M430 240 C 470 130 600 40 740 0 L 575 0 C 520 70 470 150 430 240 Z" fill="url(#pc-swoosh)" opacity="0.75" />
                {/* Olas inferior derecha */}
                <path d="M1127 440 C 1040 480 900 540 720 590 C 600 625 500 690 400 713 L 1127 713 Z" fill="#bbf7d0" opacity="0.45" />
                <path d="M1127 520 C 1020 560 880 610 760 650 C 680 680 610 700 560 713 L 1127 713 Z" fill="#86efac" opacity="0.35" />
            </svg>

            {/* ───────────── Foto con borde difuminado ───────────── */}
            <div
                className="absolute left-0 top-0 h-full"
                style={{
                    width: '44%',
                    WebkitMaskImage: 'linear-gradient(to right, #000 68%, transparent 100%)',
                    maskImage: 'linear-gradient(to right, #000 68%, transparent 100%)',
                }}
            >
                {padrino.imagen ? (
                    <img
                        src={`/storage/${padrino.imagen}`}
                        alt={padrino.nombre_completo}
                        className="h-full w-full object-cover object-top"
                    />
                ) : (
                    <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ background: 'linear-gradient(160deg,#d1fae5 0%,#6ee7b7 60%,#16a34a 100%)' }}
                    >
                        <UserCheck className="text-white/70" style={ic(160)} />
                    </div>
                )}
            </div>

            {/* ───────────── Ola inferior izquierda + slogan ───────────── */}
            <div className="pointer-events-none absolute bottom-0 left-0 h-[33%] w-[29%]">
                <svg viewBox="0 0 300 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id="pc-lime" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#d9f99d" />
                            <stop offset="100%" stopColor="#4ade80" />
                        </linearGradient>
                        <linearGradient id="pc-dark" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#166534" />
                            <stop offset="100%" stopColor="#052e16" />
                        </linearGradient>
                    </defs>
                    <path d="M0 45 C 70 35, 170 70, 300 200 L0 200 Z" fill="url(#pc-lime)" />
                    <path d="M0 62 C 70 52, 160 88, 272 200 L0 200 Z" fill="url(#pc-dark)" />
                </svg>

                <div
                    className="absolute origin-bottom-left text-white"
                    style={{ left: cq(26), bottom: cq(34), transform: 'rotate(-10deg)' }}
                >
                    <p style={{ fontFamily: HAND, fontWeight: 600, fontSize: cq(34), lineHeight: 1.05 }}>
                        Juntos
                        <br />
                        hacemos
                        <br />
                        la diferencia
                    </p>
                    <svg viewBox="0 0 120 12" style={{ width: cq(130), marginTop: cq(4) }} aria-hidden>
                        <path d="M2 9 C 30 3, 80 2, 118 4" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
                    </svg>
                </div>
            </div>

           
            {/* ───────────── Nombre y cargo ───────────── */}
            <div style={at(510, 138)}>
                <h2
                    style={{
                        fontSize: cq(nameSize),
                        fontWeight: 700,
                        lineHeight: 0.78,
                        letterSpacing: '-0.05em',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <span style={{ display: 'block', color: '#06281a' }}>{primerNombre}</span>
                    {apellido && <span style={{ display: 'block', color: GREEN }}>{apellido}</span>}
                </h2>
                <div style={{ height: cq(4), width: cq(48), background: GREEN, marginTop: cq(2) }} />
                <p style={{ fontSize: cq(21), fontWeight: 500, color: '#0f3b26', marginTop: cq(14), whiteSpace: 'nowrap' }}>
                    {padrino.cargo}
                </p>
            </div>

            {/* ───────────── Contacto ───────────── */}
            <ul style={{ ...at(513, 363), display: 'flex', flexDirection: 'column', gap: cq(7) }}>
                {contactos.map(({ Icon, texto }, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: cq(18), height: cq(40) }}>
                        <span
                            className="flex shrink-0 items-center justify-center rounded-full text-white"
                            style={{ ...ic(40), background: '#14532d' }}
                        >
                            <Icon style={ic(19)} strokeWidth={2.2} />
                        </span>
                        <span style={{ fontSize: cq(16.5), color: '#14301f', whiteSpace: 'nowrap' }}>{texto}</span>
                    </li>
                ))}
            </ul>

            {/* ───────────── Frase + pincel (mensaje editable) ───────────── */}
            <div
                style={{
                    ...at(826, editando ? 120 : 210, 280),
                    transform: editando ? 'none' : 'rotate(-8deg)',
                    transformOrigin: 'left top',
                }}
            >
                <svg viewBox="0 0 60 40" style={{ position: 'absolute', right: cq(-9), top: cq(-36), width: cq(40) }} aria-hidden>
                    <g stroke={INK} strokeWidth="3" strokeLinecap="round">
                        <path d="M30 4 L38 20" />
                        <path d="M44 8 L56 14" />
                        <path d="M20 12 L24 22" />
                    </g>
                </svg>

                

                {editando && canManage ? (
                    <div style={{ marginTop: cq(20), display: 'flex', flexDirection: 'column', gap: cq(6) }}>
                        <textarea
                            value={mensaje}
                            onChange={(e) => setMensaje(e.target.value)}
                            maxLength={500}
                            autoFocus
                            rows={3}
                            className="w-full resize-none border-2 border-green-500 bg-green-50 text-green-900 uppercase focus:outline-none focus:ring-2 focus:ring-green-500"
                            style={{
                                fontFamily: HAND,
                                fontWeight: 700,
                                fontSize: cq(24),
                                lineHeight: 1.1,
                                padding: cq(10),
                                borderRadius: cq(10),
                            }}
                        />
                        <div style={{ display: 'flex', gap: cq(14), fontSize: cq(13) }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditando(false);
                                    setMensaje(padrino.mensaje_padrino ?? '');
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={handleSave}
                                className="font-bold text-green-700 hover:text-green-900 disabled:opacity-50"
                            >
                                {saving ? 'Guardando...' : '✓ Guardar'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div
                            className={`relative block w-full ${canManage ? 'cursor-pointer' : ''}`}
style={{
        marginTop: cq(40),
        transform: `translateX(-${cq(95)})`,
    }}                            onClick={() => canManage && setEditando(true)}
                            title={canManage ? 'Clic para editar' : undefined}
                        >
                            <svg viewBox="5 5 270 130" preserveAspectRatio="none" className="absolute inset-2 h-full w-full" aria-hidden>
                                <defs>
                                    <linearGradient id="pc-brush" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#3aa84f" />
                                        <stop offset="100%" stopColor="#15803d" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M6 20 C 40 6, 130 16, 264 4 L 270 44 C 252 62, 264 84, 260 120 C 160 128, 90 112, 2 126 C 14 92, -2 58, 6 20 Z"
                                    fill="url(#pc-brush)"
                                />
                            </svg>
                            <div
                                className="relative text-center text-white"
                                style={{ padding: `${cq(42)} ${cq(5)} ${cq(34)}` }}
                            >
                                {lineasMensaje.length > 0 ? (
                                    lineasMensaje.map((l, i, arr) => (
                                        <p
                                            key={i}
                                            style={{
                                                fontFamily: HAND,
                                                fontWeight: 80,
                                                fontSize: cq(28),
                                                lineHeight: 1.0,
                                                textTransform: 'uppercase',
                                                color: i === arr.length - 1 ? '#d9f99d' : '#ffffff',
                                            }}
                                        >
                                            {l}
                                        </p>
                                    ))
                                ) : (
                                    <p
                                        style={{
                                            fontFamily: HAND,
                                            fontWeight: 500,
                                            fontSize: cq(8),
                                            lineHeight: 1.08,
                                            textTransform: 'uppercase',
                                            opacity: 0.6,
                                        }}
                                    >
                                        {canManage ? 'Clic para agregar mensaje...' : '—'}
                                    </p>
                                )}
                            </div>
                        </div>

                        
                    </>
                )}

                {saved && (
                    <p style={{ fontSize: cq(13), color: '#15803d', fontWeight: 600, marginTop: cq(4) }}>✓ Guardado</p>
                )}
            </div>

            

            {/* ───────────── Mi experiencia ───────────── */}
            <div style={{ ...at(878, 499), display: 'flex', alignItems: 'center', gap: cq(15) }}>
                <Sprout style={ic(46)} color="#15803d" strokeWidth={1.8} />
                <div style={{ transform: 'rotate(-6deg)' }}>
                    <p style={{ fontFamily: HAND, fontWeight: 900, fontSize: cq(25), lineHeight: 1, color: '#14532d' }}>
                        Mi experiencia
                        <br />
                        también es
                        <br />
                        un impulso.
                    </p>
                    
                </div>
            </div>

            {/* ───────────── Pilares ───────────── */}
            <ul style={{ ...at(365, 574, 445), display: 'flex', alignItems: 'stretch', height: cq(92) }}>
                {PILARES.map(({ Icon, texto }, i) => (
                    <li
                        key={texto}
                        className="flex flex-1 flex-col items-center justify-center text-center"
                        style={{
                            borderLeft: i ? '1px solid #86efac' : undefined,
                            padding: `0 ${cq(6)}`,
                            gap: cq(8),
                        }}
                    >
                        <Icon style={ic(34)} color="#15803d" strokeWidth={1.6} />
                        <span style={{ fontSize: cq(12.5), lineHeight: 1.2, color: '#1f2937' }}>{texto}</span>
                    </li>
                ))}
            </ul>

            {/* ───────────── CTA ───────────── */}
            <button
                type="button"
                className="absolute flex items-center text-left text-white transition-transform hover:scale-[1.03]"
                style={{
                    ...at(843, 588, 268),
                    height: `${((84 / H) * 100).toFixed(3)}%`,
                    borderRadius: 9999,
                    padding: `0 ${cq(20)}`,
                    gap: cq(14),
                    background: 'linear-gradient(135deg,#15803d 0%,#166534 60%,#14532d 100%)',
                    border: `${cq(2.5)} solid #a3e635`,
                    boxShadow: '0 10px 24px rgba(21,128,61,.35)',
                }}
            >
                <Users style={ic(38)} strokeWidth={1.7} />
                <span style={{ lineHeight: 1.2 }}>
                    <span style={{ display: 'block', fontSize: cq(16), fontWeight: 600 }}>Hoy soy padrino.</span>
                    <span style={{ display: 'block', fontSize: cq(11.5), opacity: 0.92 }}>
                        mañana seré parte de la historia, 
                        <br />
                        que "ellos" construirán.
                    </span>
                </span>
                <svg viewBox="0 0 50 14" style={{ position: 'absolute', right: cq(20), bottom: cq(10), width: cq(46) }} aria-hidden>
                    <path
                        d="M2 10 C 16 2, 32 2, 47 7 M41 3 L47 7 L41 11"
                        stroke="white"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                </svg>
            </button>
        </div>
    );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function PadrinosIndex({ padrinos, apadrinadosList = [] }: Props) {
    const { auth } = usePage<SharedData>().props;
    const canManage = auth.isAdmin || auth.roles.includes('Gente');

    // Modals de inspección de tarjetas
    const [selectedPadrinoModal, setSelectedPadrinoModal] = useState<Padrino | null>(null);
    const [selectedApadrinadoModal, setSelectedApadrinadoModal] = useState<ApadrinadoSummary | null>(null);

    // MODO SELECCIÓN DIRECTA DESDE LAS CARDS
    const [modoSeleccion, setModoSeleccion] = useState(false);
    const [pasoSeleccion, setPasoSeleccion] = useState<1 | 2>(1);
    const [selectedPadrinoId, setSelectedPadrinoId] = useState<number | null>(null);
    const [selectedApadrinadoId, setSelectedApadrinadoId] = useState<number | null>(null);
    const [searchApadrinado, setSearchApadrinado] = useState('');
    const [savingSeleccion, setSavingSeleccion] = useState(false);

    const handleIniciarSeleccion = () => {
        setModoSeleccion(true);
        setPasoSeleccion(1);
        setSelectedPadrinoId(padrinos.length > 0 ? padrinos[0].id : null);
        setSelectedApadrinadoId(null);
        setSearchApadrinado('');
    };

    const handleCancelarSeleccion = () => {
        setModoSeleccion(false);
        setPasoSeleccion(1);
        setSelectedPadrinoId(null);
        setSelectedApadrinadoId(null);
    };

    const handleGuardarApadrinamiento = () => {
        if (!selectedPadrinoId || !selectedApadrinadoId) return;
        setSavingSeleccion(true);
        router.post(
            route('gente.plan-padrinos.apadrinados.asignar-padrino'),
            {
                colaborador_id: selectedApadrinadoId,
                padrino_id: selectedPadrinoId,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setModoSeleccion(false);
                    setPasoSeleccion(1);
                    setSelectedPadrinoId(null);
                    setSelectedApadrinadoId(null);
                },
                onFinish: () => setSavingSeleccion(false),
            }
        );
    };

    const padrinoSeleccionadoObj = padrinos.find((p) => p.id === selectedPadrinoId);

    // Solo mostrar colaboradores SIN padrino asignado (padrino_id === null)
    const apadrinadosFiltrados = apadrinadosList
        .filter((a) => a.padrino_id === null)
        .filter((a) => {
            if (!searchApadrinado.trim()) return true;
            const query = searchApadrinado.toLowerCase();
            return (
                a.nombre_completo.toLowerCase().includes(query) ||
                a.cargo.toLowerCase().includes(query) ||
                a.cedula.includes(query)
            );
        });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Padrinos — Plan Padrino" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <HeadingSmall
                        title="Nuestros Padrinos"
                        description="Colaboradores operativos con rol de Padrino dentro del Plan Padrino."
                    />

                    {canManage && !modoSeleccion && (
                        <Button
                            onClick={handleIniciarSeleccion}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-xs"
                        >
                            <Plus className="h-4 w-4" />
                            Crear Apadrinamiento
                        </Button>
                    )}
                </div>

                {/* BANNER DE MODO SELECCIÓN DIRECTA */}
                {modoSeleccion && (
                    <div className="rounded-2xl border border-emerald-400/60 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-sky-500/10 p-5 shadow-sm space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-xs shrink-0">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-foreground flex items-center gap-2">
                                        {pasoSeleccion === 1 ? (
                                            <>Paso 1 de 2: Selecciona la tarjeta del Padrino Guía</>
                                        ) : (
                                            <>Paso 2 de 2: Selecciona la tarjeta del Apadrinado</>
                                        )}
                                    </span>
                                    
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                {pasoSeleccion === 1 ? (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleCancelarSeleccion}
                                            className="text-xs gap-1 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                            Cancelar
                                        </Button>
                                        <Button
                                            disabled={!selectedPadrinoId}
                                            onClick={() => setPasoSeleccion(2)}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-bold shadow-xs"
                                        >
                                            Siguiente
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPasoSeleccion(1)}
                                            className="text-xs gap-1 border-emerald-300"
                                        >
                                            <ArrowLeft className="h-3.5 w-3.5" />
                                            Cambiar Padrino
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleCancelarSeleccion}
                                            className="text-xs gap-1 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                            Cancelar
                                        </Button>
                                        <Button
                                            disabled={!selectedApadrinadoId || savingSeleccion}
                                            onClick={handleGuardarApadrinamiento}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-bold shadow-xs"
                                        >
                                            <Sparkles className="h-3.5 w-3.5" />
                                            {savingSeleccion ? 'Guardando...' : 'Guardar Apadrinamiento'}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Estado de selección en el banner */}
                        {pasoSeleccion === 2 && padrinoSeleccionadoObj && (
                            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-200/60 text-xs">
                                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                                    ★ Padrino Guía: <strong className="text-foreground">{padrinoSeleccionadoObj.nombre_completo}</strong>
                                </span>
                                <span className="text-muted-foreground">➔</span>
                                <span className="font-semibold text-sky-700 flex items-center gap-1">
                                    Apadrinado: {selectedApadrinadoId ? (
                                        <strong className="text-foreground">
                                            {apadrinadosList.find((a) => a.id === selectedApadrinadoId)?.nombre_completo}
                                        </strong>
                                    ) : (
                                        <em className="text-muted-foreground font-normal">(Selecciona una tarjeta abajo)</em>
                                    )}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Pestañas */}
                <div className="flex items-center gap-2 border-b pb-2">
                    <Link href="/modules/gente/plan-padrinos"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                        <HeartHandshake className="h-4 w-4" /> Seguimiento de Pruebas (7, 30, 90 días)
                    </Link>
                    <Link href="/modules/gente/plan-padrinos/criterios"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                        <ListChecks className="h-4 w-4" /> Criterios y Nivel de Autonomía
                    </Link>
                    <Link href="/modules/gente/plan-padrinos/padrinos"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground shadow-xs">
                        <Star className="h-4 w-4" /> Padrinos
                    </Link>
                    <Link href="/modules/gente/plan-padrinos/apadrinados"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                        <Users className="h-4 w-4" /> Apadrinados
                    </Link>
                    <Link href="/modules/gente/plan-padrinos/parejas"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                        <HeartHandshake className="h-4 w-4" /> Parejas Padrino - Apadrinado
                    </Link>
                </div>

                {/* PASO 1: GRID DE PADRINOS */}
                {(!modoSeleccion || pasoSeleccion === 1) && (
                    <div className="flex flex-col gap-3">
                        {modoSeleccion && (
                            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5" />
                                Haz clic en el CÍRCULO CON CHECK para elegir el Padrino Guía o en la TARJETA para inspeccionar sus datos:
                            </span>
                        )}
                        {padrinos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
                                <Star className="h-16 w-16 opacity-20 text-green-500" />
                                <p className="text-sm font-medium">No hay colaboradores con rol de Padrino aún.</p>
                                <p className="text-xs">Asigna el rol desde la vista de Criterios.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                {padrinos.map((p) => (
                                    <MiniCard
                                        key={p.id}
                                        padrino={p}
                                        onClick={() => setSelectedPadrinoModal(p)}
                                        modoSeleccion={modoSeleccion}
                                        isSelected={selectedPadrinoId === p.id}
                                        onSelect={() => setSelectedPadrinoId(p.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* PASO 2: GRID DE APADRINADOS */}
                {modoSeleccion && pasoSeleccion === 2 && (
                    <div className="flex flex-col gap-4 pt-2 border-t border-emerald-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-xs font-bold text-sky-700 flex items-center gap-1.5">
                                <UserPlus className="h-4 w-4" />
                                Paso 2: Selecciona el Apadrinado con el CÍRCULO CON CHECK o haz clic en la TARJETA para ver su información:
                            </span>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar apadrinado..."
                                    value={searchApadrinado}
                                    onChange={(e) => setSearchApadrinado(e.target.value)}
                                    className="pl-8 h-8 text-xs"
                                />
                            </div>
                        </div>

                        {apadrinadosFiltrados.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground text-sm bg-muted/20 rounded-xl border border-dashed">
                                {searchApadrinado.trim()
                                    ? 'No se encontraron colaboradores sin padrino asignado con ese criterio.'
                                    : 'No hay colaboradores sin padrino asignado disponibles.'}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                {apadrinadosFiltrados.map((a) => (
                                    <ApadrinadoMiniCard
                                        key={a.id}
                                        apadrinado={a}
                                        onClick={() => setSelectedApadrinadoModal(a)}
                                        isSelected={selectedApadrinadoId === a.id}
                                        onSelect={() => setSelectedApadrinadoId(a.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL PADRINO CARNET */}
            <Dialog open={!!selectedPadrinoModal} onOpenChange={(open) => { if (!open) setSelectedPadrinoModal(null); }}>
                <DialogContent className="w-[96vw] max-w-5xl gap-0 overflow-hidden rounded-2xl border-0 bg-transparent p-0 shadow-2xl sm:max-w-5xl sm:rounded-2xl">
                    <DialogTitle className="sr-only">Padrino {selectedPadrinoModal?.nombre_completo}</DialogTitle>
                    <DialogDescription className="sr-only">
                        Tarjeta de presentación del padrino {selectedPadrinoModal?.nombre_completo}
                    </DialogDescription>
                    {selectedPadrinoModal && <PadrinoCard padrino={selectedPadrinoModal} canManage={canManage} />}
                </DialogContent>
            </Dialog>

            {/* MODAL DETALLE APADRINADO */}
            <Dialog open={!!selectedApadrinadoModal} onOpenChange={(open) => { if (!open) setSelectedApadrinadoModal(null); }}>
                <DialogContent className="sm:max-w-md">
                    {selectedApadrinadoModal && (
                        <div className="flex flex-col items-center gap-4 py-3 text-center">
                            {selectedApadrinadoModal.imagen ? (
                                <img
                                    src={`/storage/${selectedApadrinadoModal.imagen}`}
                                    alt={selectedApadrinadoModal.nombre_completo}
                                    className="h-28 w-28 rounded-full object-cover border-4 border-sky-300 shadow-md"
                                />
                            ) : (
                                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-sky-100 text-sky-600 border-4 border-sky-300 shadow-md">
                                    <UserCheck className="h-12 w-12" />
                                </div>
                            )}

                            <div className="flex flex-col items-center gap-1">
                                <h3 className="text-lg font-bold text-foreground">
                                    {selectedApadrinadoModal.nombre_completo}
                                </h3>
                                <Badge variant="outline" className="text-xs font-semibold">
                                    {selectedApadrinadoModal.cargo}
                                </Badge>
                                <span className="text-xs font-mono text-muted-foreground mt-1">
                                    Cédula: {selectedApadrinadoModal.cedula}
                                </span>
                            </div>

                            <div className="w-full bg-sky-500/10 rounded-xl p-3 text-xs flex flex-col gap-1.5 border border-sky-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5 text-sky-600" />
                                        Fecha de Ingreso:
                                    </span>
                                    <span className="font-bold text-foreground">
                                        {selectedApadrinadoModal.fecha_ingreso}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between w-full pt-3 border-t">
                                <Button variant="outline" size="sm" onClick={() => setSelectedApadrinadoModal(null)}>
                                    Cerrar
                                </Button>
                                {modoSeleccion && (
                                    <Button
                                        onClick={() => {
                                            setSelectedApadrinadoId(selectedApadrinadoModal.id);
                                            setSelectedApadrinadoModal(null);
                                        }}
                                        className="bg-sky-600 hover:bg-sky-700 text-white text-xs gap-1.5 font-bold"
                                    >
                                        <Check className="h-4 w-4" />
                                        Seleccionar este Apadrinado
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
