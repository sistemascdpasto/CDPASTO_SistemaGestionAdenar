import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export interface FirmaPadHandle {
    getFile: () => Promise<File | null>;
}

interface FirmaPadProps {
    label?: string;
    fileName?: string;
}

export const FirmaPad = forwardRef<FirmaPadHandle, FirmaPadProps>(function FirmaPad(
    { label = 'Firma (opcional)', fileName = 'firma.png' },
    ref,
) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [hasSignature, setHasSignature] = useState(false);

    const getContext = () => canvasRef.current?.getContext('2d') ?? null;

    const posFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
        drawing.current = true;
        const ctx = getContext();
        const { x, y } = posFromEvent(e);
        ctx?.beginPath();
        ctx?.moveTo(x, y);
    };

    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        const ctx = getContext();
        if (!ctx) return;
        const { x, y } = posFromEvent(e);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#111827';
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasSignature(true);
    };

    const end = () => {
        drawing.current = false;
    };

    const limpiar = () => {
        const canvas = canvasRef.current;
        const ctx = getContext();
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    useImperativeHandle(ref, () => ({
        getFile: () =>
            new Promise((resolve) => {
                const canvas = canvasRef.current;
                if (!canvas || !hasSignature) {
                    resolve(null);
                    return;
                }
                canvas.toBlob((blob) => {
                    resolve(blob ? new File([blob], fileName, { type: 'image/png' }) : null);
                }, 'image/png');
            }),
    }));

    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</Label>
                {hasSignature && (
                    <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
                        Limpiar
                    </Button>
                )}
            </div>
            <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className="touch-none rounded-md border border-input bg-white"
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerLeave={end}
            />
            <p className="text-muted-foreground text-xs">Dibuja tu firma aquí.</p>
        </div>
    );
});
