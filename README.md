# Thermal Runaway

放置インクリメンタル × デッキ構築ローグライト。  
熱的死を迎えた宇宙を、最後の熾火から再び燃やせ。

▶ **[Play in browser](https://sears-gh.github.io/Thermal-Runaway/)**

---

## 概要

- **循環炉**：デッキのカードが左から永久に発火し続ける
- **冷却レース**：Phlogiston（PH）が指数関数的冷却曲線を追い越せば勝ち
- **再点火**：負けるたびにデッキを強化してリトライ
- **Flashover**：PH が 1,000,000 を超えるとプレステージ、Ash を獲得
- **炉床**：Ash で永続アップグレードを購入

## 技術スタック

- Vite + React 19 + TypeScript
- ビルド出力：単一 HTML ファイル（外部依存なし）
- 自動セーブ：localStorage（再点火・一時停止・30秒ごと）

## 開発

```bash
npm install
npm run dev       # 開発サーバー
npm run build     # 単一 HTML を dist/ に出力
npm run typecheck # 型チェック
```

ブランチへの push で GitHub Actions が自動ビルド → GitHub Pages にデプロイ。
