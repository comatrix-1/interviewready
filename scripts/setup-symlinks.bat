@echo off
setlocal

cd /d "%~dp0.."

echo Project root: %cd%
echo.

REM ----------------------------
REM Ensure AGENTS.md is source of truth
REM ----------------------------
if not exist "AGENTS.md" (
    echo. > "AGENTS.md"
    echo Created AGENTS.md (source of truth)
)

REM ----------------------------
REM Ensure CLAUDE.md is symlink -> AGENTS.md
REM ----------------------------
if exist "CLAUDE.md" (
    echo CLAUDE.md already exists - ensure it is a symlink manually if needed
) else (
    mklink "CLAUDE.md" "AGENTS.md"
    echo Created CLAUDE.md symlink -> AGENTS.md
)

REM ----------------------------
REM Ensure .agents exists
REM ----------------------------
if not exist ".agents\" (
    mkdir ".agents"
    echo Created .agents
)

REM ----------------------------
REM Ensure .qoder -> .agents symlink
REM ----------------------------
if exist ".qoder" (
    echo .qoder already exists - skipping
) else (
    mklink /D ".qoder" ".agents"
    echo Created .qoder symlink -> .agents
)

echo.
echo Done.
pause