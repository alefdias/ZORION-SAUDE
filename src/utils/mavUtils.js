/**
 * Utilitário para identificação de Medicamentos de Alta Vigilância (MAV)
 * e Controle Especial (Portaria 344/98 da Anvisa)
 */

const MAV_KEYWORDS = [
    "POTASSIO", "POTÁSSIO", "SODIO 20%", "SÓDIO 20%", "ENOXAPARINA",
    "HEPARINA", "RIVAROXABANA", "INSULINA", "GLIBENCLAMIDA", "GLICAZIDA",
    "METFORMINA", "MORFINA", "TRAMADOL", "DIAZEPAM", "MIDAZOLAN", "MIDAZOLAM",
    "ADRENALINA", "DOPAMINA", "AMIODARONA"
];

/**
 * Verifica se o nome/objeto do medicamento indica que ele é um MAV
 * @param {string|object} medOrName
 * @returns {boolean}
 */
export function isMav(medOrName) {
    if (!medOrName) return false;
    if (typeof medOrName === 'object') {
        if (medOrName.is_mav !== undefined && medOrName.is_mav !== null) {
            return Boolean(medOrName.is_mav);
        }
        return isMav(medOrName.nome || medOrName.principio_ativo);
    }
    const nomeUpper = String(medOrName).toUpperCase();
    return MAV_KEYWORDS.some(keyword => nomeUpper.includes(keyword));
}

// ── Listas de Substâncias da Portaria 344/98 ──

const ENTORPECENTES_A = [
    "MORFINA", "TRAMADOL", "TRAMAL", "METADONA", "FENTANILA", "FENTANIL",
    "SUFENTANILA", "SUFENTANIL", "ALFENTANILA", "REMIFENTANILA", "REMIFENTANIL",
    "BUPRENORFINA", "OXICODONA", "CODEINA", "CODEÍNA", "PETIDINA", "MEPERIDINA",
    "HIDROMORFONA", "TAPENTADOL", "NALBUFINA", "NALEBUFINA", "CANNABIS", "CANNABIDIOL"
];

const PSICOTROPICOS_B = [
    "ALPRAZOLAM", "ALPRAZOLAN", "BROMAZEPAM", "BROMAZEPAN", "CLOBAZAM", "CLOBAZAN",
    "CLONAZEPAM", "CLONAZEPAN", "DIAZEPAM", "DIAZEPAN", "LORAZEPAM", "LORAZEPAN",
    "MIDAZOLAM", "MIDAZOLAN", "NITRAZEPAM", "NITRAZEPAN", "FLURAZEPAM", "ESTAZOLAM",
    "TRIAZOLAM", "ZOLPIDEM", "ZOPICLONA", "ESZOPICLONA", "ZALEPLONA", "FENOBARBITAL",
    "GARDENAL", "TIOPENTAL", "METILFENIDATO", "RITALINA", "CONCERTA",
    "LISDEXANFETAMINA", "VENVANSE", "DEXANFETAMINA", "SIBUTRAMINA", "FEMPROPOREX",
    "ANFEPRAMONA", "MAZINDOL"
];

const IMUNOSSUPRESSORES_C3 = [
    "TALIDOMIDA", "LENALIDOMIDA", "POMALIDOMIDA",
    "CICLOSPORINA", "TACROLIMO", "TACROLIMUS", "SIROLIMO", "SIROLIMUS", "EVEROLIMO", "EVEROLIMUS",
    "AZATIOPRINA", "MICOFENOLATO", "MYCOPHENOLATE", "LEFLUNOMIDA", "METOTREXATO", "METHOTREXATE",
    "INFLIXIMABE", "ADALIMUMABE", "RITUXIMABE", "TOCILIZUMABE", "ETANERCEPTE", "ABATACEPTE",
    "USTEQUINUMABE", "TOFACITINIBE", "BARICITINIBE", "BASILIXIMABE", "ANAKINRA",
    "CERTOLIZUMABE", "GOLIMUMABE", "VEDOLIZUMABE", "NATALIZUMABE", "IMUNOSSUPRESSOR"
];

const RETINOIDES_C2 = [
    "ISOTRETINOINA", "ISOTRETINOÍNA", "ROACUTAN", "ACITRETINA", "TRETINOINA", "TRETINOÍNA"
];

const ANTIRRETROVIRAIS_C4 = [
    "ZIDOVUDINA", "LAMIVUDINA", "EFAVIRENZ", "TENOFOVIR", "DOLUTEGRAVIR",
    "ATAZANAVIR", "DARUNAVIR", "RITONAVIR", "ABACAVIR", "NEVIRAPINA"
];

const ANABOLIZANTES_C5 = [
    "TESTOSTERONA", "NANDROLONA", "DECA-DURABOLIN", "STANOZOLOL", "OXANDROLONA", "MESTEROLONA"
];

