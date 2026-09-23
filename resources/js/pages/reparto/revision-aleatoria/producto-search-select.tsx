import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Package, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface ProductoOption {
    id: number;
    sku: string;
    descripcion: string;
}

interface ProductoSearchSelectProps {
    id: string;
    label: string;
    valor: string;
    skuActual: string;
    onChange: (valor: string) => void;
    onSelect: (producto: ProductoOption) => void;
    error?: string;
    disabled?: boolean;
}

/**
 * Búsqueda de producto contra el catálogo de SKU. A diferencia de
 * ColaboradorSearchSelect (filtra una lista ya cargada en el cliente), el
 * catálogo (~2000 productos) es demasiado grande para pasar como prop, así
 * que cada cambio de texto (debounced) consulta el backend en vivo; al
 * elegir un resultado se autocompleta el SKU asociado.
 */
export function ProductoSearchSelect({ id, label, valor, skuActual, onChange, onSelect, error, disabled }: ProductoSearchSelectProps) {
    const [open, setOpen] = useState(false);
    const [resultados, setResultados] = useState<ProductoOption[]>([]);
    const [buscando, setBuscando] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const consulta = valor.trim();
    const debouncedConsulta = useDebouncedValue(consulta, 300);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (debouncedConsulta.length < 2) {
            setResultados([]);
            return;
        }

        let cancelado = false;
        setBuscando(true);

        fetch(route('reparto.revision-aleatoria.productos.buscar', { q: debouncedConsulta }), {
            headers: { Accept: 'application/json' },
        })
            .then((res) => (res.ok ? res.json() : []))
            .then((data: ProductoOption[]) => {
                if (!cancelado) setResultados(data);
            })
            .catch(() => {
                if (!cancelado) setResultados([]);
            })
            .finally(() => {
                if (!cancelado) setBuscando(false);
            });

        return () => {
            cancelado = true;
        };
    }, [debouncedConsulta]);

    const seleccionar = (producto: ProductoOption) => {
        onSelect(producto);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative grid gap-1.5">
            <Label htmlFor={id} className="text-xs">
                {label}
            </Label>
            <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    id={id}
                    className="pl-8"
                    autoComplete="off"
                    placeholder="Buscar producto por nombre o SKU..."
                    value={valor}
                    disabled={disabled}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    required
                />
                {open && !disabled && consulta.length >= 2 && (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
                        {buscando ? (
                            <p className="px-2 py-1.5 text-sm text-muted-foreground">Buscando...</p>
                        ) : resultados.length === 0 ? (
                            <p className="px-2 py-1.5 text-sm text-muted-foreground">Sin resultados</p>
                        ) : (
                            resultados.map((producto) => (
                                <button
                                    key={producto.id}
                                    type="button"
                                    onClick={() => seleccionar(producto)}
                                    className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                                        producto.sku === skuActual ? 'bg-accent/60' : ''
                                    }`}
                                >
                                    <span className="flex min-w-0 items-center gap-2">
                                        <Package className="size-3.5 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{producto.descripcion}</span>
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">{producto.sku}</span>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
            <InputError message={error} />
        </div>
    );
}
