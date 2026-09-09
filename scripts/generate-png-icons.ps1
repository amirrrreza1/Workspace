Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$publicDir = Join-Path $rootDir "apps\web\public"
$iconsDir = Join-Path $publicDir "icons"
$appDir = Join-Path $rootDir "apps\web\src\app"

$canonicalSource = Join-Path $iconsDir "workspace-layers-trio-512.png"

if (-not (Test-Path $canonicalSource)) {
    Write-Error "Canonical icon not found: $canonicalSource"
    exit 1
}

function Resize-Image($sourcePath, $targetPath, $width, $height) {
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

# Primary app icons generated from canonical workspace-layers-trio-512.png
Resize-Image $canonicalSource "$publicDir\icon.png" 512 512
Resize-Image $canonicalSource "$appDir\icon.png" 512 512
Resize-Image $canonicalSource "$publicDir\apple-touch-icon.png" 180 180
Resize-Image $canonicalSource "$publicDir\icon-192.png" 192 192
Resize-Image $canonicalSource "$publicDir\icon-512.png" 512 512

# Generate favicon.ico (32x32)
$icoBmp = [System.Drawing.Bitmap]::FromFile("$publicDir\icon.png")
$icoThumb = New-Object System.Drawing.Bitmap($icoBmp, 32, 32)
$hIcon = $icoThumb.GetHicon()
$icoIcon = [System.Drawing.Icon]::FromHandle($hIcon)
$icoStream = [System.IO.File]::Create("$publicDir\favicon.ico")
$icoIcon.Save($icoStream)
$icoStream.Close()
$icoThumb.Dispose()
$icoBmp.Dispose()
Write-Output "Generated favicon.ico (32 x 32)"

Write-Output "All icons generated successfully from workspace-layers-trio-512.png"
