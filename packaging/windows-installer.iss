; Inno Setup script for Docker Local Management (Windows).
; Built by the release workflow on windows-latest.
;
; Per-user (non-admin) install into %LocalAppData% so the app's self-updater can
; replace its own executable later without elevation.

#define MyAppName "Docker Local Management"
#define MyAppVersion GetEnv("APP_VERSION")
#define MyAppExeName "docker-local-management.exe"

[Setup]
AppId={{8F3C1D2E-5B4A-4E6D-9C27-1A2B3C4D5E6F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=nhanlt-FLS
DefaultDirName={localappdata}\DockerLocalManagement
DefaultGroupName={#MyAppName}
PrivilegesRequired=lowest
; Relative paths below resolve against this .iss file's directory (packaging/),
; so the PyInstaller output one level up is ..\dist and output goes to repo root.
OutputDir=..\setup-output
OutputBaseFilename=docker-local-management-setup-{#MyAppVersion}
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
SetupLogging=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Additional icons:"

[Files]
Source: "..\dist\docker-local-management.exe"; DestDir: "{app}"; DestName: "{#MyAppExeName}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName} now"; Flags: nowait postinstall skipifsilent
