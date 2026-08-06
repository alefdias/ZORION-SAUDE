$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$file = Get-ChildItem "C:\Users\CAIS 10\Downloads\AXION-HOSPITALAR-COMPLETO-main\AXION-HOSPITALAR-COMPLETO-main\AXION-HOSPITALAR-COMPLETO\*.xls" | Where-Object { $_.Name -like "*2026 e 2027*" } | Select-Object -First 1
$workbook = $excel.Workbooks.Open($file.FullName)
$meds = @()
foreach ($sheet in $workbook.Sheets) {
    $usedRange = $sheet.UsedRange
    $rows = $usedRange.Rows.Count
    for ($r = 1; $r -le $rows; $r++) {
        $val = $sheet.Cells.Item($r, 1).Text
        if ($val -ne "" -and $val -notmatch "NOME GEN.RICO" -and $val -notmatch "CLASSIFICA..O" -and $val -notmatch "PADRONIZA" -and $val -notmatch "ANTIINFLAM.TORIO") {
            $meds += $val
        }
    }
}
$meds | Sort-Object | Get-Unique | Out-File "C:\Users\CAIS 10\Downloads\AXION-HOSPITALAR-COMPLETO-main\AXION-HOSPITALAR-COMPLETO-main\AXION-HOSPITALAR-COMPLETO\meds_list.txt" -Encoding UTF8
$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
