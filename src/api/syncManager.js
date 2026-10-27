import { invoke } from "@tauri-apps/api/core";

export function useSyncStatus() {
    return {
        isSyncing: false,
        pendingCount: 0,
        isOnline: true,
        initMode: "nuvem"
    };
}
export async function sync() {}
export function scheduleSyncAfterWrite() {}
export async function getPendingDetails() { return []; }
export function getLastSync() { return new Date().toISOString(); }
export async function initializeApp() { 
    try {
        const ip = localStorage.getItem("pg_ip");
        const dbName = localStorage.getItem("pg_db");
        const password = localStorage.getItem("pg_pass");
        if (ip && password) {
            const query = `
                CREATE TABLE IF NOT EXISTS "TransferenciaPendente" (
                    "id" TEXT PRIMARY KEY,
                    "medicamento_id" TEXT,
                    "medicamento_nome" TEXT,
                    "lote_id" TEXT,
                    "numero_lote" TEXT,
                    "quantidade" INTEGER,
                    "direcao" TEXT,
                    "status" TEXT,
                    "data_solicitacao" TEXT,
                    "data_aceite" TEXT,
                    "deleted_at" TEXT
                );
                CREATE TABLE IF NOT EXISTS "PedidoSatelite" (
                    "id" TEXT PRIMARY KEY,
                    "codigo" TEXT,
                    "ala_id" TEXT,
                    "ala_nome" TEXT,
                    "dias_calculados" INTEGER,
                    "solicitante" TEXT,
                    "data_solicitacao" TEXT,
                    "status" TEXT,
                    "data_separacao" TEXT,
                    "data_entrega" TEXT,
                    "data_recebimento" TEXT,
                    "itens_json" TEXT,
                    "observacao" TEXT,
                    "created_at" TEXT,
                    "deleted_at" TEXT
                );
                ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "saida_gerada" INTEGER DEFAULT 0;
                ALTER TABLE "TransferenciaPendente" ADD COLUMN IF NOT EXISTS "pedido_id" TEXT;
                ALTER TABLE "TransferenciaPendente" ADD COLUMN IF NOT EXISTS "pedido_codigo" TEXT;
                ALTER TABLE "TransferenciaPendente" ADD COLUMN IF NOT EXISTS "origem" TEXT;
                ALTER TABLE "TransferenciaPendente" ADD COLUMN IF NOT EXISTS "observacao" TEXT;
                ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "responsavel" TEXT;
                ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "responsavel_crf" TEXT;
                ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "usuario_nome" TEXT;
                ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "usuario_id" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "responsavel" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "responsavel_crf" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "usuario_nome" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "usuario_id" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "baixa_grupo_id" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "is_baixa_lote_paciente" BOOLEAN DEFAULT false;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "dias_cobertura" INTEGER;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "data_inicio_cobertura" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "data_fim_cobertura" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "dose_diaria" NUMERIC;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "prescricao_id" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "paciente_id" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "paciente_nome" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "ala_id" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "ala_nome" TEXT;
                ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "origem" TEXT;
                ALTER TABLE "Saida" ALTER COLUMN "lote_id" DROP NOT NULL;

                ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "ciclo_coberto_ate" TEXT;
                ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "ultimo_ciclo_dias" INTEGER;
                ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "data_ultimo_ciclo" TEXT;
                ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "data_ultimo_ajuste_ciclo" TEXT;

                ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "coberto_ate" TEXT;
                ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "ultimo_lote_dias" INTEGER;
                ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "data_ultima_dispensacao" TEXT;
                ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "dose_diaria_dispensada" NUMERIC;
                ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "quantidade_ultimo_lote" INTEGER;

                ALTER TABLE "Lote" ADD COLUMN IF NOT EXISTS "quantidade_satelite" INTEGER DEFAULT 0;
                ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "estoque_satelite" INTEGER DEFAULT 0;

                CREATE TABLE IF NOT EXISTS "Auditoria" (
                    "id" TEXT PRIMARY KEY,
                    "acao" TEXT,
                    "entidade" TEXT,
                    "entidade_id" TEXT,
                    "detalhes" TEXT,
                    "usuario" TEXT,
                    "data_hora" TEXT,
                    "created_at" TEXT
                );
            `;
            await invoke("execute_postgres", { ip, dbName, password, query });

            // Limpeza definitiva de metades do banco de dados
            try {
                await invoke("execute_postgres", {
                    ip, dbName, password,
                    query: `
                        DELETE FROM "GavetaPaciente";
                        UPDATE "PrescricaoPaciente" 
                        SET "totalDiario" = ROUND("totalDiario") 
                        WHERE "totalDiario" IS NOT NULL AND ("totalDiario"::numeric % 1) != 0;
                    `
                });
            } catch (e) {
                console.warn("[syncManager] Limpeza metades:", e);
            }

            // Migrate R2 patients once
            if (!localStorage.getItem("migrated_patients_r2")) {
                try {
                    const pacientesR2 = [
                        { prontuario: "13841", idade: 13, nome: "PAULO HENRIQUE MATHEUS" },
                        { prontuario: "13088", idade: 14, nome: "OTÁVIO AUGUSTO DE ARAUJO DE CAMARGO" },
                        { prontuario: "13799", idade: 15, nome: "LUIZ FELIPE CAMPOS DE LIMA" },
                        { prontuario: "13839", idade: 15, nome: "TALES HENRIQUE GOMES FIGUEIRA" },
                        { prontuario: "13617", idade: 16, nome: "JOÃO YURI PEREIRA FILHO" },
                        { prontuario: "12762", idade: 16, nome: "BRUNO EZEQUIEL RIBEIRO" },
                        { prontuario: "12721", idade: 16, nome: "CARLOS EDUARDO STABILE FERNANDES" },
                        { prontuario: "13701", idade: 17, nome: "EZEQUIEL DOS SANTOS OLIVEIRA" },
                        { prontuario: "13106", idade: 17, nome: "MIGUEL HENRIQUE DA SILVA FIGUEREDO" },
                        { prontuario: "13806", idade: 17, nome: "GUILHERME SOUZA E SILVA" },
                        { prontuario: "13826", idade: 17, nome: "NICOLAS FELISBERTO FERNANDES" },
                        { prontuario: "13832", idade: 17, nome: "GUILHERME HENRIQUE PALOMO" },
                        { prontuario: "13393", idade: 17, nome: "VITOR EDUARDO PAULO DA SILVA" },
                        { prontuario: "13107", idade: 18, nome: "VITOR GABRIEL CARDOZO DE SALES" }
                    ];

                    const alasQuery = `SELECT * FROM "Ala" WHERE "nome" LIKE '%R2%'`;
                    const alas = await invoke("query_postgres", { ip, dbName, password, query: alasQuery });
                    let alaId = null;
                    let alaNome = "R2";
                    
                    if (alas && alas.length > 0) {
                        alaId = alas[0].id;
                        alaNome = alas[0].nome;
                    }

                    for (const p of pacientesR2) {
                        const checkQuery = `SELECT * FROM "Paciente" WHERE "prontuario" = '${p.prontuario}'`;
                        const existing = await invoke("query_postgres", { ip, dbName, password, query: checkQuery });
                        if (!existing || existing.length === 0) {
                            const id = crypto.randomUUID();
                            const insertQuery = `
                                INSERT INTO "Paciente" 
                                ("id", "nome", "prontuario", "idade", "alaId", "alaNome", "status", "created_at") 
                                VALUES 
                                ('${id}', '${p.nome}', '${p.prontuario}', '${p.idade}', ${alaId ? `'${alaId}'` : 'NULL'}, '${alaNome}', 'Ativo', CURRENT_TIMESTAMP)
                            `;
                            await invoke("execute_postgres", { ip, dbName, password, query: insertQuery });
                        }
                    }
                    localStorage.setItem("migrated_patients_r2", "true");
                    console.log("Pacientes da Ala R2 migrados com sucesso.");
                } catch (err) {
                    console.error("Erro ao migrar pacientes R2", err);
                }
            }
            
            // Start PostgreSQL listen/notify loop
            try {
                await invoke("start_db_listener", { ip, dbName, password });
            } catch (err) {
                console.warn("DB Listener não suportado/iniciado:", err);
            }
        }
    } catch (e) {
        console.error("Erro ao criar TransferenciaPendente/Migrar Pacientes:", e);
    }
    return { mode: "nuvem", counts: {} }; 
}
export function initSyncManager() {}
export function subscribeToSyncStatus(listener) {
    return () => {};
}
