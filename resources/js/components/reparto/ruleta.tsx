import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

const ITEM_WIDTH = 112;
const REPETICIONES = 8;

export interface RuletaItem {
    id: number | string;
    label: string;
}

/**
 * Carrete horizontal tipo "ruleta de sorteo": gira y se detiene exactamente
 * en `resultadoId`, que ya viene determinado por el backend (el azar real es
 * 100% servidor — esto es solo la animación de suspenso hacia ese resultado,
 * necesario para integridad/auditoría de la selección diaria).
 */
export function Ruleta({
    items,
    resultadoId,
    girando,
    onTerminarGiro,
    colorAcento = '#15803d',
}: {
    items: RuletaItem[];
    resultadoId: number | string | null;
    girando: boolean;
    onTerminarGiro?: () => void;
    colorAcento?: string;
}) {
    const contenedorRef = useRef<HTMLDivElement>(null);
    const [offset, setOffset] = useState(0);

    const pista = useMemo(() => {
        const repetida: RuletaItem[] = [];
        for (let i = 0; i < REPETICIONES; i++) repetida.push(...items);
        return repetida;
    }, [items]);

    useEffect(() => {
        if (!girando || resultadoId === null || items.length === 0) return;

        const indiceGanador = items.findIndex((i) => i.id === resultadoId);
        if (indiceGanador === -1) return;

        const anchoContenedor = contenedorRef.current?.offsetWidth ?? 0;
        const posicionFinal = (REPETICIONES - 1) * items.length + indiceGanador;
        const centroItem = posicionFinal * ITEM_WIDTH + ITEM_WIDTH / 2;
        setOffset(anchoContenedor / 2 - centroItem);
    }, [girando, resultadoId, items]);

    if (items.length === 0) {
        return (
            <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-sidebar-border/70 text-sm text-muted-foreground dark:border-sidebar-border">
                No hay opciones disponibles para sortear.
            </div>
        );
    }

    return (
        <div
            ref={contenedorRef}
            className="relative overflow-hidden rounded-xl border border-sidebar-border/70 bg-muted/30 dark:border-sidebar-border"
            style={{ height: ITEM_WIDTH }}
        >
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2" style={{ background: colorAcento }} />
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-background via-transparent to-background opacity-60" />
            <motion.div
                className="flex h-full"
                animate={{ x: offset }}
                initial={false}
                transition={{ duration: girando ? 2.6 : 0, ease: [0.12, 0.8, 0.22, 1] }}
                onAnimationComplete={() => girando && onTerminarGiro?.()}
            >
                {pista.map((item, index) => (
                    <div
                        key={`${item.id}-${index}`}
                        className="flex shrink-0 flex-col items-center justify-center border-r border-border/50 px-1 text-center"
                        style={{ width: ITEM_WIDTH }}
                    >
                        <span className="line-clamp-3 text-xs font-bold break-words">{item.label}</span>
                    </div>
                ))}
            </motion.div>
        </div>
    );
}
