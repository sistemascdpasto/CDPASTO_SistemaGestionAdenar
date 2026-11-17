import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type DocumentInfo } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { Plus } from 'lucide-react';
import { SimpleFileField } from './simple-file-field';

/* ─────────────────────────────────────────────────────────────────────────────
 * SelectSimpleConOtro
 * Select + opción "Agregar otro…" + input de texto libre.
 * Sin archivo adjunto — apto para tipo_documento, estado_civil, tipo_contrato.
 * ───────────────────────────────────────────────────────────────────────────── */

export interface SelectSimpleConOtroProps {
    id: string;
    label?: string;
    options: string[];
    value: string;
    otroValue: string;
    onValueChange: (value: string) => void;
    onOtroChange: (value: string) => void;
    placeholder?: string;
    otroPlaceholder?: string;
    error?: string;
    otroError?: string;
    disabled?: boolean;
}

export function SelectSimpleConOtro({
    id,
    label,
    options,
    value,
    otroValue,
    onValueChange,
    onOtroChange,
    placeholder,
    otroPlaceholder,
    error,
    otroError,
    disabled,
}: SelectSimpleConOtroProps) {
    return (
        <div className="grid gap-2">
            {label && <Label htmlFor={id}>{label}</Label>}
            <Select value={value} onValueChange={onValueChange} disabled={disabled}>
                <SelectTrigger id={id}>
                    <SelectValue placeholder={placeholder ?? (label ? `Selecciona ${label}` : 'Selecciona una opción')} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option} value={option}>
                            {option}
                        </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value="Otro" className="font-medium text-sky-600">
                        <span className="flex items-center gap-1.5">
                            <Plus className="size-3.5" />
                            Agregar otro…
                        </span>
                    </SelectItem>
                </SelectContent>
            </Select>
            <InputError message={error} />

            {value === 'Otro' && (
                <div className="grid gap-1.5 border-l-2 border-sky-300 pl-3 dark:border-sky-500/30">
                    <Input
                        placeholder={otroPlaceholder ?? (label ? `Nombre de ${label}` : 'Escribe el valor')}
                        value={otroValue}
                        onChange={(e) => onOtroChange(e.target.value)}
                        disabled={disabled}
                    />
                    <InputError message={otroError} />
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SelectConOtro
 * Extiende SelectSimpleConOtro con un campo de archivo adjunto.
 * Lo usan EPS, AFP y ARL en el Paso 1.
 * ───────────────────────────────────────────────────────────────────────────── */

interface SelectConOtroProps extends SelectSimpleConOtroProps {
    archivoFiles: File[];
    onArchivoChange: (files: File[]) => void;
    existingDocumentos?: DocumentInfo[];
}

export function SelectConOtro({
    archivoFiles,
    onArchivoChange,
    existingDocumentos,
    ...rest
}: SelectConOtroProps) {
    return (
        <div className="grid gap-2">
            <SelectSimpleConOtro {...rest} />
            <SimpleFileField
                label={`Archivo de ${rest.label ?? rest.id}`}
                files={archivoFiles}
                existing={existingDocumentos}
                onChange={onArchivoChange}
                disabled={rest.disabled}
            />
        </div>
    );
}
