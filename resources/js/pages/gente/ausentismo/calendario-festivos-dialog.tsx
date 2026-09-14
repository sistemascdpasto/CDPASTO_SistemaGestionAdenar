import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CalendarDays, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

interface FestivoItem {
    fecha: string;
    nombre: string;
    tipo: 'automatico' | 'custom';
    id: number | null;
}

interface CalendarioFestivosDialogProps {
    trigger?: React.ReactNode;
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function CalendarioFestivosDialog({ trigger }: CalendarioFestivosDialogProps) {
    const [open, setOpen] = useState(false);
    const today = new Date();
    const [mes, setMes] = useState<number>(today.getMonth() + 1);
    const [anio, setAnio] = useState<number>(today.getFullYear());
    const [festivos, setFestivos] = useState<FestivoItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [nombreCustom, setNombreCustom] = useState('Festivo manual');

    const cargarFestivos = async (m: number, a: number) => {
        setLoading(true);
        try {
            const response = await fetch(`/modules/gente/festivos-custom?mes=${m}&anio=${a}`);
            if (response.ok) {
                const data = await response.json();
                setFestivos(data.festivos || []);
            }
        } catch (error) {
            console.error('Error al cargar festivos:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            cargarFestivos(mes, anio);
        }
    }, [open, mes, anio]);

    const handleCambiarMes = (delta: number) => {
        let nMes = mes + delta;
        let nAnio = anio;
        if (nMes > 12) {
            nMes = 1;
            nAnio += 1;
        } else if (nMes < 1) {
            nMes = 12;
            nAnio -= 1;
        }
        setMes(nMes);
        setAnio(nAnio);
    };

    const handleToggleFestivo = async (fechaStr: string, esAuto = false) => {
        if (esAuto) {
            alert('Los festivos nacionales/regionales automáticos se reconocen por ley y no se pueden desactivar.');
            return;
        }

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const response = await fetch('/modules/gente/festivos-custom/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    fecha: fechaStr,
                    nombre: nombreCustom || 'Festivo manual',
                }),
            });

            if (response.ok) {
                cargarFestivos(mes, anio);
            }
        } catch (error) {
            console.error('Error al cambiar estado de festivo:', error);
        }
    };

    // Construir celdas del mes
    const primerDia = new Date(anio, mes - 1, 1);
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const offset = (primerDia.getDay() + 6) % 7; // Lunes = 0

    const celdas: (number | null)[] = [
        ...Array(offset).fill(null),
        ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
    ];

    const getFechaKey = (dia: number) =>
        `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

    const mapFestivos = new Map<string, FestivoItem>();
    festivos.forEach((f) => mapFestivos.set(f.fecha, f));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200">
                        <CalendarDays className="mr-2 h-4 w-4 text-amber-600" />
                        Calendario de Festivos
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-3xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                        <CalendarDays className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        Gestión de Días Festivos y Calendario Laboral
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        Los domingos y festivos (nacionales o personalizados) se marcan automáticamente como no laborales al calificar el ausentismo (100%). Haz clic en cualquier día hábil para marcarlo o desmarcarlo como festivo manual.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    {/* Header de Navegación del Mes */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-amber-50/60 p-3 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleCambiarMes(-1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="min-w-[140px] text-center font-bold text-foreground text-base">
                                {MESES[mes - 1]} {anio}
                            </span>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleCambiarMes(1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Leyenda explicativa */}
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                            <div className="flex items-center gap-1">
                                <span className="h-3 w-3 rounded-full bg-rose-200 border border-rose-400 dark:bg-rose-900" />
                                <span className="text-muted-foreground">Domingos</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="h-3 w-3 rounded-full bg-emerald-200 border border-emerald-400 dark:bg-emerald-900" />
                                <span className="text-muted-foreground">Festivo Ley</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="h-3 w-3 rounded-full bg-amber-300 border border-amber-500 dark:bg-amber-800" />
                                <span className="text-muted-foreground">Festivo Manual</span>
                            </div>
                        </div>
                    </div>

                    {/* Rejilla del Calendario Mensual */}
                    <div className="grid grid-cols-7 gap-1 rounded-lg border border-border bg-muted p-1.5">
                        {DIAS_SEMANA.map((dia) => (
                            <div key={dia} className="py-1.5 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                {dia}
                            </div>
                        ))}

                        {celdas.map((dia, index) => {
                            if (!dia) {
                                return <div key={`empty-${index}`} className="min-h-[70px] rounded-md bg-muted/30" />;
                            }

                            const fechaKey = getFechaKey(dia);
                            const fechaObj = new Date(anio, mes - 1, dia);
                            const esDomingo = fechaObj.getDay() === 0;
                            const festivoInfo = mapFestivos.get(fechaKey);
                            const esAuto = festivoInfo?.tipo === 'automatico';
                            const esCustom = festivoInfo?.tipo === 'custom';

                            let bgClass = 'bg-card hover:bg-muted border-border';
                            if (esAuto) {
                                bgClass = 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800';
                            } else if (esCustom) {
                                bgClass = 'bg-amber-100 hover:bg-amber-200 border-amber-400 dark:bg-amber-900/50 dark:border-amber-700';
                            } else if (esDomingo) {
                                bgClass = 'bg-rose-50/70 hover:bg-rose-100/80 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/50';
                            }

                            return (
                                <button
                                    key={`day-${dia}`}
                                    type="button"
                                    onClick={() => handleToggleFestivo(fechaKey, esAuto)}
                                    className={`flex min-h-[75px] flex-col justify-between rounded-md border p-1.5 text-left transition-all relative group ${bgClass}`}
                                    title={
                                        esAuto
                                            ? `Festivo Ley: ${festivoInfo?.nombre}`
                                            : esCustom
                                              ? `Festivo manual: ${festivoInfo?.nombre} (Clic para desmarcar)`
                                              : esDomingo
                                                ? 'Domingo (Día no laboral)'
                                                : 'Día hábil (Clic para marcar festivo manual)'
                                    }
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className={`text-sm font-bold ${esDomingo ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                                            {dia}
                                        </span>

                                        {esAuto && (
                                            <Badge className="bg-emerald-600 text-[10px] px-1 py-0 h-4 text-white">
                                                Ley
                                            </Badge>
                                        )}

                                        {esCustom && (
                                            <Badge className="bg-amber-600 text-[10px] px-1 py-0 h-4 text-white">
                                                Manual
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="mt-1 min-h-[24px] text-[10px] leading-tight">
                                        {festivoInfo ? (
                                            <span className="font-semibold block truncate text-foreground">
                                                {festivoInfo.nombre}
                                            </span>
                                        ) : esDomingo ? (
                                            <span className="text-rose-500 font-medium">Domingo</span>
                                        ) : (
                                            <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                + Marcar
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                        <Info className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>
                            Cualquier día marcado en amarillo (festivo manual) o verde (ley) se computará como <strong>100% de asistencia (día no laboral)</strong> en el reporte de ausentismo y en la evaluación del Plan Premiación.
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
