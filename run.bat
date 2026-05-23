@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [1/2] 正在创建虚拟环境...
    python -m venv .venv
    if errorlevel 1 (
        echo 错误: 未找到 python，请先安装 Python 3.11+
        pause
        exit /b 1
    )
    echo [2/2] 正在安装依赖...
    .venv\Scripts\pip install -r requirements.txt -q
)

.venv\Scripts\python.exe main.py
pause
