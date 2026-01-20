# Git 脚本修复提示词

## 使用方法

1. 复制下面的"完整提示词"部分
2. 在其他项目中打开 AI 助手
3. 粘贴提示词
4. 上传或粘贴你的 `1-git-push-auto.bat` 和 `2-git-clone-auto.bat` 文件内容
5. AI 会自动修复所有问题

---

## 完整提示词（直接复制使用）

```
我有两个 Git 自动化脚本需要修复，请按照以下标准修复所有问题：

## 需要修复的脚本

1. `1-git-push-auto.bat` - Git 推送脚本
2. `2-git-clone-auto.bat` - Git 克隆脚本

## 已知问题和修复方案

### 推送脚本 (1-git-push-auto.bat) 需要修复的问题：

#### 问题 1：已提交但未推送的内容无法推送
**位置**：第五步"添加、提交、推送"部分
**原问题代码**：
```batch
git diff --cached --quiet
if errorlevel 1 (
    REM 只有暂存区有改动时才会提交和推送
```

**修复方案**：
```batch
REM 检查是否有需要提交的改动
git diff --cached --quiet
set HAS_STAGED_CHANGES=%errorlevel%

if %HAS_STAGED_CHANGES% equ 1 (
    echo.
    set /p COMMIT_MSG=请输入提交信息（直接回车默认为 "%DEFAULT_COMMIT_MSG%"）: 
    if "!COMMIT_MSG!"=="" set COMMIT_MSG=%DEFAULT_COMMIT_MSG%
    echo 正在提交...
    git commit -m "!COMMIT_MSG!"
    echo.
) else (
    echo.
    echo [提示] 暂存区没有改动，跳过提交步骤
    echo.
)

REM 检查是否有未推送的提交
set HAS_UNPUSHED=0
if %HAS_STAGED_CHANGES% equ 1 (
    set HAS_UNPUSHED=1
) else (
    REM 获取当前分支名
    set CHECK_BRANCH=
    for /f "delims=" %%i in ('git branch --show-current 2^>nul') do set CHECK_BRANCH=%%i
    if "!CHECK_BRANCH!"=="" set CHECK_BRANCH=%DEFAULT_BRANCH%
    
    REM 检查远程分支是否存在
    git rev-parse --verify origin/!CHECK_BRANCH! >nul 2>&1
    if errorlevel 1 (
        REM 远程分支不存在，检查本地是否有提交
        git rev-parse HEAD >nul 2>&1
        if not errorlevel 1 (
            set HAS_UNPUSHED=1
            echo [提示] 检测到本地有提交但远程分支不存在，需要推送
        )
    ) else (
        REM 远程分支存在，比较本地和远程
        git diff --quiet origin/!CHECK_BRANCH! HEAD 2>nul
        if errorlevel 1 (
            set HAS_UNPUSHED=1
            echo [提示] 检测到本地有未推送的提交
        )
    )
)

if !HAS_UNPUSHED! equ 1 (
    REM 检测当前分支
    set CURRENT_BRANCH=
    for /f "delims=" %%i in ('git branch --show-current 2^>nul') do set CURRENT_BRANCH=%%i
    if "!CURRENT_BRANCH!"=="" set CURRENT_BRANCH=%DEFAULT_BRANCH%
    set /p TARGET_BRANCH=推送到哪个分支？（直接回车默认为 "!CURRENT_BRANCH!"）: 
    if "!TARGET_BRANCH!"=="" set TARGET_BRANCH=!CURRENT_BRANCH!
    
    echo.
    echo 正在推送到 !TARGET_BRANCH! 分支...
    git push -u origin !TARGET_BRANCH!
    if errorlevel 1 (
        echo.
        echo ========================================
        echo   [错误] 推送失败，请检查网络或仓库权限
        echo ========================================
        echo.
    ) else (
        echo.
        echo ========================================
        echo   [完成] 推送成功
        echo ========================================
        echo   本地目录: %cd%
        echo   远程仓库: !FINAL_REPO!
        echo   推送分支: !TARGET_BRANCH!
        if %HAS_STAGED_CHANGES% equ 1 (
            echo   提交信息: !COMMIT_MSG!
        )
        echo   用户: !GIT_NAME! ^<!GIT_EMAIL!^>
        echo ========================================
    )
) else (
    echo.
    echo ========================================
    echo   [提示] 没有需要推送的内容
    echo   - 暂存区无改动
    echo   - 本地无未推送的提交
    echo ========================================
)
```

#### 问题 2：git init 默认分支不确定
**位置**：第二步"检查/初始化 Git 仓库"部分
**原问题代码**：
```batch
git init
```

**修复方案**：
```batch
git init -b %DEFAULT_BRANCH%
if errorlevel 1 (
    REM 旧版本 Git 不支持 -b 参数，使用传统方式
    git init
    git checkout -b %DEFAULT_BRANCH% 2>nul
)
```

#### 问题 3：FINAL_REPO 变量可能未设置
**位置**：第三步"配置远程仓库地址"部分
**原问题代码**：
```batch
if "!CURRENT_REPO!"=="" (
    ...
    git remote add origin "!FINAL_REPO!"
    ...
) else (
    echo [当前远程仓库] !CURRENT_REPO!
    set /p INPUT_REPO=直接回车使用当前地址，或输入新地址: 
    if "!INPUT_REPO!"=="" (
        set FINAL_REPO=!CURRENT_REPO!
    ) else (
        ...
    )
)
```

**修复方案**：
```batch
if "!CURRENT_REPO!"=="" (
    echo [提示] 未检测到远程仓库地址
    echo.
    echo 如果还没有创建远程仓库，请先去创建：
    echo   [1] GitHub:  %GITHUB_NEW_REPO%
    echo   [2] Gitee:   %GITEE_NEW_REPO%
    echo.
    echo 创建完成后，复制仓库地址粘贴到下方
    echo 默认地址: %DEFAULT_REPO%
    echo.
    set /p INPUT_REPO=请输入远程仓库地址（直接回车使用默认）: 
    if "!INPUT_REPO!"=="" (
        set FINAL_REPO=%DEFAULT_REPO%
    ) else (
        set FINAL_REPO=!INPUT_REPO!
    )
    git remote add origin "!FINAL_REPO!" 2>nul
    if errorlevel 1 (
        echo [警告] 添加远程仓库失败，可能已存在，尝试更新...
        git remote set-url origin "!FINAL_REPO!"
    )
    echo 已设置远程仓库: !FINAL_REPO!
    echo.
) else (
    set FINAL_REPO=!CURRENT_REPO!
    echo [当前远程仓库] !CURRENT_REPO!
    set /p INPUT_REPO=直接回车使用当前地址，或输入新地址: 
    if not "!INPUT_REPO!"=="" (
        set FINAL_REPO=!INPUT_REPO!
        git remote set-url origin "!FINAL_REPO!"
        echo 已更新远程仓库: !FINAL_REPO!
    )
    echo.
)
```

### 克隆脚本 (2-git-clone-auto.bat) 需要修复的问题：

#### 问题：文件夹名提取不完善
**位置**：第二步"配置仓库地址"部分
**原问题代码**：
```batch
for %%i in ("!FINAL_REPO!") do set REPO_NAME=%%~ni
if "!REPO_NAME!"=="" set REPO_NAME=repo
```

**修复方案**：
```batch
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
```

## 修复要求

1. 请找到我脚本中对应的代码段
2. 用修复方案替换原问题代码
3. 保持脚本的其他部分不变
4. 确保所有变量名和逻辑一致
5. 修复完成后，输出完整的修复后的脚本内容

## 我的脚本内容

[在这里粘贴你的 1-git-push-auto.bat 内容]

[在这里粘贴你的 2-git-clone-auto.bat 内容]

请开始修复。
```

---

## 参考：修复后的标准脚本

如果 AI 修复有问题，可以参考这两个标准版本：

### 标准版 1-git-push-auto.bat
[见本项目的 1-git-push-auto.bat 文件]

### 标准版 2-git-clone-auto.bat
[见本项目的 2-git-clone-auto.bat 文件]

---

## 验证修复是否成功

修复后，测试以下场景：

### 推送脚本测试
1. 新项目初始化并推送 ✓
2. 有改动的文件提交推送 ✓
3. 已提交但未推送的内容推送 ✓
4. 无改动时显示正确提示 ✓
5. 非 main 分支的推送 ✓

### 克隆脚本测试
1. 标准 HTTPS URL 克隆 ✓
2. 带 .git 后缀的 URL ✓
3. 文件夹已存在时的处理 ✓

---

## 快速使用版（精简提示词）

如果 AI 理解能力强，可以用这个精简版：

```
我有两个 Git 批处理脚本需要修复。请按照以下要求修复：

1. **推送脚本问题**：
   - 只检查了暂存区，没检查已提交但未推送的内容
   - git init 没有指定默认分支
   - FINAL_REPO 变量在某些路径下未设置
   - 分支检测硬编码了 main，应该动态获取当前分支

2. **克隆脚本问题**：
   - 文件夹名提取没有处理 .git 后缀和特殊字符

请修复这些问题，并输出完整的修复后的脚本。

我的脚本：
[粘贴脚本内容]
```
