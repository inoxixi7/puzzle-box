# Puzzle Box

[English](README.md) | 中文 | [日本語](README.ja.md)

一款在浏览器里玩的 3D 机关盒解谜游戏。每一面都藏着机关，各面之间互相联动，盒盖能真正打开，结局就在盒子里面。
盒子上没有任何文字，所有线索都是图形，任何语言的玩家都能玩。

## 准备

- [Node.js](https://nodejs.org/zh-cn) 22 或更新版本（推荐 LTS 版，安装时会一起装上 npm）
- Chrome、Edge、Safari、Firefox 等较新的浏览器

安装后在终端（Windows 用 PowerShell）运行下面两条命令，能显示版本号就说明装好了。

```bash
node -v
npm -v
```

## 获取代码

**下载 ZIP**

1. 打开 https://github.com/inoxixi7/puzzle-box
2. 点绿色的 **Code** 按钮 → **Download ZIP**
3. 解压（Windows：右键 →「全部解压缩」；Mac：双击）
4. 确认解压出的 `puzzle-box-main` 文件夹里有 `package.json`

**或者用 Git**

```bash
git clone https://github.com/inoxixi7/puzzle-box.git
```

## 安装

在终端里进入该文件夹，安装依赖：

```bash
cd puzzle-box-main    # 用 git clone 的话是 cd puzzle-box
npm ci
```

> **Windows 提示「在此系统上禁止运行脚本」时**
> 先在 PowerShell 里运行下面这条命令，再重新运行 `npm ci`（只对当前这个 PowerShell 窗口有效）。
>
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
> ```

## 运行

```bash
npm run dev
```

用浏览器打开终端里显示的地址（通常是 http://localhost:5173/ ）就能玩。
要结束时，在终端里按 `Ctrl + C`。

## 构建

```bash
npm run build          # 输出到 dist/，用于放到网页服务器上
npm run preview        # 在本地预览构建结果（http://localhost:4173/）
npm run build:single   # 输出单个文件 dist-single/index.html，双击就能打开
```

`dist/index.html` 直接双击打不开，需要网页服务器。
想不用服务器分享给别人，请用 `npm run build:single` 生成的文件。

## 玩法

- 拖动可以旋转盒子
- 点击（轻点）某一面可以仔细查看
- 游戏里没有文字，角落的图标提示能做什么
- 找到的道具会放进右下角的道具栏，选中后点要用的地方
- 右上角的返回箭头或 Esc 键回到整体视图
- 卡住了？点灯泡按钮，盒子会转到下一步该看的那一面
- 进度自动保存在浏览器里，刷新后从上次的地方继续
