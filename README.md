# トチカン

東京の駅の位置と路線を、すごろくで遊びながら覚えるスマホ向けWebアプリです。

- 要件定義書：[docs/requirements.md](docs/requirements.md)
- 作業の一覧：[ロードマップ（#1）](https://github.com/k-m7m/tochikan/issues/1)

## 手元で動かす

Node.js 22 以上が必要です。

```sh
npm install
npm run dev
```

表示されたURL（通常は http://localhost:5173 ）をブラウザで開きます。スマホで確かめるときは `npm run dev -- --host` で起動し、同じWi-Fiにつないだスマホから、表示されたネットワークのURLを開きます。

## 出典

- 地図：[国土地理院](https://maps.gsi.go.jp/development/ichiran.html)のベクトルタイル
