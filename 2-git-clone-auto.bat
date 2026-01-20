@echo off
setlocal enabledelayedexpansion
REM ===== 强制设置 UTF-8 编码 =====
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set LANG=zh_CN.UTF-8
cd /d "%~dp0"
title Git Clone - 万能拉取脚本

REM ========================================
REM   默认配置区（可根据需要修改）
REM ========================================
set DEFAULT_REPO=https://github.com/LPK3215/obsidian-notes.git
set DEFAULT_BRANCH=main
set DEFAULT_CLONE_MODE=1
set PROXY_ADDR=127.0.0.1:7897
set GITHUB_NEW_REPO=https://github.com/new
set GITEE_NEW_REPO=https://gitee.com/projects/new
REM ========================================

echo ========================================
echo   Git 万能拉取脚本
echo ========================================
echo.

REM ========================================
REM   显示仓库信息
REM ========================================
echo [仓库信息]
if exist ".git" (
    for /f "delims=" %%i in ('git remote get-url origin 2^>nul') do (
        echo   当前项目远程仓库: %%i
    )
    if errorlevel 1 echo   当前项目远程仓库: 未绑定
) else (
    echo   当前项目远程仓库: 当前目录非Git仓库
)
echo   默认拉取仓库: %DEFAULT_REPO%
echo   默认分支: %DEFAULT_BRANCH% (GitHub新仓库默认为main)
echo ========================================
echo.

REM ========================================
REM   第一步：配置网络代理
REM ========================================
echo [1/4] 配置网络代理...
git config --global http.proxy http://%PROXY_ADDR%
git config --global https.proxy http://%PROXY_ADDR%
git config --global core.quotepath false
echo 已设置代理: %PROXY_ADDR%
echo.

REM ========================================
REM   第二步：配置仓库地址
REM ========================================
echo [2/4] 配置仓库地址...
echo.
echo 可用的仓库平台：
echo   [1] GitHub:  %GITHUB_NEW_REPO%
echo   [2] Gitee:   %GITEE_NEW_REPO%
echo.
echo 默认地址: %DEFAULT_REPO%
echo.
set /p INPUT_REPO=请输入要拉取的仓库地址（直接回车使用默认）: 
if "!INPUT_REPO!"=="" (
    set FINAL_REPO=%DEFAULT_REPO%
) else (
    set FINAL_REPO=!INPUT_REPO!
)
echo 将拉取: !FINAL_REPO!
echo.

REM 从仓库地址提取文件夹名
set REPO_NAME=
for %%i in ("!FINAL_REPO!") do set REPO_NAME=%%~ni
REM 移除可能的 .git 后缀
set REPO_NAME=!REPO_NAME:.git=!
REM 如果提取失败，使用默认名称
if "!REPO_NAME!"=="" set REPO_NAME=repo
REM 移除可能的特殊字符
set REPO_NAME=!REPO_NAME::=!
set REPO_NAME=!REPO_NAME:/=!
set REPO_NAME=!REPO_NAME:\=!
echo 目标文件夹: !REPO_NAME!
echo.

REM 检查目标文件夹是否已存在
if exist "!REPO_NAME!" (
    echo [警告] 文件夹 "!REPO_NAME!" 已存在
    echo.
    echo 请选择操作：
    echo   [1] 删除现有文件夹并重新拉取
    echo   [2] 拉取到其他文件夹
    echo   [3] 取消操作
    echo.
    set /p CHOICE=请输入选项（1/2/3）: 
    if "!CHOICE!"=="1" (
        echo 正在删除现有文件夹...
        rmdir /s /q "!REPO_NAME!"
        echo 已删除
        echo.
    ) else if "!CHOICE!"=="2" (
        set /p CUSTOM_NAME=请输入新的文件夹名: 
        if "!CUSTOM_NAME!"=="" (
            echo 文件夹名不能为空，已取消操作
            pause
            exit /b
        )
        set REPO_NAME=!CUSTOM_NAME!
        echo 将拉取到: !REPO_NAME!
        echo.
    ) else (
        echo 已取消操作
        pause
        exit /b
    )
)

REM ========================================
REM   第三步：选择克隆模式
REM ========================================
echo [3/4] 选择克隆模式...
echo.
echo ----------------------------------------
echo   [1] 仅最新版本（推荐）
echo       - 只下载当前最新的文件内容
echo       - 下载速度快，占用空间小
echo       - 可以正常修改、提交、推送
echo       - 无法查看历史记录和回滚版本
echo.
echo   [2] 完整克隆
echo       - 下载所有文件 + 全部历史提交记录
echo       - 下载较慢，占用空间较大
echo       - 可以查看任意历史版本
echo       - 可以回滚到之前的版本
echo ----------------------------------------
echo.
echo 默认选项: %DEFAULT_CLONE_MODE%
set /p CLONE_MODE=请选择克隆模式（1/2，直接回车使用默认）: 
if "!CLONE_MODE!"=="" set CLONE_MODE=%DEFAULT_CLONE_MODE%

if "!CLONE_MODE!"=="1" (
    set CLONE_OPTS=--depth 1
    set CLONE_MODE_DESC=仅最新版本
) else (
    set CLONE_OPTS=
    set CLONE_MODE_DESC=完整克隆
)
echo 已选择: !CLONE_MODE_DESC!
echo.

REM ========================================
REM   第四步：拉取仓库
REM ========================================
echo [4/4] 拉取仓库...
echo.

set /p TARGET_BRANCH=拉取哪个分支？（直接回车默认为 "%DEFAULT_BRANCH%"）: 
if "!TARGET_BRANCH!"=="" set TARGET_BRANCH=%DEFAULT_BRANCH%

echo 正在从 !TARGET_BRANCH! 分支拉取（!CLONE_MODE_DESC!）...
git clone !CLONE_OPTS! -b !TARGET_BRANCH! "!FINAL_REPO!" "!REPO_NAME!" 2>&1

if errorlevel 1 (
    echo.
    echo ========================================
    echo   [错误] 拉取失败
    echo ========================================
    echo   可能的原因：
    echo   - 网络连接问题，请检查代理是否正常
    echo   - 仓库地址错误或不存在
    echo   - 分支 "!TARGET_BRANCH!" 不存在
    echo   - 没有访问权限（私有仓库需要登录）
    echo ========================================
    echo.
) else (
    echo.
    echo ========================================
    echo   [完成] 拉取成功
    echo ========================================
    echo   远程仓库: !FINAL_REPO!
    echo   拉取分支: !TARGET_BRANCH!
    echo   克隆模式: !CLONE_MODE_DESC!
    echo   本地目录: %cd%\!REPO_NAME!
    echo ========================================
)

echo.
pause
