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
    Workshop のアイテム（`steamapps\workshop\content\730\<ID>\<ID>.vpk`）はアドオン vpk の中に `maps/<マップ名>.vpk` が
    入れ子になっていますが、入れ子の vpk も（メモリに展開せず）そのまま辿ります。
    `point_template` の子ランプも読むので、テンプレートで生成される武器も一覧に出ます（`T` バッジ）。
  - Hammer `.vmap`（DMX binary 9）— プレハブの `.vmap` を一緒にドロップすると、プレハブ内のエンティティも
    `プレハブのnodeID:エンティティのnodeID` 形式の hammerid で取り込みます。
  - Chrome / Edge では「フォルダから選ぶ」で `steamapps\workshop\content\730` などを指定すると、中のマップを一覧から直接読み込めます（次回以降は同じフォルダをワンクリックで再オープン）。
    Steam が `Program Files` 配下にある場合はブラウザの制限でこのダイアログから開けないので、エクスプローラーからフォルダをページにドラッグ＆ドロップしてください（同じ一覧が出ます）。
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

1. 次のいずれかでツールを開きます。
   - **単一 HTML 版（インストール不要）**: [`release/entwatchmaker.html`](release/entwatchmaker.html) をダウンロードして
     Chrome / Edge で開くだけで動きます（Worker も埋め込み済みなので `file://` でそのまま動作します）。
   - GitHub Pages を有効にした URL を開く（下記「GitHub Pages で公開する」）。
   - ローカルで `npm install --legacy-peer-deps && npm run dev` して開く。
2. `.vmap` または `.vpk` をドロップします（初めてなら「サンプルマップを読み込む」で UI を試せます）。
3. 左上の `weapon_` を選び、中央のツリーで配線を確認しながら「アイテムとして追加」。追加したアイテムは左下の「EntWatch アイテム」一覧に並びます。
4. 一覧でアイテムを選び、右側でハンドラの `event` / `mode` / `cooldown` などを調整します。不要なアイテムは一覧の ✕ で削除できます。
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
- `triggers`: **eban 中のプレイヤーに触らせないトリガー** の一覧です（CS2Fixes は `trigger_teleport` / `trigger_multiple` / `trigger_once` の Touch をフックし、eban 者の接触だけを無効化します）。
  ホルダーが触れてアイテムを発動するトリガーだけを入れてください。押し返しや heal などの **効果ゾーンを入れると eban 中のプレイヤーがその効果を受けなくなります**。ツールは発動用トリガーだけを候補にし、効果ゾーンや対象外クラスは検証で警告します。
- `templated`: 同じテンプレートから複数スポーンしたアイテムで、武器とハンドラの `_N` 接尾辞を突き合わせるためのフラグです。通常は自動判定で足ります。書く意味があるのは「武器はテンプレート生成だがハンドラはマップに 1 つだけ」のときにハンドラ側へ `false` を付ける場合で、ツールはその場合だけ出力します。

## 推定ロジックと、GFL 設定 211 件から見た傾向

