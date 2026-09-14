import { ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * CargoCombobox — input con búsqueda en tiempo real sobre un listado de cargos.
 *
 * Permite:
 *  · Escribir libremente para filtrar las opciones.
 *  · Seleccionar una opción de la lista desplegable.
 *  · Limpiar la selección con el botón X.
 *  · Aceptar el texto escrito aunque no esté en el catálogo (valor libre).
 */
interface CargoComboboxProps {
    value: string;
    onChange: (value: string) => void;
    cargos: string[];
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    className?: string;
}

export function CargoCombobox({
    value,
    onChange,
    cargos,
    placeholder = 'Buscar o escribir cargo...',
    disabled = false,
    id,
    className = '',
}: CargoComboboxProps) {
    const [query, setQuery]     = useState(value);
    const [open, setOpen]       = useState(false);
    const containerRef          = useRef<HTMLDivElement>(null);

    // Sincronizar query cuando el valor externo cambia (ej. reset de formulario)
    useEffect(() => { setQuery(value); }, [value]);

    // Cerrar al hacer clic fuera
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                // Si cerró sin seleccionar y el query no coincide con ninguna opción,
                // se emite igual como valor libre
                if (query !== value) onChange(query);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [query, value, onChange]);

    const filtrados = query.trim()
        ? cargos.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
        : cargos;

    const handleInput = (txt: string) => {
        setQuery(txt);
        onChange(txt);          // emitir en tiempo real para el filtro de tabla
        setOpen(true);
    };

    const seleccionar = (cargo: string) => {
        setQuery(cargo);
        onChange(cargo);
        setOpen(false);
    };

    const limpiar = (e: React.MouseEvent) => {
        e.stopPropagation();
        setQuery('');
        onChange('');
        setOpen(false);
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className="relative flex items-center">
                <input
                    id={id}
                    type="text"
                    value={query}
                    disabled={disabled}
                    placeholder={placeholder}
                    autoComplete="off"
                    onFocus={() => setOpen(true)}
                    onChange={(e) => handleInput(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors
                               placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
                               disabled:cursor-not-allowed disabled:opacity-50 pr-14"
                />
                <div className="absolute right-0 flex items-center gap-0.5 pr-2">
                    {query && !disabled && (
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={limpiar}
                            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                    <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {open && filtrados.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-popover shadow-md">
                    {filtrados.map((cargo) => (
                        <button
                            key={cargo}
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(e) => { e.preventDefault(); seleccionar(cargo); }}
                            className={`w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground
                                       ${cargo === value ? 'bg-accent/60 font-medium text-accent-foreground' : ''}`}
                        >
                            {cargo}
                        </button>
                    ))}
                </div>
            )}

            {open && filtrados.length === 0 && query.trim() !== '' && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
                    No hay cargos que coincidan — se usará "<strong>{query}</strong>"
                </div>
            )}
        </div>
    );
}
