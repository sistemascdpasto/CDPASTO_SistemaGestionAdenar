import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

const VIEWBOX = 280;
const CENTRO = VIEWBOX / 2;
const RADIO = CENTRO - 8;
const VUELTAS_MINIMAS = 6;
const COLORES = ['#93c5fd', '#fca5a5', '#86efac', '#d8b4fe', '#fcd34d'];

export interface RuletaItem {
    id: number | string;
    label: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sectorPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx},${cy} L ${start.x},${start.y} A ${r},${r} 0 ${largeArc} 1 ${end.x},${end.y} Z`;
}

/**
 * Ruleta circular tipo disco de sorteo: gira y se detiene exactamente con
 * `resultadoId` (ya determinado por el backend) bajo la flecha fija de la
 * derecha — el azar real es 100% servidor, esto es solo la animación de
 * suspenso hacia ese resultado. Tamaño fijo (vía viewBox), nunca genera
 * scroll de página sin importar cuántas opciones tenga.
 */
export function Ruleta({
    items,
    resultadoId,
    girando,
    onTerminarGiro,
    colorFlecha = '#15803d',
    tamano = 260,
}: {
    items: RuletaItem[];
    resultadoId: number | string | null;
    girando: boolean;
    onTerminarGiro?: () => void;
    colorFlecha?: string;
    tamano?: number;
}) {
    const [rotacion, setRotacion] = useState(0);
    const n = items.length;
    const anguloPorGajo = n > 0 ? 360 / n : 0;

    useEffect(() => {
        if (!girando || resultadoId === null || n === 0) return;

        const indiceGanador = items.findIndex((i) => i.id === resultadoId);
        if (indiceGanador === -1) return;

        const centroGajo = indiceGanador * anguloPorGajo + anguloPorGajo / 2;

        setRotacion((prev) => {
            const vueltasYaHechas = Math.floor(prev / 360);
            return (vueltasYaHechas + VUELTAS_MINIMAS) * 360 - centroGajo;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [girando, resultadoId]);

    if (n === 0) {
        return (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-sidebar-border/70 text-sm text-muted-foreground dark:border-sidebar-border">
                No hay opciones disponibles para sortear.
            </div>
        );
    }

    return (
        <div className="relative mx-auto" style={{ width: tamano, maxWidth: '100%', aspectRatio: '1 / 1' }}>
            <div
                className="absolute top-1/2 z-10 -translate-y-1/2"
                style={{
                    right: -6,
                    width: 0,
                    height: 0,
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    borderRight: `18px solid ${colorFlecha}`,
                    filter: 'drop-shadow(0 1px 1px rgb(0 0 0 / 0.25))',
                }}
            />
            <motion.svg
                viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
                width="100%"
                height="100%"
                animate={{ rotate: rotacion }}
                initial={false}
                transition={{ duration: girando ? 3.4 : 0, ease: [0.1, 0.7, 0.15, 1] }}
                onAnimationComplete={() => girando && onTerminarGiro?.()}
                style={{ transformOrigin: '50% 50%', display: 'block' }}
            >
                <circle cx={CENTRO} cy={CENTRO} r={RADIO + 4} fill="white" stroke="#d1d5db" strokeWidth={3} />
                {items.map((item, i) => {
                    const start = i * anguloPorGajo;
                    const end = start + anguloPorGajo;
                    const mid = start + anguloPorGajo / 2;
                    const textoPos = polarToCartesian(CENTRO, CENTRO, RADIO * 0.6, mid);
                    const anguloTexto = mid > 90 && mid < 270 ? mid + 180 : mid;

                    return (
                        <g key={item.id}>
                            <path d={sectorPath(CENTRO, CENTRO, RADIO, start, end)} fill={COLORES[i % COLORES.length]} stroke="white" strokeWidth={1.5} />
                            <text
                                x={textoPos.x}
                                y={textoPos.y}
                                transform={`rotate(${anguloTexto}, ${textoPos.x}, ${textoPos.y})`}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={n > 20 ? 7 : n > 12 ? 9 : 12}
                                fontWeight={700}
                                fill="#1f2937"
                            >
                                {item.label}
                            </text>
                        </g>
                    );
                })}
                <circle cx={CENTRO} cy={CENTRO} r={10} fill="white" stroke="#d1d5db" strokeWidth={2} />
            </motion.svg>
        </div>
    );
}
