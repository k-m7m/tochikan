# 公開の手順（Cloudflare Workers）

静的なファイル（`npm run build` で作られる `dist`）を、Cloudflare Workers で配信する。Cloudflare は新しく作るサイトには Pages ではなく Workers を勧めているため、Workers を使う。設定は `wrangler.jsonc` にある。

## 最初に1回だけ行うこと（オーナーの作業）

1. [Cloudflare](https://dash.cloudflare.com/sign-up) のアカウントを作る（無料プランでよい）
2. ダッシュボードの **Workers & Pages** → **Create application** → **Import a repository** を選ぶ
3. GitHub と連携し、`k-m7m/tochikan` を選ぶ
4. 次のように設定して、デプロイする

| 項目 | 値 |
|---|---|
| Project name | `tochikan`（`wrangler.jsonc` の `name` と同じにする） |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy`（最初から入っている値） |
| Root directory | 空欄のまま |

5. Worker の **Settings → Build → Branch control** で、次の2つを確かめる
   - 本番のブランチが `main` になっている
   - **Enable Preview Builds** がオンになっている。オンだと、PRごとにお試し用のURLが作られ、PRのコメントに届く。お試し版を作るコマンド（Preview command）は、最初から入っている `npx wrangler preview` のままでよい

## お試し版（Worker Previews）について

- `npx wrangler preview` を使うには、`wrangler.jsonc` に `"previews": {}` が必要（中身は空でよい）。これがないと、PRのビルドが「`previews` block がない」というエラーで失敗する
- お試し版の名前には、ブランチ名が使われる

## 公開されるURL

- 本番：`https://tochikan.<アカウントのサブドメイン>.workers.dev`（`main` にマージすると更新される）
- お試し版：PRのブランチごとに作られる。URLはPRのコメント、またはダッシュボードで確認する

## 手元で確かめる

```sh
npm run build
npx wrangler deploy --dry-run   # 設定が読めるかだけを確かめる（アップロードはしない）
```
