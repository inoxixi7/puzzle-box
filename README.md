# Puzzle Box

English | [中文](README.zh.md) | [日本語](README.ja.md)

A 3D puzzle box you play in the browser. Every face hides a mechanism, the
faces affect each other, the lid really opens, and the ending is inside.
There are no words on the box: every clue is a picture, so it plays the
same in any language.

## Requirements

- [Node.js](https://nodejs.org/) 22 or newer (the LTS version is
  recommended; npm comes with it)
- A recent browser such as Chrome, Edge, Safari or Firefox

To check the install, run these in a terminal (PowerShell on Windows). Both
should print a version number.

```bash
node -v
npm -v
```

## Get the code

**ZIP download**

1. Open https://github.com/inoxixi7/puzzle-box
2. Click the green **Code** button → **Download ZIP**
3. Unzip it (Windows: right-click → **Extract All**; Mac: double-click)
4. The folder `puzzle-box-main` should contain `package.json`

**Or with Git**

```bash
git clone https://github.com/inoxixi7/puzzle-box.git
```

## Install

In a terminal, go to the folder and install the dependencies:

```bash
cd puzzle-box-main    # or "cd puzzle-box" if you used git clone
npm ci
```

> **Windows: "running scripts is disabled on this system"**
> Run this in PowerShell, then run `npm ci` again. It only applies to the
> current PowerShell window.
>
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
> ```

## Run

```bash
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173/) in your
browser. Press `Ctrl + C` in the terminal to stop.

## Build

```bash
npm run build          # writes dist/, for hosting on a web server
npm run preview        # serves the build locally at http://localhost:4173/
npm run build:single   # writes dist-single/index.html: one file, opens with a double-click
```

`dist/index.html` does not work when opened by double-click; it needs a web
server. To share the game without a server, use the file from
`npm run build:single`.

## How to play

- Drag to turn the box
- Click (tap) a face to look at it closely
- The game has no text; the corner icons show what you can do
- Items you find go to the tray at the bottom right; select one, then
  tap where to use it
- The back-arrow button (top right) or the Esc key returns to the whole box
- Stuck? The light-bulb button turns the box to the face to work on next
