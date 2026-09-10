# もぐもぐチャンネル

犬と猫の食事風景を延々と眺められる、癒やし用の静的サイトです。

- 縦スクロールの無限フィード（画面内の動画だけを再生）
- 🐶 いぬ / 🐱 ねこ の絞り込み
- ミュート切り替え、「いやされた」ボタン
- 動画は YouTube 公式プレーヤーで埋め込み（ダウンロード・再配布はしない）
- YouTube Data API キーは不要

## 構成

| パス | 役割 |
| --- | --- |
| `index.html` / `style.css` / `app.js` | サイト本体（ビルド不要の静的ファイル） |
| `channels.json` | 取り込み対象チャンネルと、タイトル判定用キーワード |
| `tools/refresh_catalog.mjs` | 各チャンネルの公開RSSから動画カタログを更新 |
| `data/catalog.json` | 生成された動画カタログ |

## ローカルで動かす

```sh
python3 -m http.server 5173
# http://localhost:5173
```

## カタログを更新する

```sh
node tools/refresh_catalog.mjs
```

YouTube のチャンネルRSS（`https://www.youtube.com/feeds/videos.xml?channel_id=...`）は
APIキー不要ですが最新15件程度しか返さないため、既存の `data/catalog.json` に
新着を動画ID単位でマージして少しずつ増やす方式です。定期実行するほど本数が増えます。

タイトルに食事系キーワードを含む動画だけを採用します。犬猫以外も投稿するチャンネルは
`"mixed": true` を付けると、動物名を含むタイトルのみに絞られます。

## チャンネルを追加する

`channels.json` の `channels` に追記します。`id` はチャンネルページのソースの
`channel_id` の値です。

```json
{ "id": "UCxxxxxxxxxxxxxxxxxxxxxx", "name": "チャンネル名", "kind": "dog" }
```
