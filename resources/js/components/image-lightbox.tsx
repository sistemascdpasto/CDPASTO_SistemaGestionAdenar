import { X } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Vista ampliada de una imagen en overlay a pantalla completa, en vez de
 * abrir una pestaña nueva. Mismo patrón que seguridad/pruebas/show.tsx (sin
 * la marca de agua de verificación, que es específica de esas pruebas).
 */
export function ImageLightbox({ src, alt = 'Vista ampliada', onClose }: { src: string | null; alt?: string; onClose: () => void }) {
    useEffect(() => {
        if (!src) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [src, onClose]);

    if (!src) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="relative inline-block max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar vista ampliada"
                    className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition-colors hover:bg-black/80"
                >
                    <X className="size-5" />
                </button>
                <img src={src} alt={alt} className="block max-h-[88vh] max-w-full rounded-xl object-contain shadow-2xl" />
            </div>
        </div>
    );
}
