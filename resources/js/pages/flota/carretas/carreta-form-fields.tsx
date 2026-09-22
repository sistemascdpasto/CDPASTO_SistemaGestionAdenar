import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type InertiaFormProps } from '@inertiajs/react';

export interface CarretaFormData {
    placa: string;
    tipo: string;
    is_active: boolean;
    [key: string]: string | boolean;
}

interface CarretaFormFieldsProps extends Pick<InertiaFormProps<CarretaFormData>, 'data' | 'setData' | 'errors' | 'processing'> {
    readonlyPlaca?: boolean;
}

export function CarretaFormFields({ data, setData, errors, processing, readonlyPlaca }: CarretaFormFieldsProps) {
    return (
        <div className="max-w-lg space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="placa">Placa</Label>
                {readonlyPlaca ? (
                    <div className="border-input bg-muted text-muted-foreground flex h-9 w-full items-center rounded-md border px-3 text-sm">
                        {data.placa}
                    </div>
                ) : (
                    <Input
                        id="placa"
                        value={data.placa}
                        onChange={(e) => setData('placa', e.target.value)}
                        disabled={processing}
                        autoFocus
                    />
                )}
                <InputError message={errors.placa} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Input
                    id="tipo"
                    value={data.tipo}
                    onChange={(e) => setData('tipo', e.target.value)}
                    disabled={processing}
                    placeholder="Ej: Estacas, Furgón, Cama baja"
                />
                <InputError message={errors.tipo} />
            </div>

            <label className="flex items-center gap-2 text-sm">
                <Checkbox
                    checked={data.is_active}
                    onCheckedChange={(checked) => setData('is_active', checked === true)}
                    disabled={processing}
                />
                Carreta disponible
            </label>
        </div>
    );
}
