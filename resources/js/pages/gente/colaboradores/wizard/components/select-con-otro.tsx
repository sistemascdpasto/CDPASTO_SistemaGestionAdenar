import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { type DocumentInfo } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { SimpleFileField } from './simple-file-field';

interface SelectConOtroProps {
    id: string;
    label: string;
    options: string[];
    value: string;
    otroValue: string;
    onValueChange: (value: string) => void;
    onOtroChange: (value: string) => void;
    archivoFiles: File[];
    onArchivoChange: (files: File[]) => void;
    existingDocumentos?: DocumentInfo[];
    error?: string;
    otroError?: string;
    disabled?: boolean;
}

/**
 * Select con opción "Otro" (texto libre) + archivo adjunto — patrón
 * compartido por EPS, AFP y ARL en el Paso 1 del wizard.
 */
export function SelectConOtro({
    id,
    label,
    options,
    value,
    otroValue,
    onValueChange,
    onOtroChange,
    archivoFiles,
    onArchivoChange,
    existingDocumentos,
    error,
    otroError,
    disabled,
}: SelectConOtroProps) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Select value={value} onValueChange={onValueChange} disabled={disabled}>
                <SelectTrigger id={id}>
                    <SelectValue placeholder={`Selecciona ${label}`} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option} value={option}>
                            {option}
                        </SelectItem>
                    ))}
                    <SelectItem value="Otro" className="text-sky-600 font-medium">
                        <span className="flex items-center gap-1.5">
                            <Plus className="size-3.5" />
                            Agregar otro…
                        </span>
                    </SelectItem>
                </SelectContent>
            </Select>
            <InputError message={error} />

            {value === 'Otro' && (
                <div className="grid gap-1.5 border-l-2 border-emerald-300 pl-3 dark:border-emerald-500/30">
                    <Input placeholder={`Nombre de ${label}`} value={otroValue} onChange={(e) => onOtroChange(e.target.value)} disabled={disabled} />
                    <InputError message={otroError} />
                </div>
            )}

            <SimpleFileField
                label={`Archivo de ${label}`}
                files={archivoFiles}
                existing={existingDocumentos}
                onChange={onArchivoChange}
                disabled={disabled}
            />
        </div>
    );
}
