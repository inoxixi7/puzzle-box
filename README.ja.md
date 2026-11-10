# Puzzle Box

[English](README.md) | [中文](README.zh.md) | 日本語

ブラウザで遊べる 3D の仕掛け箱パズルゲームです。どの面にも仕掛けがあり、面どうしが連動し、ふたは本当に開き、エンディングは箱の中にあります。
箱には文字が一切なく、手がかりはすべて絵なので、どの言語の人でも同じように遊べます。

## 必要なもの

- [Node.js](https://nodejs.org/ja) 22 以上（LTS 版を推奨。npm も一緒にインストールされます）
- Chrome・Edge・Safari・Firefox などの最新ブラウザ

インストール後、ターミナル（Windows は PowerShell）で次のコマンドを実行し、バージョンが表示されれば OK です。

```bash
node -v
npm -v
```

## コードを入手する

**ZIP でダウンロード**

1. https://github.com/inoxixi7/puzzle-box を開く
2. 緑色の **Code** ボタン → **Download ZIP** をクリック
3. 展開する（Windows は右クリック →「すべて展開」、Mac はダブルクリック）
4. 展開された `puzzle-box-main` フォルダの中に `package.json` があることを確認

**Git を使う場合**

```bash
git clone https://github.com/inoxixi7/puzzle-box.git
```

## インストール

ターミナルでフォルダに移動し、依存パッケージをインストールします。

```bash
cd puzzle-box-main    # git clone した場合は cd puzzle-box
npm ci
```

> **Windows で「このシステムではスクリプトの実行が無効になっているため…」と表示された場合**
> PowerShell で次のコマンドを実行してから、もう一度 `npm ci` を実行してください（この PowerShell ウィンドウの間だけ有効です）。
>
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
> ```

## 起動する

```bash
npm run dev
```

ターミナルに表示される URL（通常は http://localhost:5173/ ）をブラウザで開くと遊べます。
終了するときはターミナルで `Ctrl + C` を押します。

## ビルド

```bash
npm run build          # dist/ に出力。Web サーバーに置いて公開する用
npm run preview        # ビルド結果をローカルで確認（http://localhost:4173/）
npm run build:single   # dist-single/index.html に 1 ファイルで出力。ダブルクリックで開ける
```

`dist/index.html` はダブルクリックでは動きません（Web サーバーが必要です）。
サーバーなしで配りたい場合は `npm run build:single` で作ったファイルを使ってください。

## 遊び方

- ドラッグで箱を回転
- 面をクリック（タップ）するとその面を調べる
- ゲーム内に文字はなく、画面の隅のアイコンで操作を示す
- 手に入れた道具は画面右下のトレイに入るので、選んでから使う場所をタップ
- 右上の戻る矢印ボタンまたは Esc キーで全体表示に戻る
- 行き詰まったら電球ボタンで、次に調べる面へ箱が回る
