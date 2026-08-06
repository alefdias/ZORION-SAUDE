$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$file = Get-ChildItem "C:\Users\CAIS 10\Downloads\AXION-HOSPITALAR-COMPLETO-main\AXION-HOSPITALAR-COMPLETO-main\AXION-HOSPITALAR-COMPLETO\*.xls" | Where-Object { $_.Name -like "*2026 e 2027*" } | Select-Object -First 1
$workbook = $excel.Workbooks.Open($file.FullName)
$mavCount = 0
foreach ($sheet in $workbook.Sheets) {
    $found = $sheet.UsedRange.Find("Vigil")
    if ($found -ne $null) {
        $firstAddress = $found.Address()
        do {
            Write-Host "Found MAV in sheet $($sheet.Name) at $($found.Address())"
            $mavCount++
            $found = $sheet.UsedRange.FindNext($found)
        } while ($found -ne $null -and $found.Address() -ne $firstAddress)
    }
}
Write-Host "Total MAV occurrences: $mavCount"
$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
