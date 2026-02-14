# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

React 19 + TypeScript + Vite で構築されたユーティリティツール集。GitHub Pages にデプロイされている。現在の主要機能は Shift_JIS 漢字モード対応の QR コード生成・デコード機能。

## コマンド

```bash
pnpm dev          # 開発サーバー起動
pnpm build        # 型チェック(tsc) + 本番ビルド(vite)
pnpm test         # 全テスト実行 (vitest)
pnpm lint         # Biome リンター実行
pnpm format       # Biome フォーマット実行
pnpm check        # Biome リント + フォーマットチェック
pnpm preview      # 本番ビルドのプレビュー
```

テストファイルはソースファイルと同階層に `*.test.ts` として配置。単一テストの実行：
```bash
pnpm vitest run src/utils/qrCodeGeneratorUtils.test.ts
```

## アーキテクチャ

**ルーティング**: React Router DOM で `basename="/utility-tools"` を設定（GitHub Pages 用）。ルート定義は `App.tsx`。SPA ルーティングのフォールバックは `index.html` 内のリダイレクトスクリプトで処理。

**新しいツールの追加手順**:
1. `src/pages/` にページコンポーネントを作成（PascalCase）
2. `App.tsx` にルートを追加
3. `Home.tsx` にリンクを追加

**カスタムフックによるロジック分離**: 各ツールの状態管理・ビジネスロジックは `src/hooks/` のカスタムフックに抽出し、ページコンポーネントは描画に専念する。`useQRCodeGenerator.ts`、`useQRCodeDecoder.ts` を参照。

**QR コード生成**は2つのパスがある：
- 標準 UTF-8: `qrcode.react` コンポーネントで直接レンダリング
- 漢字モード（Shift_JIS）: `@nuintun/qrcode` で QR データを生成し、Canvas に描画。テキストは漢字セグメントとバイトセグメントに自動分割される。エンコーディングの詳細は `docs/qr-kanji-mode.md` を参照。

**QR コードデコード**はデュアルライブラリ戦略：
- 一次: `@zxing/library`（複数の二値化戦略を使用）
- フォールバック: `jsqr`
- エンコーディング検出（UTF-8, Shift-JIS, Binary）、低解像度画像のアップスケーリング機能を含む。

## コードスタイル

- **フォーマッタ/リンター**: Biome（ダブルクォート、スペースインデント、recommended ルール）
- **TypeScript**: strict モード（`noUnusedLocals`, `noUnusedParameters` 有効）
- **コンポーネント**: 関数コンポーネント + Hooks のみ
- **ファイル命名**: コンポーネントは PascalCase、フック・ユーティリティは camelCase
- **パッケージマネージャー**: pnpm（Node 22.15.0）

## ブランチ運用

- PR のベースブランチ: `develop`
- `main` への push で GitHub Pages に自動デプロイ