const CONTROLADOS_C1 = [
    "RISPERIDONA", "HALOPERIDOL", "HALDOL", "QUETIAPINA", "OLANZAPINA", "CLOZAPINA",
    "ARIPIPRAZOL", "ZIPRASIDONA", "SULPIRIDA", "LEVOMEPROMAZINA", "CLORPROMAZINA",
    "TIORIDAZINA", "PALIPERIDONA", "AMISULPRIDA", "AMITRIPTILINA", "NORTRIPTILINA",
    "CLOMIPRAMINA", "IMIPRAMINA", "FLUOXETINA", "SERTRALINA", "ESCITALOPRAM",
    "CITALOPRAM", "PAROXETINA", "VENLAFAXINA", "DESVENLAFAXINA", "DULOXETINA",
    "BUPROPIONA", "MIRTAZAPINA", "TRAZODONA", "VORTIOXETINA", "CARBAMAZEPINA",
    "OXCARBAZEPINA", "VALPROATO", "VALPROICO", "DIVALPROATO", "LAMOTRIGINA",
    "TOPIRAMATO", "GABAPENTINA", "PREGABALINA", "LEVETIRACETAM", "VIGABATRINA",
    "PRIMIDONA", "KETAMINA", "CETAMINA", "LITIO", "LÍTIO", "MEMANTINA",
    "DONEPEZILA", "RIVASTIGMINA", "PROPOFOL"
];

/**
 * Verifica se o medicamento é Psicotrópico / Sujeito a Controle Especial (Portaria 344/98)
 * @param {string|object} grupoOrMed
 * @returns {boolean}
 */
export function isPsicotropico(grupoOrMed) {
    if (!grupoOrMed) return false;
    let text = "";
    if (typeof grupoOrMed === 'object') {
        if (grupoOrMed.portaria_344) return true;
        text = [grupoOrMed.grupo_terapeutico, grupoOrMed.categoria, grupoOrMed.nome, grupoOrMed.principio_ativo].filter(Boolean).join(" ").toUpperCase();
    } else {
        text = String(grupoOrMed).toUpperCase();
    }

    if (text.includes("PSICOTRÓPICO") || text.includes("PSICOTROPICO") || text.includes("CONTROLADO") || text.includes("PORTARIA 344") || text.includes("IMUNOSSUPRESSOR") || text.includes("C3")) {
        return true;
    }

    const allControlled = [
        ...ENTORPECENTES_A,
        ...PSICOTROPICOS_B,
        ...IMUNOSSUPRESSORES_C3,
        ...RETINOIDES_C2,
        ...ANTIRRETROVIRAIS_C4,
        ...ANABOLIZANTES_C5,
        ...CONTROLADOS_C1
    ];

    return allControlled.some(item => text.includes(item));
}

/**
 * Retorna a Lista exata da Portaria 344/98 baseada no nome/dados do medicamento.
 * @param {string|object} medOrName
 * @returns {string}
 */
export function getPortaria344List(medOrName) {
    if (!medOrName) return "Outros Controlados";
    let n = "";
    let grupo = "";
    if (typeof medOrName === 'object') {
        n = (medOrName.nome || medOrName.principio_ativo || "").toUpperCase();
        grupo = (medOrName.grupo_terapeutico || medOrName.categoria || "").toUpperCase();
    } else {
        n = String(medOrName).toUpperCase();
    }

    // 1. Imunossupressores (Lista C3)
    if (IMUNOSSUPRESSORES_C3.some(m => n.includes(m)) || grupo.includes("IMUNOSSUPRESSOR") || grupo.includes("C3")) {
        return "Imunossupressores (Lista C3)";
    }

    // 2. Entorpecentes (Listas A1 e A2)
    if (ENTORPECENTES_A.some(m => n.includes(m))) {
        return "Entorpecentes (Listas A1 e A2)";
    }

    // 3. Psicotrópicos (Listas A3, B1 e B2)
    if (PSICOTROPICOS_B.some(m => n.includes(m)) || grupo.includes("PSICOTRÓPICO") || grupo.includes("PSICOTROPICO")) {
        return "Psicotrópicos (Listas A3, B1 e B2)";
    }

    // 4. Controle Especial (Listas C1, C2, C4 e C5)
    if (CONTROLADOS_C1.some(m => n.includes(m)) || RETINOIDES_C2.some(m => n.includes(m)) || ANTIRRETROVIRAIS_C4.some(m => n.includes(m)) || ANABOLIZANTES_C5.some(m => n.includes(m))) {
        return "Controle Especial (Listas C1, C2, C4 e C5)";
    }

    return "Outros Controlados";
}
