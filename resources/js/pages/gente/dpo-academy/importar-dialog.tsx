import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from '@inertiajs/react';
import { BookOpen, Calendar, LoaderCircle, Upload } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface ImportarForm {
    archivo: File | null;
    mes: number;
    anio: number;
    [key: string]: File | null | number;
}

const MESES = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
];

export function ImportarDpoAcademyDialog({ trigger }: { trigger: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const now = new Date();
    const { data, setData, post, processing, errors, reset } = useForm<ImportarForm>({
        archivo: null,
        mes: now.getMonth() + 1,
        anio: now.getFullYear(),
    });

    const currentYear = now.getFullYear();
    const aniosDisponibles = [currentYear - 1, currentYear, currentYear + 1];

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/modules/gente/dpo-academy/importar', {
            forceFormData: true,
            onSuccess: () => {
                reset();
                setOpen(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <Upload className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        Importar DPO Academy desde Excel
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Selecciona el periodo mensual al que corresponden los datos y el archivo Excel (.xlsx, .xls) o CSV.
                    </DialogDescription>
                </DialogHeader>

                <form className="space-y-4 pt-2" onSubmit={submit}>
                    <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 bg-muted/20">
                        <div>
                            <Label className="text-xs font-semibold flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-amber-600" /> Mes del Periodo
                            </Label>
                            <Select value={String(data.mes)} onValueChange={(val) => setData('mes', Number(val))}>
                                <SelectTrigger className="mt-1 h-8 text-xs">
                                    <SelectValue placeholder="Mes" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MESES.map((m) => (
                                        <SelectItem key={m.value} value={String(m.value)} className="text-xs">
                                            {m.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs font-semibold flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-amber-600" /> Año
                            </Label>
                            <Select value={String(data.anio)} onValueChange={(val) => setData('anio', Number(val))}>
                                <SelectTrigger className="mt-1 h-8 text-xs">
                                    <SelectValue placeholder="Año" />
                                </SelectTrigger>
                                <SelectContent>
                                    {aniosDisponibles.map((y) => (
                                        <SelectItem key={y} value={String(y)} className="text-xs">
                                            {y}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="rounded-lg border border-dashed border-border p-4 text-center">
                        <BookOpen className="mx-auto h-8 w-8 text-amber-500" />
                        <div className="mt-2 text-xs text-muted-foreground">Formato aceptado: .xlsx, .xls, .csv</div>
                        <input
                            id="archivo"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="mt-3 block w-full text-xs text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-amber-700 hover:file:bg-amber-100 dark:file:bg-amber-950 dark:file:text-amber-300"
                            onChange={(e) => setData('archivo', e.target.files?.[0] ?? null)}
                        />
                        <InputError message={errors.archivo} className="mt-2" />
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={processing || !data.archivo}>
                            {processing && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            Procesar e Importar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