`Add as item` / `+` / `✨` で作られる雛形は、[gflze/CS2-ZE-Configs](https://github.com/gflze/CS2-ZE-Configs/tree/main/entwatch)
の EntWatch 設定 211 ファイル（1774 アイテム、2656 ハンドラ）の傾向に合わせています。

| 傾向 | 件数 | ツールでの扱い |
| --- | --- | --- |
| `button`（フックのみ、event なし）+ `OnPass` のフィルタ | 559 アイテム | 武器に親付けされたボタンは `{"type":"button","hammerid":..}` のみ、メッセージと cooldown は後段のフィルタ / リレー側に付ける |
| `button` + `OnPressed` 単独 | 333 | 後段が無ければボタン自身に event `OnPressed`, mode 2 |
| `button` + `OnTrigger` のリレー | 223 | リレーは `OnTrigger` |
| `button` + `counterdown` / `counterup` | 102 | `math_counter` は counter タイプ（`OnHitMin` があれば down、`OnHitMax` なら up） |
| `OnEqualTo` (logic_compare), `OnUser1/4`, `OnTrue` (logic_branch), `OnCaseNN` | 54 / 46 / 15 / 5 | イベント推定の事前確率に反映 |
| イベント系ハンドラは `type` を書かない | 1074 | 出力も同じ（CS2Fixes は未指定 = Other） |
| mode 2 の cooldown | 60 秒が最頻、次いで 50 / 65 / 75 / 70 / 90 / 80 | 秒数はマップの配線から推定（下記） |
| mode 3 の maxuses | 1 が大半（152 / 252） | mode 3 で maxuses 0 は警告 |
| `triggers` | 462 アイテム（ほぼ 1 件） | 武器に親付け / 武器を Kill する trigger_ を候補に |

**イベント推定**: エンティティが実際に発火している出力それぞれについて、その先の配線を 3 段まで追い、
「遅延付きの `Unlock` / `Enable` に到達する（= クールダウン付きの能力本体）」出力を最優先、次に効果の数、
最後に classname ごとの事前確率（filter → `OnPass`、button → `OnPressed`、relay → `OnTrigger` …）で順位付けします。
自身を `Kill` / `Lock` するだけの出力は下位になります。ハンドラ編集欄の event 候補はこの順で並び、推定と違う値のときは根拠付きで提案が出ます。

**クールダウン推定**: `Lock` → 遅延付き `Unlock`、`Disable` → 遅延付き `Enable`、ボタンの `wait` から秒数を読みます。
ハンドラ自身、その手前のボタン / physbox / game_ui、その先のフィルタ / リレー、親付けされた trigger を見ます。

**I/O 検索**: 中央上のタブでマップ内の全接続を検索できます（例: `in:unlock`、`out:onpressed`、`from:materia`、`class:filter`、遅延ありのみ）。
行の「+」で、その送信元エンティティをその出力を event にしたハンドラとして追加できます。

## マップ更新で hammerid が変わったとき

CS2Fixes の EntWatch はエンティティを **hammerid でのみ** 照合します（targetname / classname は設定に書けません）。
hammerid は同じ vmap を再コンパイルする限り変わりませんが、マッパーがエンティティを作り直したりプレハブに入れ替えたりすると変わります。

そのためこのツールは、設定内の各 hammerid が「どの classname / targetname のエンティティだったか」を覚えておき、
新しいバージョンのマップを読み込んだときに **名前で再照合** して hammerid を書き換えます。

1. 新しい vpk / vmap を読み込む（同じマップ名なら前回の設定が自動で復元されます。別名なら旧 jsonc を「既存の jsonc を読み込む」で取り込みます）
2. 一致しない hammerid があると右下に件数が出るので「名前で再照合」を押す
3. 自動で決まらなかったものは候補が並ぶのでクリックして選ぶ
4. 内容を確認してダウンロード

照合に使う情報は、(a) 設定を作ったときに読み込んでいたマップ、(b) このツールが出力する jsonc のコメント
（`"hammerid": "1202", // func_button fire_button`）の 2 つから集めます。コメントを消さずに保存しておくと、
ツールだけで旧設定を新マップへ移行できます。

## 開発

```bash
npm install --legacy-peer-deps
npm run dev        # 開発サーバー
npm test           # パーサ / モデルのユニットテスト (vitest)
npm run typecheck
npm run build         # dist/ に静的サイトを出力
npm run build:single  # release/entwatchmaker.html（全部入りの 1 ファイル）を生成
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

- Formats: VPK (single or split, and the nested `maps/<name>.vpk` inside workshop packages), Source 2 resources,
  binary KV3 v0–v5 (LZ4/Zstd), `*.vents_c` entity lumps including `point_template` child lumps, DMX binary 9 `.vmap`
  with prefab lineage hammer ids. Folders can be dropped onto the page (works for Steam installs under Program Files,
  which the folder picker dialog refuses).
- No install needed: download [`release/entwatchmaker.html`](release/entwatchmaker.html) and open it in Chrome / Edge
  (the parser worker is inlined, so it runs from `file://`). "Pick a folder" scans a local folder such as
  `steamapps\workshop\content\730` and lists the maps in it; nothing is uploaded.
- Workflow: drop files → pick a weapon → "Add as item" (handlers are suggested from parenting and outputs) →
  adjust event / mode / cooldown → download the jsonc. Existing configs can be imported and edited.
- Suggestions follow the conventions of the 211 GFL CS2 ZE configs (plain `button` hook + `OnPass`/`OnTrigger` handler,
  `type` omitted for event handlers, counters for `math_counter`); the event is the output whose chain reaches a delayed
  `Unlock`/`Enable`, the cooldown is that delay. An I/O search tab (`in:unlock`, `out:onpressed`, `class:filter`, …)
  lists every connection in the map and can add a handler from any row.
- Map updates: CS2Fixes matches entities by hammerid only, so the tool remembers the classname / targetname behind
  each id (from the loaded map and from the comments it writes into the jsonc) and offers "Re-match by name" when a
  newer map version no longer contains those ids.
- Dev: `npm install --legacy-peer-deps`, `npm run dev`, `npm test`, `npm run build`, `npm run build:single`. Deploy with the included
  GitHub Pages workflow (Settings → Pages → Source: GitHub Actions).
