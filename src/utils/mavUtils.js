/**
 * Utilitário para identificação de Medicamentos de Alta Vigilância (MAV)
 */

const MAV_KEYWORDS = [
    "POTASSIO",
    "POTÁSSIO",
    "SODIO 20%",
    "SÓDIO 20%",
    "ENOXAPARINA",
    "HEPARINA",
    "RIVAROXABANA",
    "INSULINA",
    "GLIBENCLAMIDA",
    "GLICAZIDA",
    "METFORMINA",
    "MORFINA",
    "TRAMADOL",
    "DIAZEPAM",
    "MIDAZOLAN",
    "ADRENALINA",
    "DOPAMINA",
    "AMIODARONA"
];

/**
 * Verifica se o nome do medicamento indica que ele é um Medicamento de Alta Vigilância (MAV)
 * @param {string} nome - Nome do medicamento
 * @returns {boolean} - Retorna true se for MAV
 */
export function isMav(medOrName) {
    if (!medOrName) return false;
    if (typeof medOrName === 'object') {
        if (medOrName.is_mav !== undefined && medOrName.is_mav !== null) {
            return Boolean(medOrName.is_mav);
        }
        return isMav(medOrName.nome);
    }
    const nomeUpper = String(medOrName).toUpperCase();
    return MAV_KEYWORDS.some(keyword => nomeUpper.includes(keyword));
}

/**
 * Verifica se a categoria do medicamento indica que ele é Psicotrópico/Controlado
 * (Portaria 344/98) que exige dados do paciente.
 * @param {string} categoria - Categoria do medicamento
 * @returns {boolean} - Retorna true se for Psicotrópico
 */
export function isPsicotropico(categoria) {
    if (!categoria) return false;
    return categoria.toUpperCase().startsWith("PSICOTRÓPICO");
}

/**
 * Retorna a Lista da Portaria 344/98 baseada no nome do medicamento.
 * @param {string} nome - Nome do medicamento
 * @returns {string} - O nome da lista ou "Outros Controlados"
 */
export function getPortaria344List(nome) {
    if (!nome) return "Outros Controlados";
    const n = nome.toUpperCase();

    // Entorpecentes (Listas A1 e A2)
    if (n.includes("MORFINA") || n.includes("TRAMADOL") || n.includes("METADONA") || n.includes("FENTANILA") || n.includes("BUPRENORFINA") || n.includes("OXICODONA")) {
        return "Entorpecentes (Listas A1 e A2)";
    }

    // Psicotrópicos (Listas A3, B1 e B2)
    const b1Meds = ["ALPRAZOLAN", "ALPRAZOLAM", "BROMAZEPAN", "BROMAZEPAM", "CLOBAZAN", "CLOBAZAM", "CLONAZEPAM", "CLONAZEPAN", "DIAZEPAM", "DIAZEPAN", "LORAZEPAN", "LORAZEPAM", "MIDAZOLAN", "MIDAZOLAM", "NITRAZEPAN", "NITRAZEPAM", "ZOLPIDEM", "FLURAZEPAM"];
    if (b1Meds.some(m => n.includes(m))) {
        return "Psicotrópicos (Listas A3, B1 e B2)";
    }

    // Imunossupressores (Lista C3)
    const c3Meds = ["TALIDOMIDA", "LENALIDOMIDA", "POMALIDOMIDA"];
    if (c3Meds.some(m => n.includes(m))) {
        return "Imunossupressores (Lista C3)";
    }

    // Controle Especial (Listas C1, C2, C4 e C5)
    // Se for psicotrópico e não caiu nas outras, é C1 por padrão
    return "Controle Especial (Listas C1, C2, C4 e C5)";
}
