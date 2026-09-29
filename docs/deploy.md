# 公開の手順（Cloudflare Workers）

静的なファイル（`npm run build` で作られる `dist`）を、Cloudflare Workers で配信する。Cloudflare は新しく作るサイトには Pages ではなく Workers を勧めているため、Workers を使う。設定は `wrangler.jsonc` にある。

## 最初に1回だけ行うこと（オーナーの作業）

1. [Cloudflare](https://dash.cloudflare.com/sign-up) のアカウントを作る（無料プランでよい）
2. ダッシュボードの **Workers & Pages** → **Create** → **Import a repository** を選ぶ
3. GitHub と連携し、`k-m7m/tochikan` を選ぶ
4. 次のように設定して、デプロイする

| 項目 | 値 |
|---|---|
| Project name | `tochikan` |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Root directory | `/`（空欄のまま） |

5. 設定の **Builds** で、main 以外のブランチのビルド（non-production branch builds）が有効になっていることを確かめる。これが有効だと、PRごとに確認用のURL（プレビューURL）が作られる

## 公開されるURL

- 本番：`https://tochikan.<アカウントのサブドメイン>.workers.dev`
- プレビュー：PRのブランチごとに作られる。URLはPRのコメント、またはダッシュボードの Deployments から確認する

## 手元で確かめる

```sh
npm run build
npx wrangler deploy --dry-run   # 設定が読めるかだけを確かめる（アップロードはしない）
```
