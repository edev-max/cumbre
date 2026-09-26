; Cumbre · by Apex Consulting — instalador de Windows (NSIS)
; Se arma con:  makensis -DVERSION=0.1.0 -DBIN=<carpeta con cumbre.exe y WebView2Loader.dll> instalador/cumbre.nsi
Unicode true
SetCompressor /SOLID lzma
!include "MUI2.nsh"
!include "x64.nsh"

!ifndef VERSION
  !define VERSION "0.1.0"
!endif
!ifndef BIN
  !define BIN "..\src-tauri\target\x86_64-pc-windows-gnu\release"
!endif
!define NOMBRE "Cumbre"
!define EMPRESA "Apex Consulting"
!define CLAVE_DESINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cumbre"
; WebView2 (el motor de la ventana): viene con Windows 11 y con Windows 10 actualizado
!define WEBVIEW2 "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

Name "${NOMBRE}"
OutFile "Cumbre-${VERSION}-instalador.exe"
InstallDir "$PROGRAMFILES64\${NOMBRE}"
InstallDirRegKey HKLM "Software\${NOMBRE}" "Carpeta"
RequestExecutionLevel admin
BrandingText "${NOMBRE} ${VERSION} · by ${EMPRESA}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1034 "ProductName" "${NOMBRE}"
VIAddVersionKey /LANG=1034 "CompanyName" "${EMPRESA}"
VIAddVersionKey /LANG=1034 "FileDescription" "Instalador de ${NOMBRE}"
VIAddVersionKey /LANG=1034 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1034 "LegalCopyright" "© 2026 ${EMPRESA}"

!define MUI_ICON "..\src-tauri\icons\icon.ico"
!define MUI_UNICON "..\src-tauri\icons\icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Bienvenido a ${NOMBRE}"
!define MUI_WELCOMEPAGE_TEXT "Vamos a instalar ${NOMBRE}, el sistema administrativo de ${EMPRESA} para tu negocio: ventas, compras, inventario y despachos.$\r$\n$\r$\nTu información se guarda en esta computadora."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Cumbre.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir ${NOMBRE}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "${NOMBRE} necesita Windows de 64 bits."
    Abort
  ${EndIf}
  SetRegView 64
FunctionEnd

Section "Cumbre" SEC_PRINCIPAL
  SetOutPath "$INSTDIR"
  File /oname=Cumbre.exe "${BIN}\cumbre.exe"
  File "${BIN}\WebView2Loader.dll"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  WriteRegStr HKLM "Software\${NOMBRE}" "Carpeta" "$INSTDIR"
  WriteRegStr HKLM "${CLAVE_DESINST}" "DisplayName" "${NOMBRE}"
  WriteRegStr HKLM "${CLAVE_DESINST}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${CLAVE_DESINST}" "Publisher" "${EMPRESA}"
  WriteRegStr HKLM "${CLAVE_DESINST}" "DisplayIcon" "$INSTDIR\Cumbre.exe"
  WriteRegStr HKLM "${CLAVE_DESINST}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegDWORD HKLM "${CLAVE_DESINST}" "NoModify" 1
  WriteRegDWORD HKLM "${CLAVE_DESINST}" "NoRepair" 1
  CreateShortcut "$SMPROGRAMS\${NOMBRE}.lnk" "$INSTDIR\Cumbre.exe"
  CreateShortcut "$DESKTOP\${NOMBRE}.lnk" "$INSTDIR\Cumbre.exe"

  ; sin WebView2 la ventana no puede abrir: se ofrece descargarlo de Microsoft
  ClearErrors
  ReadRegStr $0 HKLM "${WEBVIEW2}" "pv"
  ${If} $0 == ""
    ReadRegStr $0 HKCU "${WEBVIEW2}" "pv"
  ${EndIf}
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    MessageBox MB_YESNO|MB_ICONINFORMATION "${NOMBRE} necesita Microsoft Edge WebView2, que no está en esta computadora.$\r$\n$\r$\n¿Abrir la página de Microsoft para instalarlo? (es gratis y tarda un minuto)" IDNO fin
    ExecShell "open" "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
    fin:
  ${EndIf}
SectionEnd

Section "Uninstall"
  SetRegView 64
  Delete "$INSTDIR\Cumbre.exe"
  Delete "$INSTDIR\WebView2Loader.dll"
  Delete "$INSTDIR\Desinstalar.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\${NOMBRE}.lnk"
  Delete "$DESKTOP\${NOMBRE}.lnk"
  DeleteRegKey HKLM "${CLAVE_DESINST}"
  DeleteRegKey HKLM "Software\${NOMBRE}"
  ; la base de datos (%APPDATA%\ve.apexconsulting.cumbre) NO se borra: es la información del negocio
SectionEnd
