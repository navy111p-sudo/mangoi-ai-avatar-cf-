$ErrorActionPreference = "SilentlyContinue"
Set-Location -Path $PSScriptRoot

New-Item -ItemType Directory -Force "_recover" | Out-Null
New-Item -ItemType Directory -Force "_recover\student" | Out-Null

# 1) full recent log
git log -80 --date=iso --format="%H`t%cd`t%s" | Out-File "_recover\log.txt" -Encoding utf8

# 2) walk newest -> oldest, read <title> of public/index.html to tell counselor vs ops
$hashes = git log -80 --format="%H"
$report = @()
$lastCounselor = $null
foreach($h in $hashes){
  $html = git show "$($h):public/index.html" 2>$null
  $title = ""
  if($html){
    $joined = ($html -join "`n")
    $m = [regex]::Match($joined, "<title>(.*?)</title>")
    if($m.Success){ $title = $m.Groups[1].Value }
  }
  $report += "$h`t$title"
  if((-not $lastCounselor) -and ($title -match "상담")){ $lastCounselor = $h }
}
$report | Out-File "_recover\titles.txt" -Encoding utf8

# 3) extract the most recent counselor commit's text sources
if($lastCounselor){
  "LAST_COUNSELOR=$lastCounselor" | Out-File "_recover\hash.txt" -Encoding ascii
  $files = git ls-tree -r --name-only $lastCounselor
  $files | Out-File "_recover\filelist.txt" -Encoding utf8
  foreach($f in @("public/index.html","src/index.js","public/embed-snippet.html","wrangler.toml")){
    if($files -contains $f){
      $content = git show "$($lastCounselor):$f"
      $out = "_recover\student\" + ($f -replace "/","__")
      $content | Out-File $out -Encoding utf8
    }
  }
  Write-Host "DONE. last student-counselor commit = $lastCounselor"
} else {
  Write-Host "WARNING: no counselor commit found (no title containing 상담). See _recover\titles.txt"
}
