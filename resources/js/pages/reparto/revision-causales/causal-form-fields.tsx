import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type InertiaFormProps } from '@inertiajs/react';

export interface CausalFormData {
    nombre: string;
    requiere_especificacion: boolean;
    is_active: boolean;
    [key: string]: string | boolean;
}

export function CausalFormFields({
    data,
    setData,
    errors,
    processing,
}: Pick<InertiaFormProps<CausalFormData>, 'data' | 'setData' | 'errors' | 'processing'>) {
    return (
        <div className="max-w-lg space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" value={data.nombre} onChange={(e) => setData('nombre', e.target.value)} disabled={processing} autoFocus />
                <InputError message={errors.nombre} />
            </div>

            <label className="flex items-center gap-2 text-sm">
                <Checkbox
                    checked={data.requiere_especificacion}
                    onCheckedChange={(checked) => setData('requiere_especificacion', checked === true)}
                    disabled={processing}
                />
                Pide especificar el motivo (como "Otro")
            </label>

            <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={data.is_active} onCheckedChange={(checked) => setData('is_active', checked === true)} disabled={processing} />
                Causal activa
            </label>
        </div>
    );
}
