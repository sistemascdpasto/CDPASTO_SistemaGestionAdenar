import { Button } from '@/components/ui/button';
import { Plus, Trash2, XCircle } from 'lucide-react';
import { useRef } from 'react';

const PRIORIDADES = [{ v: 'alta', l: 'Alta' }, { v: 'media', l: 'Media' }, { v: 'baja', l: 'Baja' }];

export interface NovedadEvidencia { file: File; preview: string; etiqueta: string }

export interface NovedadLocal {
    id?: number | null;
    titulo: string;
    descripcion: string;
    categoria: string;
    prioridad: string;
    estado: string;
    responsable: string;
    fecha_reporte: string;
    fecha_solucion: string;
    realizada: boolean;
    observacion_solucion: string;
    evidencias: NovedadEvidencia[];
}

interface Props {
    novedades: NovedadLocal[];
    onAgregar: () => void;
    onQuitar: (i: number) => void;
    onActualizar: (i: number, campo: keyof Omit<NovedadLocal, 'evidencias'>, valor: string) => void;
    onToggleRealizada: (i: number) => void;
    onActualizarObservacion: (i: number, valor: string) => void;
    onAgregarEvidencia: (i: number, file: File) => void;
    onQuitarEvidencia: (i: number, ei: number) => void;
    errors: Record<string, string>;
}

export default function NovedadesEditor({
    novedades, onAgregar, onQuitar, onActualizar,
    onToggleRealizada, onActualizarObservacion,
    onAgregarEvidencia, onQuitarEvidencia, errors,
}: Props) {
    const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

    return (
        <>
            <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-muted dark:bg-muted">
                            <th className="w-10 border-b border-r border-sidebar-border/70 px-3 py-2.5 text-center text-[11px] font-semibold text-green-700 dark:border-sidebar-border dark:text-green-400">#</th>
                            <th className="border-b border-r border-sidebar-border/70 px-3 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:border-sidebar-border dark:text-green-400">Novedad</th>
                            <th className="w-44 border-b border-r border-sidebar-border/70 px-3 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:border-sidebar-border dark:text-green-400">Evidencias</th>
                            <th className="w-56 border-b border-r border-sidebar-border/70 px-3 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:border-sidebar-border dark:text-green-400">Realizada / Observación</th>
                            <th className="w-8 border-b border-sidebar-border/70 dark:border-sidebar-border" />
                        </tr>
                    </thead>
                    <tbody>
                        {novedades.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                                    Sin novedades. Presiona "+ Agregar novedad" para comenzar.
                                </td>
                            </tr>
                        )}
                        {novedades.map((nov, i) => (
                            <tr key={i} className="align-top hover:bg-muted/50 transition-colors [&:not(:last-child)]:border-b [&:not(:last-child)]:border-sidebar-border/70 dark:[&:not(:last-child)]:border-sidebar-border">

                                {/* # */}
                                <td className="border-r border-sidebar-border/70 px-3 py-3 text-center align-middle dark:border-sidebar-border">
                                    <span className="text-xs font-bold text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                                </td>

                                {/* Novedad */}
                                <td className="border-r border-sidebar-border/70 px-3 py-3 dark:border-sidebar-border">
                                    <div className="mb-1.5 flex items-center gap-1.5">
                                        <select
                                            value={nov.prioridad}
                                            onChange={e => onActualizar(i, 'prioridad', e.target.value)}
                                            className="h-6 rounded bg-transparent px-1 text-[10px] font-semibold text-muted-foreground focus:outline-none">
                                            {PRIORIDADES.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
                                        </select>
                                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white ${
                                            nov.prioridad === 'alta' ? 'bg-red-500'
                                                : nov.prioridad === 'media' ? 'bg-amber-500'
                                                : 'bg-blue-500'
                                        }`}>
                                            {nov.prioridad.toUpperCase()}
                                        </span>
                                    </div>
                                    <textarea
                                        value={nov.descripcion}
                                        onChange={e => {
                                            onActualizar(i, 'descripcion', e.target.value);
                                            onActualizar(i, 'titulo', e.target.value.slice(0, 100));
                                        }}
                                        rows={2}
                                        placeholder="Describe el problema o novedad..."
                                        className="w-full min-w-[180px] resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                                    />
                                    {errors[`novedades.${i}.titulo`] && (
                                        <p className="text-[10px] text-red-500">{errors[`novedades.${i}.titulo`]}</p>
                                    )}
                                </td>

                                {/* Evidencias */}
                                <td className="border-r border-sidebar-border/70 px-3 py-3 dark:border-sidebar-border">
                                    {nov.evidencias.length > 0 && (
                                        <div className="mb-1.5 flex flex-wrap gap-1">
                                            {nov.evidencias.map((ev, ei) => (
                                                <div key={ei} className="relative">
                                                    <img src={ev.preview} alt={ev.etiqueta || `F${ei + 1}`}
                                                        className="h-10 w-10 rounded object-cover" />
                                                    <button type="button" onClick={() => onQuitarEvidencia(i, ei)}
                                                        className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-red-500 text-white">
                                                        <XCircle className="size-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <input
                                        ref={el => { fileRefs.current[i] = el; }}
                                        type="file" accept="image/*" multiple className="hidden"
                                        onChange={e => { Array.from(e.target.files ?? []).forEach(f => onAgregarEvidencia(i, f)); e.target.value = ''; }}
                                    />
                                    <button type="button" onClick={() => fileRefs.current[i]?.click()}
                                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-green-600 transition-colors">
                                        <Plus className="size-3" /> Agregar fotos
                                    </button>
                                </td>

                                {/* Realizada */}
                                <td className="border-r border-sidebar-border/70 px-3 py-3 align-middle dark:border-sidebar-border">
                                    <div className="flex items-start gap-2">
                                        <label className={`flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-all ${
                                            nov.realizada
                                                ? 'border-green-600 bg-green-600 text-white'
                                                : 'border-border bg-transparent text-transparent hover:border-green-400'
                                        }`}>
                                            <input type="checkbox" checked={nov.realizada}
                                                onChange={() => onToggleRealizada(i)} className="sr-only" />
                                            <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </label>
                                        {nov.realizada && (
                                            <textarea
                                                value={nov.observacion_solucion}
                                                onChange={e => onActualizarObservacion(i, e.target.value)}
                                                rows={2}
                                                placeholder="Observación..."
                                                className="w-full resize-none bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                                            />
                                        )}
                                    </div>
                                </td>

                                {/* Eliminar */}
                                <td className="px-2 py-3 align-middle">
                                    <button type="button" onClick={() => onQuitar(i)}
                                        className="text-muted-foreground/60 hover:text-red-500 transition-colors">
                                        <Trash2 className="size-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-3">
                <Button type="button" variant="outline" size="sm" onClick={onAgregar} className="gap-1.5 border-dashed">
                    <Plus className="size-4" /> Agregar novedad
                </Button>
            </div>
        </>
    );
}
