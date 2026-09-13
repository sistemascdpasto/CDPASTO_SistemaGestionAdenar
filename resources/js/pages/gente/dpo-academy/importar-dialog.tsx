import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from '@inertiajs/react';
import { BookOpen, LoaderCircle, Upload } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface ImportarForm {
    archivo: File | null;
    [key: string]: File | null;
}

export function ImportarDpoAcademyDialog({ trigger }: { trigger: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm<ImportarForm>({
        archivo: null,
    });

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
                        Selecciona el archivo Excel (.xlsx, .xls) o CSV con las columnas:
                        <br />
                        <span className="font-semibold text-foreground">
                            Region, Centro, Negocio, QR Safety, Nombre, Cargo, Coronita, Calificación, Status
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <form className="space-y-4 pt-2" onSubmit={submit}>
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
