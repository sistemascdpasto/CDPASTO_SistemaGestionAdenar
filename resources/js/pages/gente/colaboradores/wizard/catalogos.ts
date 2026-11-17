export type DocumentoFieldDef = {
    key: string;
    label: string;
    grupo: string;
    pasos: number[];
};

export type WizardCatalogos = {
    tiposDocumento: string[];
    estadosCiviles: string[];
    epsOpciones: string[];
    afpOpciones: string[];
    arlOpciones: string[];
    areasOpciones: string[];
    cargos: string[];
    perfilesCargos: Record<string, string>;
    centros: string[];
    centrosTrabajo: string[];
    centrosOpciones: string[];
    centrosTrabajOpciones: string[];
    tiposContrato: string[];
    motivosRetiro: string[];
    licenciaCategorias: string[];
    documentoGrupos: string[];
    documentoFields: DocumentoFieldDef[];
};
