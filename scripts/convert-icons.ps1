Add-Type -AssemblyName System.Drawing
$brain = "C:\Users\Amirreza\.gemini\antigravity\brain\f172d4f3-45ce-477b-8580-9d3393ebf9c7"
$target = "d:\Work\Main Projects\Reminder\apps\web\public\icons"

if (-not (Test-Path $target)) {
    New-Item -ItemType Directory -Force -Path $target | Out-Null
}

# Convert icon artifacts if present
Get-ChildItem "$brain" -Filter "*icon*.jpg" -ErrorAction SilentlyContinue | ForEach-Object {
    $img = [System.Drawing.Image]::FromFile($_.FullName)
    $name = $_.BaseName
    $img.Save("$target\$name.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()
}

Write-Output "Successfully saved PNG icons in apps\web\public\icons"
