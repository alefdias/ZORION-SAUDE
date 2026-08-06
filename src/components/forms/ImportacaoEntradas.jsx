import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Download, Upload, FileSpreadsheet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

export default function ImportacaoEntradas({ open, onClose, medicamentos, fornecedores, onImport, isImporting }) {
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [errors, setErrors] = useState([]);
    const fileInputRef = useRef(null);

    const handleDownloadTemplate = async () => {
        try {
            let templateData = [];

            if (medicamentos && medicamentos.length > 0) {
                // Preenche com todos os medicamentos cadastrados
                templateData = medicamentos.map(med => ({
                    "Código Interno": med.codigo || "",
                    "Nome Medicamento (Opcional)": med.nome || "",
                    "Número do Lote": "LOTE-EXEMPLO",
                    "Data de Validade (DD/MM/AAAA)": "31/12/2026",
                    "Quantidade": "10",
                    "Valor Unitário (Opcional)": "",
                    "Nome do Fornecedor (Opcional)": "",
                    "Nota Fiscal (Opcional)": ""
                }));
            } else {
                // Planilha vazia com exemplos caso não tenha medicamentos
                templateData = [
                    {
                        "Código Interno": "Ex: MED001",
                        "Nome Medicamento (Opcional)": "Ex: Dipirona",
                        "Número do Lote": "LOTE-EXEMPLO",
                        "Data de Validade (DD/MM/AAAA)": "31/12/2026",
                        "Quantidade": "100",
                        "Valor Unitário (Opcional)": "1.50",
                        "Nome do Fornecedor (Opcional)": "Farmacêutica ABC",
                        "Nota Fiscal (Opcional)": "NF-123456"
                    }
                ];
            }

            const ws = XLSX.utils.json_to_sheet(templateData);

            // Ajustar largura das colunas
            const wscols = [
                { wch: 15 }, // Código Interno
                { wch: 30 }, // Nome Medicamento
                { wch: 18 }, // Número do Lote
                { wch: 25 }, // Data de Validade
                { wch: 15 }, // Quantidade
                { wch: 25 }, // Valor Unitário
                { wch: 30 }, // Nome do Fornecedor
                { wch: 20 }  // Nota Fiscal
            ];
            ws['!cols'] = wscols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Modelo Importação");

            // Transformar em array buffer
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

            // Abrir janela de "Salvar Como"
            const filePath = await save({
                filters: [{
                    name: 'Planilha Excel',
                    extensions: ['xlsx']
                }],
                defaultPath: "Modelo_Importacao_Entradas.xlsx"
            });

            if (filePath) {
                // Escrever arquivo direto no disco
                await writeFile(filePath, new Uint8Array(excelBuffer));
                toast.success("Planilha modelo salva com sucesso!");
            }
        } catch (error) {
            console.error("ERRO AO SALVAR:", error);
            toast.error("Erro ao salvar o arquivo: " + (error.message || String(error)));
        }
    };

    const handleFileUpload = (e) => {
        const uploadedFile = e.target.files[0];
        if (!uploadedFile) return;

        const fileExt = uploadedFile.name.split('.').pop().toLowerCase();
        if (fileExt !== 'xlsx' && fileExt !== 'csv') {
            toast.error("Por favor, envie um arquivo .xlsx ou .csv");
            return;
        }

        setFile(uploadedFile);
        parseFile(uploadedFile);
    };

    const parseFile = (fileToParse) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                validateData(rawJson);
            } catch (error) {
                console.error("Erro ao ler arquivo:", error);
                toast.error("Erro ao processar o arquivo. Verifique se o formato está correto.");
            }
        };

        reader.readAsArrayBuffer(fileToParse);
    };

    const parseDateFromExcel = (dateValue) => {
        if (!dateValue) return null;

        // Se já for uma string no formato YYYY-MM-DD
        if (typeof dateValue === 'string' && dateValue.includes('-')) {
            return dateValue;
        }

        // Se for string no formato DD/MM/YYYY
        if (typeof dateValue === 'string' && dateValue.includes('/')) {
            const parts = dateValue.split('/');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        // Se for um número (formato serial de data do Excel)
        if (typeof dateValue === 'number') {
            const excelEpoch = new Date(1899, 11, 30);
            const dateObj = new Date(excelEpoch.getTime() + dateValue * 86400000);
            return dateObj.toISOString().split('T')[0];
        }

        return null;
    };

    const validateData = (jsonRows) => {
        const parsedRows = [];
        const currentErrors = [];

        // Ignora a primeira linha se for o exemplo padrão do template
        const rowsToProcess = jsonRows.filter(row => row["Código Interno"] !== "Ex: MED001");

        rowsToProcess.forEach((row, index) => {
            const lineNum = index + 2; // +1 para cabeçalho, +1 para 1-based index (descontando linha de exemplo se houver)
            const rowErrors = [];

            const codigoInput = String(row["Código Interno"] || "").trim().toUpperCase();
            let medicamentoId = null;
            let medicamentoNome = row["Nome Medicamento (Opcional)"] || "";

            // 1. Validar Medicamento (Prioridade para Código Interno, depois tenta pelo nome exato)
            const medEnc = medicamentos.find(m => m.codigo?.toUpperCase() === codigoInput ||
                (!codigoInput && m.nome.toLowerCase() === medicamentoNome.toLowerCase())
            );

            if (medEnc) {
                medicamentoId = medEnc.id;
                medicamentoNome = medEnc.nome; // Usa o nome oficial do banco
            } else {
                rowErrors.push("Medicamento não encontrado no sistema (Código inválido/vazio)");
            }

            // 2. Lote e Validade
            const lote = String(row["Número do Lote"] || "").trim();
            if (!lote) rowErrors.push("Número do Lote obrigatório");

            const validadeRaw = row["Data de Validade (DD/MM/AAAA)"];
            const validade = parseDateFromExcel(validadeRaw);
            if (!validadeRaw || !validade) rowErrors.push("Validade inválida ou ausente (use DD/MM/AAAA)");

            // 3. Quantidade
            const qtdeStr = String(row["Quantidade"] || "").replace(',', '.');
            const qtde = parseInt(qtdeStr, 10);
            if (isNaN(qtde) || qtde <= 0) rowErrors.push("Quantidade deve ser um número maior que zero");

            // 4. Valor
            const valorStr = String(row["Valor Unitário (Opcional)"] || "").replace(',', '.');
            const valorUnit = parseFloat(valorStr) || null;
            const valorTotal = valorUnit ? (valorUnit * qtde) : null;

            // 5. Fornecedor
            const fornNomeInput = String(row["Nome do Fornecedor (Opcional)"] || "").trim();
            let fornId = null;
            let fornNome = "";

            if (fornNomeInput) {
                const fornEnc = fornecedores.find(f => f.nome.toLowerCase() === fornNomeInput.toLowerCase());
                if (fornEnc) {
                    fornId = fornEnc.id;
                    fornNome = fornEnc.nome;
                } else {
                    rowErrors.push(`Fornecedor '${fornNomeInput}' não encontrado no sistema`);
                }
            }

            const parsedRow = {
                line: lineNum,
                isValid: rowErrors.length === 0,
                errors: rowErrors,
                data: {
                    medicamento_id: medicamentoId,
                    medicamento_nome: medicamentoNome,
                    codigo_informado: codigoInput,
                    numero_lote: lote,
                    data_validade: validade,
                    quantidade: qtde,
                    valor_unitario: valorUnit,
                    valor_total: valorTotal,
                    fornecedor_id: fornId,
                    fornecedor_nome: fornNome,
                    nota_fiscal: String(row["Nota Fiscal (Opcional)"] || "").trim(),
                    data_entrada: new Date().toISOString().split("T")[0] // Adota dia da importação
                }
            };

            parsedRows.push(parsedRow);
            if (rowErrors.length > 0) currentErrors.push(parsedRow);
        });

        if (parsedRows.length === 0) {
            toast.error("Nenhum dado válido encontrado na planilha.");
        } else if (currentErrors.length > 0) {
            toast.warning(`Encontramos erros em ${currentErrors.length} linha(s).`);
        } else {
            toast.success("Todos os dados estão válidos e prontos para importação!");
        }

        setPreviewData(parsedRows);
        setErrors(currentErrors);
    };

    const handleConfirm = () => {
        const validRows = previewData.filter(r => r.isValid).map(r => {
            // Remove helper fields like codigo_informado that DB doesn't expect
            const { codigo_informado, ...pureData } = r.data;
            return pureData;
        });

        if (validRows.length === 0) {
            toast.error("Nenhuma linha válida para importar.");
            return;
        }

        onImport(validRows);
    };

    const resetState = () => {
        setFile(null);
        setPreviewData([]);
        setErrors([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetState(); } }}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        Importar Entradas via Planilha
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto space-y-6 px-1">

                    {!file ? (
                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                            <FileSpreadsheet className="w-16 h-16 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-700 mb-2">Selecione uma planilha para importar</h3>
                            <p className="text-sm text-slate-500 text-center mb-6 max-w-sm">
                                O arquivo deve conter as colunas exatas da planilha modelo (.xlsx ou .csv).
                            </p>

                            <div className="flex gap-4">
                                <Button variant="outline" onClick={handleDownloadTemplate}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Baixar Planilha Modelo
                                </Button>
                                <Button onClick={() => fileInputRef.current?.click()} className="bg-emerald-600 hover:bg-emerald-700">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Selecionar Arquivo
                                </Button>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                ref={fileInputRef}
                                accept=".xlsx, .csv"
                                onChange={handleFileUpload}
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-100 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                                    <div>
                                        <p className="font-medium text-slate-800">{file.name}</p>
                                        <p className="text-xs text-slate-500">{previewData.length} linhas lidas</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={resetState} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Remover / Trocar Arquivo
                                </Button>
                            </div>

                            {/* Alerta de Erros */}
                            {errors.length > 0 && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                                    <div>
                                        <h4 className="font-semibold text-red-800">Atenção! Foram encontrados erros na validação</h4>
                                        <p className="text-sm text-red-600 mt-1">
                                            {errors.length} linhas contém dados inválidos e <strong>não</strong> serão importadas. Corrija o arquivo e tente novamente, ou prossiga salvando apenas as linhas válidas.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {errors.length === 0 && previewData.length > 0 && (
                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                                    <div>
                                        <h4 className="font-semibold text-emerald-800">Tudo Certo!</h4>
                                        <p className="text-sm text-emerald-600 mt-1">
                                            Todos os dados estão formatados corretamente. Clique em Confirmar para inserir no sistema.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Preview Tabela */}
                            <div className="border rounded-lg overflow-hidden shrink-0">
                                <Table>
                                    <TableHeader className="bg-slate-50 sticky top-0">
                                        <TableRow>
                                            <TableHead className="w-12">Linha</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Medicamento / Código</TableHead>
                                            <TableHead>Lote</TableHead>
                                            <TableHead>Validade</TableHead>
                                            <TableHead className="text-center">Qtd</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.slice(0, 50).map((row, idx) => (
                                            <TableRow key={idx} className={row.isValid ? "bg-white" : "bg-red-50 hover:bg-red-50"}>
                                                <TableCell className="font-mono text-xs text-slate-500">{row.line}</TableCell>
                                                <TableCell>
                                                    {row.isValid ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700 border-0">Válido</Badge>
                                                    ) : (
                                                        <Badge className="bg-red-100 text-red-700 border-0">Inválido</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-sm text-slate-800">
                                                            {row.data.medicamento_nome || "Desconhecido"}
                                                        </span>
                                                        <span className="text-xs text-slate-500 font-mono">Cód: {row.data.codigo_informado || "N/A"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{row.data.numero_lote || "-"}</TableCell>
                                                <TableCell>{row.data.data_validade ? row.data.data_validade.split("-").reverse().join("/") : "-"}</TableCell>
                                                <TableCell className="text-center font-bold">{row.data.quantidade || "-"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {previewData.length > 50 && (
                                <p className="text-xs text-center text-slate-500 pt-2">
                                    Exibindo apenas as primeiras 50 linhas para pré-visualização.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-6">
                    <Button variant="outline" onClick={() => { onClose(); resetState(); }}>Cancelar</Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!file || isImporting || previewData.filter(r => r.isValid).length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        {isImporting ? "Importando..." : `Confirmar Importação (${previewData.filter(r => r.isValid).length} linhas)`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
