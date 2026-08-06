import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { addDays, differenceInDays, isAfter } from 'date-fns';

const LICENSE_KEY_LOCAL = 'axion_license_key';
const MACHINE_ID_LOCAL = 'axion_machine_id';
const LAST_VALIDATION_LOCAL = 'axion_last_validation';

// Obter ou criar um ID persistente para este computador
export function getMachineId() {
  let machineId = localStorage.getItem(MACHINE_ID_LOCAL);
  if (!machineId) {
    machineId = uuidv4();
    localStorage.setItem(MACHINE_ID_LOCAL, machineId);
  }
  return machineId;
}

// Obter a chave salva localmente
export function getSavedLicenseKey() {
  return localStorage.getItem(LICENSE_KEY_LOCAL);
}

// Verifica a licença no Supabase (Online)
// Formato da chave gerada pelo gerador-key: AXION-XXXX-XXXX-XXXX
// Retorna: { valid: boolean, message: string, data?: any }
export async function validateLicenseOnline(serialKey) {
  try {
    const { data: records, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('id', serialKey)
      .limit(1);

    if (error || !records || records.length === 0) {
      return { valid: false, message: 'Chave de licença inválida ou não encontrada.' };
    }

    const data = records[0];
    const now = new Date();

    // Verificar se a licença foi revogada
    if (data.status === 'revoked') {
      return { valid: false, message: 'Esta licença foi revogada.' };
    }

    // 1. Verifica se expirou (se tiver expiresAt)
    if (data.expiresAt) {
      const expiryDate = new Date(data.expiresAt);
      if (isAfter(now, expiryDate)) {
        return { valid: false, message: 'Esta licença expirou.' };
      }
    }

    // 2. Verifica se a máquina já está registrada
    const machineId = getMachineId();
    let usedComputers = data.usedComputers || [];

    if (!usedComputers.includes(machineId)) {
      // Máquina nova tentando usar a chave
      if (usedComputers.length >= (data.maxComputers || 1)) {
        return { valid: false, message: 'Limite de computadores excedido para esta chave.' };
      }
      // Registra a máquina
      usedComputers.push(machineId);
      
      const { error: updateError } = await supabase
        .from('licenses')
        .update({ usedComputers })
        .eq('id', serialKey);
        
      if (updateError) {
         console.error('Erro ao atualizar licença', updateError);
      }
    }

    // Sucesso - Salva os dados locais para validação offline
    localStorage.setItem(LICENSE_KEY_LOCAL, serialKey);
    localStorage.setItem(LAST_VALIDATION_LOCAL, now.toISOString());
    
    // Guarda no localStorage também os limites para uso offline
    localStorage.setItem('axion_offline_limit', data.offlineDaysLimit?.toString() || '15');
    if (data.expiresAt) {
      const expiryDate = new Date(data.expiresAt);
      localStorage.setItem('axion_license_expiry', expiryDate.toISOString());
    } else {
      localStorage.removeItem('axion_license_expiry'); // Vitalício
    }

    return { valid: true, message: 'Licença ativada com sucesso!', data };

  } catch (error) {
    console.error("Erro ao validar licença online:", error);
    // Se der erro de rede, tenta validar offline (fallback)
    return validateLicenseOffline();
  }
}

// Verifica a licença baseada no estado local (Offline)
export function validateLicenseOffline() {
  const serialKey = getSavedLicenseKey();
  const lastValidationStr = localStorage.getItem(LAST_VALIDATION_LOCAL);
  const offlineLimitStr = localStorage.getItem('axion_offline_limit') || '15';
  const expiryStr = localStorage.getItem('axion_license_expiry');

  if (!serialKey || !lastValidationStr) {
    return { valid: false, message: 'Nenhuma licença ativa encontrada neste computador.', requireKey: true };
  }

  const lastValidation = new Date(lastValidationStr);
  const now = new Date();

  // 1. Verificar expiração absoluta da chave
  if (expiryStr) {
    const expiryDate = new Date(expiryStr);
    if (isAfter(now, expiryDate)) {
      return { valid: false, message: 'Sua licença expirou.', requireKey: true };
    }
  }

  // 2. Verificar limite de dias offline
  const offlineDaysLimit = parseInt(offlineLimitStr, 10);
  const daysSinceLastValidation = differenceInDays(now, lastValidation);

  if (daysSinceLastValidation > offlineDaysLimit) {
    return { 
      valid: false, 
      message: `Tempo máximo sem internet (${offlineDaysLimit} dias) excedido. Conecte à internet para revalidar.`,
      requireInternet: true
    };
  }

  return { valid: true, message: 'Licença local validada com sucesso.' };
}

// Função utilitária para gerar nova chave (chamada na tela de admin do Axion)
// Usa o MESMO formato do gerador-key externo
export async function generateLicenseKey(planName, months, maxComputers, offlineDaysLimit) {
  const raw = `${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`.replace(/[^A-Z0-9]/g, 'X');
  const key = `AXION-${raw.substring(0,4)}-${raw.substring(4,8)}-${raw.substring(8,12)}`;

  const licenseData = {
    id: key,
    key,
    plan: planName,
    months: parseInt(months, 10),
    maxComputers: parseInt(maxComputers, 10),
    offlineDaysLimit: parseInt(offlineDaysLimit, 10),
    usedComputers: [],
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  const { error } = await supabase
    .from('licenses')
    .insert(licenseData);
    
  if (error) {
    console.error("Erro ao gerar licença", error);
    throw error;
  }

  return licenseData;
}

export function removeLocalLicense() {
  localStorage.removeItem(LICENSE_KEY_LOCAL);
  localStorage.removeItem(LAST_VALIDATION_LOCAL);
  localStorage.removeItem('axion_offline_limit');
  localStorage.removeItem('axion_license_expiry');
}
