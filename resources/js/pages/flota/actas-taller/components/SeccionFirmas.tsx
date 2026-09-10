import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone } from 'lucide-react';
import { FirmaPad, type FirmaPadHandle } from '../firma-pad';

// ─── Modo edición (create / show editable) ────────────────────────────────────

interface EditProps {
    mode: 'edit';
    nombreEntrega: string;
    onNombreEntrega: (v: string) => void;
    nombreRecibe: string;
    onNombreRecibe: (v: string) => void;
    firmaEntregaRef: React.RefObject<FirmaPadHandle | null>;
    firmaRecibeRef:  React.RefObject<FirmaPadHandle | null>;
    errors?: Record<string, string>;
}

// ─── Modo lectura (show) ──────────────────────────────────────────────────────

interface ReadProps {
    mode: 'read';
    nombreEntrega?:   string | null;
    cargoEntrega?:    string | null;
    idEntrega?:       string | null;
    telefonoEntrega?: string | null;
    firmaEntrega?:    string | null;
    nombreRecibe?:    string | null;
    cargoRecibe?:     string | null;
    firmaRecibe?:     string | null;
}

type Props = EditProps | ReadProps;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FirmaSlot({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <div className="grid gap-3">
            <p className="text-[11px] font-semibold text-muted-foreground">{titulo}</p>
            {children}
        </div>
    );
}

function CampoFirma({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid gap-1.5">
            <Label className="text-xs font-medium text-foreground">{label}</Label>
            {children}
        </div>
    );
}

function FirmaImagen({ src, nombre, cargo, identificacion, telefono }: {
    src?: string | null; nombre?: string | null; cargo?: string | null;
    identificacion?: string | null; telefono?: string | null;
}) {
    return (
        <>
            {(nombre || cargo) && (
                <div className="grid gap-0.5">
                    <p className="text-sm font-semibold text-foreground">{nombre ?? '—'}</p>
                    {cargo         && <p className="text-[11px] text-muted-foreground">{cargo}</p>}
                    {identificacion && <p className="text-[11px] text-muted-foreground">C.C. {identificacion}</p>}
                    {telefono      && <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Phone className="size-3" /> {telefono}</p>}
                </div>
            )}
            {src ? (
                <img src={src} alt="Firma"
                    className="h-[150px] w-full max-w-[400px] rounded-md border border-input bg-white object-contain" />
            ) : (
                <div className="flex h-[150px] w-full max-w-[400px] items-center justify-center rounded-md border border-dashed border-input bg-white">
                    <p className="text-xs text-muted-foreground">Sin firma</p>
                </div>
            )}
        </>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SeccionFirmas(props: Props) {
    if (props.mode === 'edit') {
        const {
            nombreEntrega, onNombreEntrega,
            nombreRecibe, onNombreRecibe,
            firmaEntregaRef, firmaRecibeRef, errors = {},
        } = props;

        return (
            <div className="grid gap-8 sm:grid-cols-2">

                {/* ── Entrega en el taller ── */}
                <FirmaSlot titulo="Entrega en el taller">
                    <FirmaPad ref={firmaEntregaRef} label="Firma (opcional)" fileName="firma_entrega.png" />
                    <CampoFirma label="Nombre">
                        <Input value={nombreEntrega} onChange={e => onNombreEntrega(e.target.value)}
                            className="h-9 text-sm" placeholder="Nombre completo..." />
                        {errors['nombre_entrega'] && <p className="text-[11px] text-red-500">{errors['nombre_entrega']}</p>}
                    </CampoFirma>
                </FirmaSlot>

                {/* ── Recibe (técnico del taller) ── */}
                <FirmaSlot titulo="Recibe (técnico del taller)">
                    <FirmaPad ref={firmaRecibeRef} label="Firma (opcional)" fileName="firma_recibe.png" />
                    <CampoFirma label="Nombre del técnico">
                        <Input value={nombreRecibe} onChange={e => onNombreRecibe(e.target.value)}
                            className="h-9 text-sm" placeholder="Nombre completo del técnico externo..." />
                        {errors['nombre_recibe'] && <p className="text-[11px] text-red-500">{errors['nombre_recibe']}</p>}
                    </CampoFirma>
                </FirmaSlot>

            </div>
        );
    }

    // mode === 'read'
    const { nombreEntrega, cargoEntrega, idEntrega, telefonoEntrega, firmaEntrega,
            nombreRecibe, cargoRecibe, firmaRecibe } = props;
    return (
        <div className="grid gap-6 sm:grid-cols-2">
            <FirmaSlot titulo="Entrega en el taller">
                <FirmaImagen
                    src={firmaEntrega}
                    nombre={nombreEntrega}
                    cargo={cargoEntrega}
                    identificacion={idEntrega}
                    telefono={telefonoEntrega}
                />
            </FirmaSlot>
            <FirmaSlot titulo="Recibe (técnico del taller)">
                <FirmaImagen src={firmaRecibe} nombre={nombreRecibe} cargo={cargoRecibe} />
            </FirmaSlot>
        </div>
    );
}
