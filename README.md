# entWatchMaker

CS2 の Hammer マップ (`.vmap`) や Workshop からダウンロードした `.vpk` をブラウザで読み込み、
Zombie Escape のアイテム（`weapon_*` エンティティ）と、それに関連するボタン / フィルタ / カウンター /
トリガーをツリー表示・Input/Output 確認しながら、[CS2Fixes](https://github.com/Source2ZE/CS2Fixes) 内蔵
EntWatch 用の `<マップ名>.jsonc` を作るツールです。

すべての処理はブラウザ内 (Web Worker) で完結し、ファイルはどこにもアップロードされません。

English summary is at the bottom.

## できること

- **読み込み**
  - Workshop `.vpk`（単体、または `_dir.vpk` + `_000.vpk`… の分割形式）— 中の `*.vents_c`（エンティティランプ）を直接解析します。
    `point_template` の子ランプも読むので、テンプレートで生成される武器も一覧に出ます（`T` バッジ）。
  - Hammer `.vmap`（DMX binary 9）— プレハブの `.vmap` を一緒にドロップすると、プレハブ内のエンティティも
    `プレハブのnodeID:エンティティのnodeID` 形式の hammerid で取り込みます。
- **一覧**: `weapon_*` だけ / 全エンティティの切り替え、名前・classname・hammerid 検索。
- **関連ツリー**: 選択したエンティティから、Output の接続先 / 自分を対象にする接続元 / 親子 (`parentname`) /
  `filtername` や `template01` などのキー参照をたどって関係を木構造で表示（深さ 1〜5）。
- **詳細**: プロパティ一覧、Outputs（出力 → ターゲット → 入力、パラメータ、遅延、回数）、Inputs（この
  エンティティを対象にしている接続）。ターゲット名はクリックでジャンプできます。
- **設定作成**
  - 武器を選んで「アイテムとして追加」→ 親子関係と Output から、ボタン (`type: button`)、
    フィルタ (`OnPass`)、リレー (`OnTrigger`)、`math_counter` (`counterup` / `counterdown`)、
    トリガー (`triggers`) を推定して雛形を作ります。「全 weapon_ を自動追加」で一括生成もできます。
  - ツリーや詳細画面の「+」で任意のエンティティをハンドラ / トリガーに追加。
  - 名前 / 短縮名 / 色 / message / ui / transfer / templated / mode / cooldown / maxuses / offset を編集。
  - 検証: マップに存在しない hammerid、重複アイテム、`math_counter` でない counter、
    そのエンティティにない出力名などを警告します。
- **出力**: コメント付き jsonc（各 hammerid の横に classname と targetname）をプレビュー / コピー /
  ダウンロード。既存の jsonc を読み込んで編集することもできます。編集内容はマップ名ごとにブラウザに保存されます。

## 使い方

1. https://（GitHub Pages を有効にした URL）を開くか、ローカルで `npm install && npm run dev` して開きます。
2. `.vmap` または `.vpk` をドロップします（初めてなら「サンプルマップを読み込む」で UI を試せます）。
3. 左の `weapon_` を選び、中央のツリーで配線を確認しながら「アイテムとして追加」。
4. 右側でハンドラの `event` / `mode` / `cooldown` などを調整します。
5. 右下の「ダウンロード」で `<マップ名>.jsonc` を保存し、サーバーの
   `game/csgo/addons/cs2fixes/configs/entwatch/maps/` に置きます。

### jsonc の形式（CS2Fixes EntWatch）

```jsonc
[
    {
        "name": "Fire Materia",      // チャット表示名
        "shortname": "Fire",         // HUD 表示名
        "hammerid": "1201",          // weapon エンティティの hammerid（文字列）
        "message": true,
        "ui": true,
        "transfer": true,
        "color": "red",
        "triggers": ["1207"],        // 任意: 関連する trigger_ の hammerid
        "handlers": [
            { "type": "button", "hammerid": "1202", "mode": 1, "message": false, "ui": false },
            { "type": "other", "hammerid": "1203", "event": "OnPass", "mode": 2, "cooldown": 45, "maxuses": 0, "message": true, "ui": true }
        ]
    }
]
```

- `type`: `button`（+use をフック）/ `counterup` / `counterdown`（`math_counter`、`OutValue` を追跡）/ それ以外は `event` で指定した出力を監視。
- `mode`: `1` なし / `2` Cooldown / `3` MaxUses / `4` CooldownAfterUses / `5` CounterValue。
- `hammerid` は必ず文字列です（CS2Fixes が文字列として読み込みます）。

## 開発

```bash
npm install --legacy-peer-deps
npm run dev        # 開発サーバー
npm test           # パーサ / モデルのユニットテスト (vitest)
npm run typecheck
npm run build      # dist/ に静的サイトを出力
```

### 構成

| パス | 内容 |
| --- | --- |
| `src/formats/vpk.ts` | VPK v1/v2 ディレクトリ読み込み（`File.slice` でランダムアクセス） |
| `src/formats/resource.ts` | Source 2 リソース (`*_c`) のブロックヘッダ |
| `src/formats/kv3.ts` | バイナリ KeyValues3 v0〜v5（LZ4 / Zstandard 対応） |
| `src/formats/entityLump.ts` | `*.vents_c` → エンティティ + 接続（ハッシュ化キーの逆引き含む） |
| `src/formats/dmx.ts`, `vmap.ts` | DMX binary 9 デコーダと `.vmap` からのエンティティ抽出 |
| `src/model/graph.ts` | 関連グラフ（I/O、親子、キー参照、テンプレート）とツリー生成 |
| `src/model/suggest.ts` | ハンドラ / 色 / 名前の推定ヒューリスティクス |
| `src/model/entwatch.ts` | jsonc のシリアライズ / パース |
| `src/model/validate.ts` | 設定の検証 |
| `src/ui/` | React UI（日本語 / English） |

パーサは [ValveResourceFormat](https://github.com/ValveResourceFormat/ValveResourceFormat) と
[Datamodel.NET](https://github.com/ValveResourceFormat/Datamodel.NET) の実装を参照して書き、
`tests/fixtures/` の同プロジェクト由来のサンプルファイルと Source 2 Viewer の出力で照合しています。

### GitHub Pages で公開する

リポジトリの Settings → Pages → Source を **GitHub Actions** にすると、`main`（または `master`）への
push で `.github/workflows/pages.yml` がビルドして公開します。

## 既知の制限

- 古い NTRO 形式のエンティティランプ（CS2 以前の Source 2 タイトル）は未対応です。
- `.vmap` はバイナリ形式 (`dmx encoding binary 9`) のみ対応です（Hammer の既定）。
- プレハブ内エンティティの名前 fixup は再現していないため、プレハブをまたぐ接続は解決できないことがあります。
- ハンドラの推定はあくまで雛形です。マップごとの仕様（cooldown 秒数、maxuses など）は必ず確認してください。

---

## English

**entWatchMaker** is a browser-only tool that reads CS2 Hammer maps (`.vmap`) or Workshop `.vpk` files,
lists the `weapon_*` item entities together with the buttons / filters / counters / triggers wired to
them (relation tree + Inputs/Outputs tables), and writes the `<mapname>.jsonc` config used by the
EntWatch built into [CS2Fixes](https://github.com/Source2ZE/CS2Fixes)
(`addons/cs2fixes/configs/entwatch/maps/`). Nothing is uploaded; parsing runs in a Web Worker.

- Formats: VPK (single or split), Source 2 resources, binary KV3 v0–v5 (LZ4/Zstd), `*.vents_c` entity lumps
  including `point_template` child lumps, DMX binary 9 `.vmap` with prefab lineage hammer ids.
- Workflow: drop files → pick a weapon → "Add as item" (handlers are suggested from parenting and outputs) →
  adjust event / mode / cooldown → download the jsonc. Existing configs can be imported and edited.
- Dev: `npm install --legacy-peer-deps`, `npm run dev`, `npm test`, `npm run build`. Deploy with the included
  GitHub Pages workflow (Settings → Pages → Source: GitHub Actions).
