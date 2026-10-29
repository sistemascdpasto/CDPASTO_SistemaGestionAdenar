import { type DocumentInfo } from '@/pages/seguridad/colaboradores/colaborador-form-fields';

/**
 * Representación del colaborador tal como la envía el backend en el wizard:
 * todas las columnas del modelo (Colaborador::toArray()) más los arreglos de
 * documentos ya fusionados (columnas legacy + colaborador_documentos) bajo
 * la misma clave de documento. Como el registro puede estar a medio llenar
 * (borrador), casi todo es opcional/nullable.
 */
export type ColaboradorRecord = {
    id: number;
    estado_registro: 'borrador' | 'completo';
    wizard_step: number | null;
    [key: string]: string | number | boolean | null | DocumentInfo[] | undefined;
};

export type Paso1FormData = {
    user_id: string;
    cedula: string;
    nombres: string;
    apellidos: string;
    imagen: File | null;

    tipo_documento: string;
    tipo_documento_otro_label: string;
    expedido_en: string;
    sexo: 'femenino' | 'masculino' | '';
    fecha_nacimiento: string;
    ciudad_residencia: string;
    direccion: string;
    estrato: string;
    celular_1: string;
    celular_2: string;
    correo: string;
    estado_civil: string;
    estado_civil_otro: string;

    // Información personal
    nombre_pareja: string;
    hijos: { nombre: string; fecha_nacimiento: string; edad: string }[];

    // Contactos de emergencia
    emergencia_parentezco_1: string;
    emergencia_nombre_1: string;
    emergencia_telefono_1: string;
    emergencia_parentezco_2: string;
    emergencia_nombre_2: string;
    emergencia_telefono_2: string;

    discapacidad: 'no_aplica' | 'aplica' | '';
    discapacidad_tipo: string;
    discapacidad_observaciones: string;
    victima_conflicto: 'si' | 'no' | '';
    victima_conflicto_observaciones: string;
    libreta_militar: 'no_aplica' | 'aplica' | '';
    runt_aplica: 'no_aplica' | 'aplica' | '';

    eps: string;
    eps_otro: string;
    afp: string;
    afp_otro: string;
    arl: string;
    arl_otro: string;

    documento_tipo_identificacion: File[];
    documento_libreta_militar: File[];
    documento_eps: File[];
    documento_pension: File[];
    documento_arl: File[];
    documento_runt: File[];

    [key: string]: string | boolean | File | File[] | { nombre: string; fecha_nacimiento: string; edad: string }[] | null;
};

export type Paso2FormData = {
    ha_trabajado_antes: 'si' | 'no' | '';
    cargo_anterior: string;
    fecha_ultima_laboral: string;
    motivo_retiro: string;
    motivo_retiro_observaciones: string;

    tiene_experiencia: 'si' | 'no' | '';
    anios_experiencia: string;

    manejo_defensivo_aplica: 'no_aplica' | 'aplica' | '';
    conduccion_carga_pesada_aplica: 'no_aplica' | 'aplica' | '';
    experiencia_terreno_plano: 'si' | 'no' | '';
    experiencia_terreno_montanoso: 'si' | 'no' | '';

    documento_carnet_manejo_defensivo: File[];
    documento_certificado_manejo_defensivo: File[];
    documento_certificado_carga_pesada: File[];
    documento_certificados_terreno_plano: File[];

    [key: string]: string | File | File[] | null;
};

export type Paso3FormData = {
    area: 'Administrativa' | 'Operativa' | '';
    cargo: string;
    guardar_historial_cargo?: 'si' | 'no' | '';
    cargo_fecha_inicio: string;

    centro: string;
    centro_trabajo: string;
    fecha_ingreso_empresa: string;
    fecha_retiro_empresa: string;
    motivo_retiro: string;
    motivo_retiro_observaciones: string;
    tipo_contrato: string;
    tipo_contrato_otro: string;
    contrato_fecha_desde?: string;
    contrato_fecha_hasta?: string;

    codigo_qr_skap: string;

    vacaciones_aplica: 'no_aplica' | 'aplica' | '';
    vacaciones_fecha_desde: string;
    vacaciones_fecha_hasta: string;
    vacaciones_pagadas_fecha_desde: string;
    vacaciones_pagadas_fecha_hasta: string;

    sena_especialidad: string;
    sena_numero_grupo: string;
    sena_institucion: string;
    sena_nit: string;
    sena_centro_formacion: string;
    documento_sena_carta_presentacion: File[];

    [key: string]: string | boolean | File | File[] | null | undefined;
};

export type Paso4FormData = {
    licencia_conduccion_categorias: string[];
    fecha_licencia: string;
    fecha_vencimiento_licencia: string;
    restricciones_licencia: string;
    documento_sena_carta_presentacion: File[];

    [key: string]: string | string[] | File | File[] | null;
};

export type ReferenciaOpcion = { id: number; nombre: string };
export type InstitucionSena = { nombre: string; nit: string };
export type UsuarioVinculable = { id: number; name: string; identification_number: string };
