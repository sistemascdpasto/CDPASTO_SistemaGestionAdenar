import { Sprout, UserCheck } from 'lucide-react';
import { type CSSProperties } from 'react';

// Interfaz mínima compartida — compatible con Apadrinado y ApadrinadoSummary
export interface ApadrinadoCardData {
    nombre_completo: string;
    cargo: string;
    imagen: string | null;
    fecha_ingreso: string;
    antiguedad_texto?: string | null;
    celular?: string | null;
}

// ─── Helpers de diseño ───────────────────────────────────────────────────────
const W = 800;
const H = 460;
const cq = (px: number) => `${((px / W) * 100).toFixed(3)}cqw`;
const at = (x: number, y: number, w?: number): CSSProperties => ({
    position: 'absolute',
    left: `${((x / W) * 100).toFixed(3)}%`,
    top: `${((y / H) * 100).toFixed(3)}%`,
    ...(w ? { width: `${((w / W) * 100).toFixed(3)}%` } : {}),
});
const ic = (px: number): CSSProperties => ({ width: cq(px), height: cq(px) });

const HAND  = "'Caveat', 'Segoe Script', cursive";
const SANS  = "'Poppins', 'Segoe UI', system-ui, sans-serif";
const BLUE  = '#0369a1';
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Poppins:wght@400;500;600;800&display=swap');`;

