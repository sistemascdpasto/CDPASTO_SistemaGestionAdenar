import { Label } from '@/components/ui/label';
import { type LucideIcon } from 'lucide-react';

export type DocumentInfo = {
    path: string;
    fecha: string | null;
    name?: string;
};

export function calcularEdad(fechaNacimiento: string): string {
    if (!fechaNacimiento) return '—';
    const nacimiento = new Date(fechaNacimiento);
    if (Number.isNaN(nacimiento.getTime())) return '—';
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const aunNoCumple = hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
    if (aunNoCumple) edad -= 1;
    return edad >= 0 ? `${edad} años` : '—';
}

/** Tiempo trabajado en la empresa desde la fecha de ingreso (tarjeta con foto, HU06). */
export function calcularTiempoTrabajado(fechaIngreso: string | null): string {
    if (!fechaIngreso) return '—';
    const ingreso = new Date(fechaIngreso);
    if (Number.isNaN(ingreso.getTime())) return '—';

    const hoy = new Date();
    let meses = (hoy.getFullYear() - ingreso.getFullYear()) * 12 + (hoy.getMonth() - ingreso.getMonth());
    if (hoy.getDate() < ingreso.getDate()) meses -= 1;
    if (meses < 0) return '—';

    const anios = Math.floor(meses / 12);
    const mesesRestantes = meses % 12;

    if (anios === 0) return `${mesesRestantes} mes${mesesRestantes === 1 ? '' : 'es'}`;
    if (mesesRestantes === 0) return `${anios} año${anios === 1 ? '' : 's'}`;
    return `${anios} año${anios === 1 ? '' : 's'} ${mesesRestantes} mes${mesesRestantes === 1 ? '' : 'es'}`;
}

export function PillToggle<T extends string>({
    label,
    value,
    options,
    onChange,
    disabled,
}: {
    label: string;
    value: T | '';
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
    disabled?: boolean;
}) {
    return (
        <div className="grid gap-2">
            {label && <Label>{label}</Label>}
            <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        disabled={disabled}
                        aria-pressed={value === option.value}
                        onClick={() => onChange(option.value)}
                        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                            value === option.value
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                                : 'border-input text-muted-foreground hover:border-emerald-200 hover:text-foreground'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// Estilos por "tono" reutilizados tanto en el marco de la tarjeta como en el
// círculo del ícono, así una sección se siente coherente de un vistazo.
const TONOS = {
    neutral: {
        card: 'border-border bg-card',
        iconWrap: 'bg-muted text-muted-foreground',
    },
    verde: {
        card: 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-500/15 dark:bg-emerald-500/5',
        iconWrap: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    },
    azul: {
        card: 'border-sky-100 bg-sky-50/50 dark:border-sky-500/15 dark:bg-sky-500/5',
        iconWrap: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    },
} as const;

export function SeccionCard({
    icon: Icon,
    titulo,
    subtitulo,
    paso,
    children,
    tono = 'neutral',
}: {
    icon?: LucideIcon;
    titulo: string;
    subtitulo?: string;
    paso?: string;
    children: React.ReactNode;
    tono?: keyof typeof TONOS;
}) {
    const estilos = TONOS[tono];

    return (
        <div className={`rounded-2xl border p-4 sm:p-6 ${estilos.card}`}>
            <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    {Icon && (
                        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${estilos.iconWrap}`}>
                            <Icon className="size-5" />
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-semibold text-foreground">{titulo}</p>
                        {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
                    </div>
                </div>
                {paso && (
                    <span className="shrink-0 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {paso}
                    </span>
                )}
            </div>
            {children}
        </div>
    );
}
