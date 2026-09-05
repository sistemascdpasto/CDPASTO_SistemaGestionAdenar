import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FestivoItem {
    fecha: string;       // 'YYYY-MM-DD'
    nombre: string;
    tipo: 'automatico' | 'custom';
    id: number | null;
}

interface Props {
    /** Mes actualmente seleccionado en el filtro del plan premiación */
    mesInicial: number;
    /** Año actualmente seleccionado en el filtro del plan premiación */
    anioInicial: number;
    /** Solo Administrador y Gente pueden editar */
    puedeEditar?: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function diasDelMes(anio: number, mes: number): number {
    return new Date(anio, mes, 0).getDate(); // mes 1-indexed
}

function primerDiaSemana(anio: number, mes: number): number {
    return new Date(anio, mes - 1, 1).getDay(); // 0=Dom
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

function fechaStr(anio: number, mes: number, dia: number): string {
    return `${anio}-${pad(mes)}-${pad(dia)}`;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CalendarioFestivos({ mesInicial, anioInicial, puedeEditar = false }: Props) {
    const [open, setOpen] = useState(false);
    const [mes, setMes] = useState(mesInicial);
    const [anio, setAnio] = useState(anioInicial);
    const [festivos, setFestivos] = useState<FestivoItem[]>([]);
    const [cargando, setCargando] = useState(false);
    const [toggling, setToggling] = useState<string | null>(null); // fecha que está procesando
    const [nombreNuevo, setNombreNuevo] = useState('Festivo personalizado');

    // Estado del diálogo de confirmación
    const [confirm, setConfirm] = useState<{ fecha: string; esQuitar: boolean } | null>(null);

    // ── Cargar festivos del mes/año ────────────────────────────────────────────
    const cargarFestivos = useCallback(async (m: number, a: number) => {
        setCargando(true);
        try {
            const res = await fetch(`/modules/gente/festivos-custom?mes=${m}&anio=${a}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            // Deduplicar por fecha: si una fecha aparece como 'custom' Y 'automatico',
            // el custom tiene prioridad (es demarcable por el usuario)
            const raw: FestivoItem[] = data.festivos ?? [];
            const dedup = new Map<string, FestivoItem>();
            for (const f of raw) {
                const existing = dedup.get(f.fecha);
                // custom tiene prioridad: sobreescribe cualquier automático previo
                if (!existing || f.tipo === 'custom') {
                    dedup.set(f.fecha, f);
                }
            }
            setFestivos([...dedup.values()]);
        } catch {
            setFestivos([]);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        if (open) cargarFestivos(mes, anio);
    }, [open, mes, anio, cargarFestivos]);

    // ── Sincronizar mes/año con el filtro externo cuando cambia ───────────────
    useEffect(() => { setMes(mesInicial); }, [mesInicial]);
    useEffect(() => { setAnio(anioInicial); }, [anioInicial]);

    // ── Navegar mes ───────────────────────────────────────────────────────────
    const navegarMes = (delta: number) => {
        let m = mes + delta;
        let a = anio;
        if (m < 1)  { m = 12; a--; }
        if (m > 12) { m = 1;  a++; }
        setMes(m);
        setAnio(a);
    };

    // ── Verificar si una fecha es festivo ─────────────────────────────────────
    const esFestivo = (fecha: string) => festivos.some(f => f.fecha === fecha);
    const tipoFestivo = (fecha: string) => festivos.find(f => f.fecha === fecha)?.tipo ?? null;
    const nombreFestivo = (fecha: string) => festivos.find(f => f.fecha === fecha)?.nombre ?? '';

    // ── Toggle día como festivo custom ────────────────────────────────────────
    const toggleDia = async (fecha: string) => {
        if (!puedeEditar) return;
        // Solo permite toggle en festivos custom o días sin festivo
        const festivo = festivos.find(f => f.fecha === fecha);
        if (festivo?.tipo === 'automatico') return; // los automáticos no se modifican

        // Mostrar diálogo de confirmación en lugar de actuar directamente
        setConfirm({ fecha, esQuitar: festivo?.tipo === 'custom' });
    };

    // ── Ejecutar el toggle tras confirmación ──────────────────────────────────
    const confirmarToggle = async () => {
        if (!confirm) return;
        const { fecha } = confirm;
        setConfirm(null);
        setToggling(fecha);
        try {
            const csrfMeta = document.querySelector('meta[name="csrf-token"]');
            const csrf = csrfMeta ? (csrfMeta as HTMLMetaElement).content : '';
            const res = await fetch('/modules/gente/festivos-custom/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrf,
                },
                body: JSON.stringify({ fecha, nombre: nombreNuevo }),
            });
            if (res.ok) {
                await cargarFestivos(mes, anio);
            }
        } finally {
            setToggling(null);
        }
    };

    // ── Construir grid del mes ────────────────────────────────────────────────
    const totalDias  = diasDelMes(anio, mes);
    const primerDia  = primerDiaSemana(anio, mes);  // 0=Dom … 6=Sáb
    const celdas: (number | null)[] = [
        ...Array(primerDia).fill(null),
        ...Array.from({ length: totalDias }, (_, i) => i + 1),
    ];
    // Completar hasta múltiplo de 7
    while (celdas.length % 7 !== 0) celdas.push(null);

    // ── Contar festivos custom del mes ────────────────────────────────────────
    const customCount = festivos.filter(f => f.tipo === 'custom').length;
    const autoCount   = festivos.filter(f => f.tipo === 'automatico').length;

    return (
        <>
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                    <CalendarDays className="h-4 w-4 text-amber-600" />
                    Festivos
                    {customCount > 0 && (
                        <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                            +{customCount}
                        </span>
                    )}
                </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader className="mb-4">
                    <SheetTitle className="flex items-center gap-2 text-base">
                        <CalendarDays className="h-5 w-5 text-amber-500" />
                        Calendario de Festivos
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                        Los días marcados en <span className="font-semibold text-amber-600">naranja</span> son festivos automáticos de Colombia/Nariño/Pasto.
                        {puedeEditar && (
                            <> Hacé clic en cualquier día hábil para marcarlo/desmarcarlo como festivo personalizado (<span className="font-semibold text-violet-600">morado</span>).</>
                        )}
                    </SheetDescription>
                </SheetHeader>

                {/* Nombre para nuevos festivos custom */}
                {puedeEditar && (
                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                            Nombre para festivos que agregues:
                        </label>
                        <Input
                            value={nombreNuevo}
                            onChange={e => setNombreNuevo(e.target.value)}
                            placeholder="Ej: Día cívico Pasto"
                            className="h-8 text-xs"
                        />
                    </div>
                )}

                {/* Navegación mes */}
                <div className="mb-3 flex items-center justify-between">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navegarMes(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-semibold">
                        {MESES_NOMBRES[mes - 1]} {anio}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navegarMes(1)}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* Grid días de semana */}
                <div className="grid grid-cols-7 mb-1">
                    {DIAS_SEMANA.map(d => (
                        <div key={d} className={`text-center text-[10px] font-bold py-1
                            ${d === 'Dom' || d === 'Sáb' ? 'text-rose-400' : 'text-slate-400'}`}>
                            {d}
                        </div>
                    ))}
                </div>

                {/* Grid días del mes */}
                {cargando ? (
                    <div className="flex items-center justify-center py-10 text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Cargando...
                    </div>
                ) : (
                    <div className="grid grid-cols-7 gap-0.5">
                        {celdas.map((dia, idx) => {
                            if (!dia) return <div key={`empty-${idx}`} />;

                            const fecha     = fechaStr(anio, mes, dia);
                            const esDom     = new Date(anio, mes - 1, dia).getDay() === 0;
                            const esSab     = new Date(anio, mes - 1, dia).getDay() === 6;
                            const festivo   = esFestivo(fecha);
                            const tipo      = tipoFestivo(fecha);
                            const nombre    = nombreFestivo(fecha);
                            const procesando = toggling === fecha;
                            const esHoy     = fecha === new Date().toISOString().slice(0, 10);

                            let clases = 'relative flex flex-col items-center justify-center rounded-md h-10 w-full text-xs font-medium transition-all select-none ';

                            if (procesando) {
                                clases += 'bg-slate-200 animate-pulse cursor-wait ';
                            } else if (tipo === 'automatico') {
                                clases += 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 cursor-default border border-amber-300 ';
                            } else if (tipo === 'custom') {
                                clases += 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-400 ';
                                if (puedeEditar) clases += 'cursor-pointer hover:bg-violet-200 ';
                            } else if (esDOM(esDom) || esSab) {
                                clases += 'text-rose-400 bg-rose-50 dark:bg-rose-950/10 cursor-default ';
                            } else {
                                clases += 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 ';
                                if (puedeEditar) clases += 'cursor-pointer ';
                                else clases += 'cursor-default ';
                            }

                            if (esHoy) clases += 'ring-2 ring-blue-400 ';

                            return (
                                <button
                                    key={fecha}
                                    className={clases}
                                    onClick={() => toggleDia(fecha)}
                                    disabled={procesando || !puedeEditar || tipo === 'automatico' || (tipo !== 'custom' && (esDOM(esDom) || esSab))}
                                    title={
                                        tipo === 'automatico' ? nombre
                                        : tipo === 'custom' ? (puedeEditar ? `Clic para demarcar: ${nombre}` : nombre)
                                        : (puedeEditar ? 'Clic para marcar como festivo' : undefined)
                                    }
                                    type="button"
                                >
                                    {procesando
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <span>{dia}</span>
                                    }
                                    {tipo === 'automatico' && (
                                        <span className="absolute bottom-0.5 left-0 right-0 text-[8px] text-amber-600 text-center leading-none truncate px-0.5">
                                            festivo
                                        </span>
                                    )}
                                    {tipo === 'custom' && (
                                        <>
                                            <span className="absolute bottom-0.5 left-0 right-0 text-[8px] text-violet-600 text-center leading-none truncate px-0.5">
                                                custom
                                            </span>
                                            {puedeEditar && (
                                                <span className="absolute top-0.5 right-0.5 text-[9px] font-bold text-violet-400 leading-none">
                                                    ✕
                                                </span>
                                            )}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Leyenda */}
                <div className="mt-4 space-y-1 border-t pt-3 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded bg-amber-100 border border-amber-300" />
                        Festivo automático Colombia / Nariño / Pasto
                    </div>
                    {puedeEditar && (
                        <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded bg-violet-100 border border-violet-400" />
                            Festivo personalizado — clic para demarcar <span className="font-bold text-violet-500">✕</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded bg-rose-50 border border-rose-200" />
                        Sábado / Domingo
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded border-2 border-blue-400" />
                        Hoy
                    </div>
                </div>

                {/* Resumen festivos del mes */}
                <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-xs">
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Festivos en {MESES_NOMBRES[mes - 1]} {anio}
                    </p>
                    <p className="text-slate-500">Automáticos: <strong>{autoCount}</strong></p>
                    <p className="text-slate-500">Personalizados: <strong>{customCount}</strong></p>
                    {festivos.length === 0 && !cargando && (
                        <p className="text-slate-400 italic mt-1">Sin festivos este mes.</p>
                    )}
                    {festivos.map(f => (
                        <div key={f.fecha} className="mt-1 flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${f.tipo === 'automatico' ? 'bg-amber-400' : 'bg-violet-400'}`} />
                            <span className="text-slate-600 dark:text-slate-300">
                                <strong>{f.fecha.slice(8)}</strong> — {f.nombre}
                            </span>
                        </div>
                    ))}
                </div>
            </SheetContent>
        </Sheet>

        {/* Diálogo de confirmación para marcar/desmarcar festivo */}
        <Dialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-amber-500" />
                        {confirm?.esQuitar ? 'Demarcar festivo' : 'Marcar como festivo'}
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        {confirm?.esQuitar
                            ? <>¿Querés <strong>demarcar</strong> el día <strong>{confirm.fecha.slice(8)}</strong> y quitarlo de los festivos personalizados? Esta acción puede afectar los cálculos de ausentismo del mes.</>
                            : <>¿Querés marcar el día <strong>{confirm?.fecha.slice(8)}</strong> como festivo personalizado con el nombre <strong>"{nombreNuevo}"</strong>? Esta acción puede afectar los cálculos de ausentismo del mes.</>
                        }
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>
                        Cancelar
                    </Button>
                    <Button
                        size="sm"
                        variant={confirm?.esQuitar ? 'destructive' : 'default'}
                        onClick={confirmarToggle}
                    >
                        {confirm?.esQuitar ? 'Sí, demarcar' : 'Sí, marcar como festivo'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}

// helper para evitar error linter con variable esDOM
function esDOM(val: boolean): boolean { return val; }
