import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

// Se inicializa de forma sincrónica (no en undefined) porque Sidebar decide
// QUÉ ÁRBOL DE COMPONENTES montar (Sheet vs. el div de escritorio) según este
// valor: si arrancara en undefined/false y se corrigiera recién en un efecto,
// habría una ventana — que se repite en cada navegación, ya que el layout se
// remonta completo — en la que un toque en el trigger actúa sobre el sidebar
// de escritorio en vez de abrir el Sheet, porque el Sheet ni siquiera existe
// todavía en el DOM. No hay SSR activo en esta app, así que leer `window` en
// el initializer no genera mismatch de hidratación.
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false));

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

        const onChange = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        mql.addEventListener('change', onChange);

        return () => mql.removeEventListener('change', onChange);
    }, []);

    return isMobile;
}
