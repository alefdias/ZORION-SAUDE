import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function RelatorioTable({ data = [], columns = [] }) {
    if (data.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                Nenhum dado encontrado para o relatório selecionado.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        {columns.map((col, i) => (
                            <TableHead key={i}>{col.label || col.key}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row, i) => (
                        <TableRow key={i} className="hover:bg-slate-50/50">
                            {columns.map((col, j) => (
                                <TableCell key={j}>{col.render ? col.render(row[col.key], row) : row[col.key]}</TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
