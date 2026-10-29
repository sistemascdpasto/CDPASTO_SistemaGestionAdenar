import InputError from '@/components/input-error';
import { cn } from '@/lib/utils';
import { type DocumentInfo } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { FileText, Paperclip, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';

interface SimpleFileFieldProps {
    label?: string;
    files: File[];
    existing?: DocumentInfo[];
    onRemoveExisting?: (index: number) => void;
    onChange: (files: File[]) => void;
    error?: string;
    disabled?: boolean;
    multiple?: boolean;
}

export function SimpleFileField({ label, files, existing = [], onRemoveExisting, onChange, error, disabled, multiple = true }: SimpleFileFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nuevos = Array.from(e.target.files ?? []);
        onChange(multiple ? [...files, ...nuevos] : nuevos.slice(0, 1));
        if (inputRef.current) inputRef.current.value = '';
    };

    const removeFile = (index: number) => {
        onChange(files.filter((_, i) => i !== index));
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDragging(false);

        if (disabled) return;

        const droppedFiles = Array.from(e.dataTransfer.files ?? []);
        if (droppedFiles.length === 0) return;

        onChange(multiple ? [...files, ...droppedFiles] : droppedFiles.slice(0, 1));
    };

    return (
        <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
                'grid gap-1.5 rounded-xl transition-all duration-200',
                isDragging
                    ? 'border-2 border-dashed border-emerald-500 bg-emerald-50/80 p-2.5 shadow-xs dark:border-emerald-400 dark:bg-emerald-500/10'
                    : 'border border-transparent'
            )}
        >
            {label && (
                <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    {isDragging && (
                        <span className="text-[11px] font-semibold text-emerald-700 animate-pulse dark:text-emerald-300">
                            ¡Suelta los archivos aquí!
                        </span>
                    )}
                </div>
            )}
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                multiple={multiple}
                className="hidden"
                onChange={handleChange}
                disabled={disabled}
            />
            <div className="flex flex-wrap items-center gap-1.5">
                {existing.map((doc, index) => {
                    const url = doc.path.startsWith('http://') || doc.path.startsWith('https://') || doc.path.startsWith('/storage/') || doc.path.startsWith('/')
                        ? doc.path
                        : `/storage/${doc.path}`;
                    const rawName = doc.name || doc.path.split('/').pop() || 'Archivo PDF';
                    const cleanName = rawName.replace(/^\d{10,}_/, '');
                    const displayName = cleanName.length >= 35 && !cleanName.includes(' ') && !cleanName.includes('-') && !cleanName.includes('_')
                        ? 'Documento_adjunto.pdf'
                        : cleanName;
                    return (
                        <span
                            key={`existing-${index}`}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                        >
                            <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 hover:underline"
                                title="Ver archivo actual"
                            >
                                <FileText className="size-3" />
                                {displayName} (Ver PDF)
                            </a>
                            {onRemoveExisting && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveExisting(index);
                                    }}
                                    disabled={disabled}
                                    className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-primary/20"
                                    aria-label={`Quitar ${displayName}`}
                                    title="Quitar archivo"
                                >
                                    <X className="size-3 text-primary" />
                                </button>
                            )}
                        </span>
                    );
                })}
                {files.map((file, index) => (
                    <span key={`new-${index}`} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <FileText className="size-3" />
                        {file.name}
                        <button type="button" onClick={() => removeFile(index)} disabled={disabled} aria-label={`Quitar ${file.name}`}>
                            <X className="size-3" />
                        </button>
                    </span>
                ))}
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    disabled={disabled}
                    className={cn(
                        'inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-[11px] transition-all disabled:opacity-50',
                        isDragging
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm scale-105'
                            : 'border-border text-muted-foreground hover:border-emerald-300 hover:text-foreground'
                    )}
                >
                    {isDragging ? (
                        <>
                            <Upload className="size-3 animate-bounce" />
                            Soltar archivo aquí
                        </>
                    ) : (
                        <>
                            <Paperclip className="size-3" />
                            Adjuntar archivo
                        </>
                    )}
                </button>
            </div>
            {error && <InputError message={error} />}
        </div>
    );
}
