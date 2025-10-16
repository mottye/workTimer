# ビルドと配布手順

## 📦 ビルド方法

### 前提条件
- Node.js がインストールされていること
- `npm install` が実行済みであること

### ビルドコマンド

#### macOS用のみビルド
```bash
npm run build:mac
```
生成されるファイル:
- `dist/Stopwatch-1.0.0.dmg` (インストーラー)
- `dist/Stopwatch-1.0.0-mac.zip` (ZIP版)

#### Windows用のみビルド（macOS上でも可能）
```bash
npm run build:win
```
生成されるファイル:
- `dist/Stopwatch Setup 1.0.0.exe` (インストーラー)
- `dist/Stopwatch-1.0.0-win.zip` (ZIP版)

#### macOSとWindowsの両方をビルド
```bash
npm run build:all
```

---

## 🚀 GitHub Releasesでの配布方法

### 1. ビルドファイルを作成
```bash
npm run build:mac
# または
npm run build:all
```

### 2. GitHubでReleaseを作成

#### ステップ1: Releasesページに移動
1. GitHubのリポジトリページを開く
2. 右側のサイドバーの「Releases」をクリック
3. 「Create a new release」ボタンをクリック

#### ステップ2: タグを作成
- **Tag version**: `v1.0.0` (バージョン番号)
- **Target**: `main` (ブランチ)

#### ステップ3: リリース情報を入力
- **Release title**: `v1.0.0 - 初回リリース`
- **Description**: リリースノートを記載
  ```markdown
  ## 新機能
  - タイマー機能
  - カテゴリ機能
  - 目標時間設定
  - Slack通知設定
  
  ## インストール方法
  ### macOS
  - `Stopwatch-1.0.0.dmg` をダウンロード
  - DMGファイルを開く
  - アプリをApplicationsフォルダにドラッグ&ドロップ
  
  ### Windows
  - `Stopwatch Setup 1.0.0.exe` をダウンロード
  - インストーラーを実行
  ```

#### ステップ4: ファイルをアップロード
- 「Attach binaries by dropping them here or selecting them.」エリアに
- `dist/` フォルダ内のファイルをドラッグ&ドロップ
  - `Stopwatch-1.0.0.dmg`
  - `Stopwatch-1.0.0-mac.zip`
  - `Stopwatch Setup 1.0.0.exe`
  - `Stopwatch-1.0.0-win.zip`

#### ステップ5: リリースを公開
- 「Publish release」ボタンをクリック

### 3. チームメンバーへの共有

リリースページのURLを共有:
```
https://github.com/USERNAME/REPO_NAME/releases/tag/v1.0.0
```

チームメンバーは:
1. リリースページにアクセス
2. OSに応じたファイルをダウンロード
3. インストールして使用

---

## 🤖 GitHub Actionsで自動化（オプション）

タグをプッシュすると自動的にビルド＆リリースする設定も可能です。

### 設定方法

`.github/workflows/release.yml` を作成:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: dist/*

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v3
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            **/*.dmg
            **/*.zip
            **/*.exe
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 使用方法

```bash
# バージョンタグを作成
git tag v1.0.0

# GitHubにプッシュ
git push origin v1.0.0
```

自動的に:
1. macOS版とWindows版をビルド
2. GitHub Releasesを作成
3. ファイルをアップロード

---

## 📝 バージョン更新の手順

### 1. package.jsonのバージョンを更新
```json
{
  "version": "1.0.1"
}
```

### 2. 変更をコミット
```bash
git add package.json
git commit -m "chore: bump version to 1.0.1"
git push origin main
```

### 3. ビルドとリリース
```bash
# ビルド
npm run build:all

# GitHubでRelease作成（上記手順参照）
```

---

## ❓ トラブルシューティング

### "Code signing required" エラー（macOS）
macOS版を配布する場合、公証（notarization）が必要な場合があります。
テスト配布の場合は、受信者に「システム環境設定 > セキュリティとプライバシー」から許可してもらう必要があります。

### Windows Defender の警告
署名されていないexeファイルは警告が出る場合があります。
「詳細情報」→「実行」で起動できます。

### ファイルサイズが大きい
Electronアプリは100MB以上になる場合があります。
GitHub Releasesは2GBまでのファイルをサポートしています。