// ─── Tarjeta corporativa Apadrinado ─────────────────────────────────────────
export function ApadrinadoCard({ apadrinado }: { apadrinado: ApadrinadoCardData }) {
    const partes       = apadrinado.nombre_completo.trim().split(' ');
    const primerNombre = partes[0] ?? '';
    const apellido     = partes.slice(1, 3).join(' ');
    const masLargo     = Math.max(primerNombre.length, apellido.length, 1);
    const nameSize     = Math.max(4, Math.min(52, (52 * 7.5) / masLargo));

    return (
        <div
            className="relative w-full overflow-hidden rounded-2xl bg-white shadow-2xl"
            style={{ aspectRatio: `${W} / ${H}`, containerType: 'inline-size', fontFamily: SANS }}
        >
            <style>{FONTS}</style>

            {/* ── Fondo con curvas ── */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
                <defs>
                    <linearGradient id="ac-bg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%"   stopColor="#ffffff" />
                        <stop offset="100%" stopColor="#f0f9ff" />
                    </linearGradient>
                    <linearGradient id="ac-swoosh" x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0%"   stopColor="#bae6fd" />
                        <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                </defs>
                <rect width={W} height={H} fill="url(#ac-bg)" />
                <path d="M355 200 C 400 100 530 30 660 0 L 500 0 C 450 60 400 130 355 200 Z" fill="url(#ac-swoosh)" opacity="0.75" />
                <path d="M800 360 C 720 395 600 440 460 455 C 380 462 300 460 240 460 L 800 460 Z" fill="#bae6fd" opacity="0.45" />
                <path d="M800 400 C 710 425 590 448 480 458 L 800 460 Z" fill="#7dd3fc" opacity="0.35" />
            </svg>

            {/* ── Foto con borde difuminado ── */}
            <div
                className="absolute left-0 top-0 h-full"
                style={{
                    width: '44%',
                    WebkitMaskImage: 'linear-gradient(to right, #000 68%, transparent 100%)',
                    maskImage:       'linear-gradient(to right, #000 68%, transparent 100%)',
                }}
            >
                {apadrinado.imagen ? (
                    <img src={`/storage/${apadrinado.imagen}`} alt={apadrinado.nombre_completo} className="h-full w-full object-cover object-top" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(160deg,#e0f2fe 0%,#7dd3fc 60%,#0284c7 100%)' }}>
                        <UserCheck className="text-white/70" style={ic(160)} />
                    </div>
                )}
            </div>

            {/* ── Ola inferior izquierda + slogan ── */}
            <div className="pointer-events-none absolute bottom-0 left-0 h-[33%] w-[29%]">
                <svg viewBox="0 0 300 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id="ac-sky"  x1="0" y1="0" x2="1" y2="1"><stop offset="0%"   stopColor="#bae6fd" /><stop offset="100%" stopColor="#38bdf8" /></linearGradient>
                        <linearGradient id="ac-dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%"   stopColor="#0369a1" /><stop offset="100%" stopColor="#0c4a6e" /></linearGradient>
                    </defs>
                    <path d="M0 45 C 70 35, 170 70, 300 200 L0 200 Z" fill="url(#ac-sky)"  />
                    <path d="M0 62 C 70 52, 160 88, 272 200 L0 200 Z" fill="url(#ac-dark)" />
                </svg>
                <div className="absolute origin-bottom-left text-white" style={{ left: cq(60), bottom: cq(20), transform: 'rotate(-09deg)' }}>
                    <p style={{ fontFamily: HAND, fontWeight: 600, fontSize: cq(25), lineHeight: 1.0 }}>
                        Cada día<br />soy mejor<br />versión
                    </p>
                    <svg viewBox="0 0 120 12" style={{ width: cq(100), marginTop: cq(3) }} aria-hidden>
                        <path d="M2 9 C 30 3, 80 2, 118 4" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
                    </svg>
                </div>
            </div>

            {/* ── Nombre, cargo, teléfono, fecha ingreso, antigüedad ── */}
            <div style={at(355, 44)}>
                <h2 style={{ fontSize: cq(nameSize), fontWeight: 700, lineHeight: 0.78, letterSpacing: '-0.05em', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'block', color: '#0c2340' }}>{primerNombre}</span>
                    {apellido && <span style={{ display: 'block', color: BLUE }}>{apellido}</span>}
                </h2>
                <div style={{ height: cq(3), width: cq(38), background: BLUE, marginTop: cq(2) }} />
                <p style={{ fontSize: cq(14), fontWeight: 500, color: '#0c3350', marginTop: cq(9), whiteSpace: 'nowrap' }}>
                    {apadrinado.cargo}
                </p>
                {apadrinado.celular && (
                    <p style={{ fontSize: cq(12), color: '#14301f', marginTop: cq(6), whiteSpace: 'nowrap' }}>
                        {apadrinado.celular}
                    </p>
                )}
                <p style={{ fontSize: cq(12), color: '#334155', marginTop: cq(10), whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600 }}>Ingreso: </span>{apadrinado.fecha_ingreso}
                </p>
                {apadrinado.antiguedad_texto && (
                    <p style={{ fontSize: cq(12), color: '#334155', marginTop: cq(5), whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>Antigüedad: </span>{apadrinado.antiguedad_texto}
                    </p>
                )}
            </div>

            {/* ── Frase motivacional ── */}
            <div style={{ ...at(355, 240, 390), transform: 'rotate(-3deg)', transformOrigin: 'left top' }}>
                <div className="relative block w-full">
                    <svg viewBox="5 5 270 130" preserveAspectRatio="none" className="absolute inset-2 h-full w-full" aria-hidden>
                        <defs>
                            <linearGradient id="ac-brush" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%"   stopColor="#0284c7" />
                                <stop offset="100%" stopColor="#0369a1" />
                            </linearGradient>
                        </defs>
                        <path d="M6 20 C 40 6, 130 16, 264 4 L 270 44 C 252 62, 264 84, 260 120 C 160 128, 90 112, 2 126 C 14 92, -2 58, 6 20 Z" fill="url(#ac-brush)" />
                    </svg>
                    <div className="relative text-center text-white" style={{ padding: `${cq(30)} ${cq(5)} ${cq(24)}` }}>
                        <p style={{ fontFamily: HAND, fontWeight: 700, fontSize: cq(21), lineHeight: 1.0, textTransform: 'uppercase' }}>Aprendiendo,</p>
                        <p style={{ fontFamily: HAND, fontWeight: 700, fontSize: cq(21), lineHeight: 1.0, textTransform: 'uppercase' }}>creciendo</p>
                        <p style={{ fontFamily: HAND, fontWeight: 700, fontSize: cq(21), lineHeight: 1.0, textTransform: 'uppercase', color: '#bae6fd' }}>con mi padrino.</p>
                    </div>
                </div>
            </div>

            {/* ── Mi camino ── */}
            <div style={{ ...at(610, 370), display: 'flex', alignItems: 'center', gap: cq(10) }}>
                <Sprout style={ic(30)} color={BLUE} strokeWidth={1.8} />
                <div style={{ transform: 'rotate(-6deg)' }}>
                    <p style={{ fontFamily: HAND, fontWeight: 300, fontSize: cq(23), lineHeight: 1, color: '#0c4a6e' }}>
                        Mi camino<br />apenas<br />comienza.
                    </p>
                </div>
            </div>

            {/* ── CTA centrado ── */}
            <button
                type="button"
                className="absolute flex items-center justify-center text-left text-white transition-transform hover:scale-[1.03]"
                style={{
                    ...at(570, 372, 215),
                    left:         '50%',
                    transform:    'translateX(-50%)',
                    height:       `${((58 / H) * 100).toFixed(3)}%`,
                    borderRadius: 9999,
                    padding:      `0 ${cq(14)}`,
                    gap:          cq(7),
                    background:   'linear-gradient(135deg,#0284c7 0%,#0369a1 60%,#0c4a6e 100%)',
                    border:       `${cq(2)} solid #7dd3fc`,
                    boxShadow:    '0 8px 20px rgba(3,105,161,.35)',
                }}
            >
                <UserCheck style={ic(26)} strokeWidth={1.9} />
                <span style={{ lineHeight: 1.2 }}>
                    <strong style={{ display: 'block', fontSize: cq(13) }}>Soy Apadrinado.</strong>
                    <span style={{ display: 'block', fontSize: cq(8.5), opacity: 0.92 }}>
                        Hoy aprendo, mañana<br />seré quien guíe.
                    </span>
                </span>
                <svg viewBox="0 0 50 14" style={{ position: 'absolute', right: cq(14), bottom: cq(7), width: cq(34) }} aria-hidden>
                    <path d="M2 10 C16 2,32 2,47 7 M41 3 L47 7 L41 11" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
            </button>
        </div>
    );
}
