Add-Type -AssemblyName System.Drawing

$src1 = "C:\Users\Amirreza\.gemini\antigravity\brain\5b64c21e-ad05-404e-ab18-f625c2970510\workspace_layers_icon_1788975744602.jpg"
$src2 = "C:\Users\Amirreza\.gemini\antigravity\brain\5b64c21e-ad05-404e-ab18-f625c2970510\workspace_layers_v2_1788975799774.jpg"

function Resize-Image($sourcePath, $targetPath, $width, $height) {
    if (-not (Test-Path $sourcePath)) {
        Write-Error "Source file not found: $sourcePath"
        return
    }
    $img = [System.Drawing.Image]::FromFile($sourcePath)
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $graph = [System.Drawing.Graphics]::FromImage($bmp)
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graph.DrawImage($img, 0, 0, $width, $height)
    $bmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graph.Dispose()
    $bmp.Dispose()
    $img.Dispose()
    Write-Output "Generated: $targetPath ($width x $height)"
}

$iconsDir = "d:\Work\Main Projects\Reminder\apps\web\public\icons"
$publicDir = "d:\Work\Main Projects\Reminder\apps\web\public"
$appDir = "d:\Work\Main Projects\Reminder\apps\web\src\app"

if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null
}

Resize-Image $src1 "$iconsDir\workspace-layers-trio-512.png" 512 512
Resize-Image $src1 "$iconsDir\workspace-layers-trio-1024.png" 1024 1024
Resize-Image $src2 "$iconsDir\workspace-layers-geometric-512.png" 512 512

# Primary app icons (Next.js favicon and public icon)
Resize-Image $src1 "$publicDir\icon.png" 512 512
Resize-Image $src1 "$appDir\icon.png" 512 512
Resize-Image $src1 "$publicDir\apple-touch-icon.png" 180 180
Resize-Image $src1 "$publicDir\icon-192.png" 192 192
Resize-Image $src1 "$publicDir\icon-512.png" 512 512

# Generate favicon.ico
$icoBmp = [System.Drawing.Bitmap]::FromFile("$publicDir\icon.png")
$icoThumb = New-Object System.Drawing.Bitmap($icoBmp, 32, 32)
$hIcon = $icoThumb.GetHicon()
$icoIcon = [System.Drawing.Icon]::FromHandle($hIcon)
$icoStream = [System.IO.File]::Create("$publicDir\favicon.ico")
$icoIcon.Save($icoStream)
$icoStream.Close()
$icoThumb.Dispose()
$icoBmp.Dispose()
Write-Output "Generated favicon.ico"

Write-Output "All icons generated successfully."
