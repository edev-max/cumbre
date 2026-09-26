; Apex Licencias — instalador (NSIS). Sólo para Apex Consulting: no se entrega a clientes.
; makensis -DVERSION=1.0.0 instalador.nsi
Unicode true
SetCompressor /SOLID lzma
!include "MUI2.nsh"
!include "x64.nsh"
!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!define BIN "src-tauri\target\x86_64-pc-windows-gnu\release"
!define NOMBRE "Apex Licencias"
!define CLAVE_DESINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\ApexLicencias"

Name "${NOMBRE}"
OutFile "Apex-Licencias-${VERSION}-instalador.exe"
InstallDir "$PROGRAMFILES64\${NOMBRE}"
RequestExecutionLevel admin
BrandingText "${NOMBRE} ${VERSION} · Apex Consulting"
!define MUI_ICON "src-tauri\icons\icon.ico"
!define MUI_UNICON "src-tauri\icons\icon.ico"
!define MUI_WELCOMEPAGE_TITLE "${NOMBRE}"
!define MUI_WELCOMEPAGE_TEXT "La herramienta de Apex Consulting para emitir las licencias de Cumbre.$\r$\n$\r$\nTu clave se crea en esta computadora y queda protegida con tu contraseña."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Apex Licencias.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir ${NOMBRE}"
!insertmacro MUI_PAGE_WELCOME
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

Section "Principal"
  SetOutPath "$INSTDIR"
  File "/oname=Apex Licencias.exe" "${BIN}\apex-licencias.exe"
  File "${BIN}\WebView2Loader.dll"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  WriteRegStr HKLM "${CLAVE_DESINST}" "DisplayName" "${NOMBRE}"
  WriteRegStr HKLM "${CLAVE_DESINST}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${CLAVE_DESINST}" "Publisher" "Apex Consulting"
  WriteRegStr HKLM "${CLAVE_DESINST}" "DisplayIcon" "$INSTDIR\Apex Licencias.exe"
  WriteRegStr HKLM "${CLAVE_DESINST}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  CreateShortcut "$SMPROGRAMS\${NOMBRE}.lnk" "$INSTDIR\Apex Licencias.exe"
  CreateShortcut "$DESKTOP\${NOMBRE}.lnk" "$INSTDIR\Apex Licencias.exe"
SectionEnd

Section "Uninstall"
  SetRegView 64
  Delete "$INSTDIR\Apex Licencias.exe"
  Delete "$INSTDIR\WebView2Loader.dll"
  Delete "$INSTDIR\Desinstalar.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\${NOMBRE}.lnk"
  Delete "$DESKTOP\${NOMBRE}.lnk"
  DeleteRegKey HKLM "${CLAVE_DESINST}"
  ; la clave (%APPDATA%\ve.apexconsulting.licencias) NO se borra
SectionEnd
