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
    パッケージに複数のマップ（3D スカイボックスや `maps/stages/` のステージ用マップ）があるときは、
    `maps/` 直下でスカイボックスでないもののうちエンティティの多いマップを読みます（ze_castlevania など、ステージ用マップの方がファイルが大きいことがあります）。
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
3. 左の `weapon_` を選び、中央のツリーで配線を確認しながら「アイテムとして追加」。
4. 右側でハンドラの `event` / `mode` / `cooldown` などを調整します。間違えて追加したアイテムは、一覧の行末 ✕ か編集欄上部の「このアイテムを削除」で消せます（ハンドラは枠右上の ✕、トリガーはチップの ✕、全部やり直すなら「すべて削除」）。
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

**クールダウン推定**: `Lock` → 遅延付き `Unlock`、`Disable` → 遅延付き `Enable`、ボタンの `wait`、
logic_branch / logic_compare / math_counter の `SetValue 1` → 遅延付き `SetValue 0` から秒数を読みます。
ハンドラ自身、その手前のボタン / physbox / game_ui、その先のフィルタ / リレー、親付けされた trigger を見ます。

**game_ui（クラス系アイテムの左右クリック）**: `game_ui` 本体だけでなく、`vscripts=game_ui` を持ち `caseNN` に
`PressedAttack` などのキー名を書いた `logic_case`（スクリプト実装。skyrim / minas tirith などの workshop マップで一般的）も
game_ui として扱います。武器の `OnPlayerPickup → Activate` から ui を見つけ、キーごとの出力（`OnCaseNN` / `PressedAttack`）の先にある
リレー / compare / counter をハンドラにします。キーが 2 つ以上あるときはハンドラの `name` にキー名（`Attack` / `Attack2` / `Forward` …）を入れます。
ui 自身は、後ろに何も無いときだけハンドラになります。

**フィルタの後ろ**: ボタン → フィルタ → relay / counter の鎖では、フィルタが使用者を確かめて後ろの relay / case / counter に
渡すだけ（ボタンの `Lock` / `Unlock` のような後始末を除いて効果を持たない）なら、後ろの relay などをハンドラにします。
GFL 設定はこの形のほとんどで後ろの relay を載せ、フィルタ自身が効果を持つときはフィルタを載せています。
フィルタが自分だけで数える `math_counter`（そのアイテムの使用回数 / 弾数）を `Add` / `Subtract` するときは counter をハンドラにします
（複数のアイテムのフィルタが数える共有 counter は除きます）。relay の cooldown は、手前のフィルタがボタンを Lock / Unlock する配線からも読みます。

**使用回数**: ハンドラ自身の出力が N 回しか発火しない（Hammer の Only once）ときは mode 3 / maxuses N にします。
出力の無いボタンでも、アイテムのロジックが Lock / Unlock しているもの（ze_santassination_p）は +use のフックとして残します。

**ハンドラにしないもの**: `Kill` / `Disable` / `Enable` / `Deactivate` / `CancelPending` / `Lock` / `Unlock` などの後始末入力は
「ボタンから撃たれている」に数えません。`OnBreak` しか撃たない physbox（当たり判定）、出力の無い filter（ナイフ除去用の部品）、
他のロジックを Enable / Disable するだけの relay（キーコンボの段）、他の relay に `Trigger` するだけの relay（先の relay を代わりに判定）、
strip を撃つ relay、ボタンから撃たれていない logic_timer は候補から外し、理由をメモに出します。

**テンプレート（point_template）**: `NNN#entityLumpName` という lump は point_template #NNN の子で、中の `origin` は
テンプレート基準のローカル座標です。距離を測るときは、そのテンプレートを `entitytemplate` に持つ env_entity_maker
（無ければ point_template 自身）の origin を足してワールド座標にします。名前修飾（`[PR#]` 接頭辞、`&0000` 接尾辞）は
名前解決のときに外すので、`template07=[PR#]ww_knife` から `[PR#]ww_knife&0000` が引けます。

**ナイフ / クラス系アイテムの `triggers`**: ナイフは武器を strip しないと拾えないため、こうしたアイテムは
「アイテムの上の strip ゾーン」と「そこへ飛ばすテレポート」で配られます。どちらも武器と名前でつながっていないので、
`weapon_knife*` / `weapon_bayonet` のときは次を `triggers` 候補にします。
- 武器のテンプレートを `ForceSpawn` する trigger（env_entity_maker 経由も含む）
- マップが武器に結び付けている strip ゾーン: 武器と同じテンプレート lump にある、武器に親付けされている、
  または武器の `OnPlayerPickup` の送り先（拾ったら Kill するもの）。結び付いたものが無いときだけ、武器の真上
  32 ユニット以内にあって他の武器より近い strip ゾーンも入れます。位置が近いだけの strip ゾーン（ラウンド開始時の strip や
  隣のアイテムのもの）は付けません（GFL 設定は結び付いた strip ゾーンの 136 / 139 を載せ、隣のアイテム寄りのものは 1 つも載せていません）。
  strip の判定は `player_weaponstrip` / `game_player_equip`、`point_script` への `RunScriptInput "*Strip*"`、
  `point_entity_finder` の `FindEntity`（`OnFoundEntity → Kill`）
- 着地点（`trigger_teleport` の `target`、または `point_teleport`）が武器から 64 ユニット以内、または strip ゾーンの上にあるテレポート。
  着地点は **最も近い武器にだけ** 割り当てるので、隣のアイテムのテレポートは付きません（GFL 設定の着地点はどれも数十ユニット以内です）
ヘッダの「エンティティ一覧を書き出す」で全エンティティを JSON 保存できるので、推定がうまくいかないマップはそのファイルで配線を確認できます。

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

### コマンドラインで解析する（Node.js がある PC 向け）

```bash
# 全エンティティを JSON に書き出す（UI の「エンティティ一覧を書き出す」と同じ形式）
npm run dump:entities -- "C:\Program Files (x86)\Steam\steamapps\workshop\content\730\3242492031" out.json

# 既存の jsonc とツールの推定を武器ごとに突き合わせ、ハンドラ / トリガーの配線と周辺エンティティをレポートする
npm run diagnose -- <vpk か vmap かそのフォルダ> [entwatch/<map>.jsonc] [--all] > report.md
```

`diagnose` は推定に失敗したマップを調べるためのもので、「ツールの提案 vs 設定」「設定のハンドラ / トリガーがどのエンティティで、誰に撃たれ、何を撃つか」「武器の周囲 512 ユニットにあるもの」を出します。テンプレート内のエンティティは、ローカル座標に加えてワールド座標も表示します。

```bash
# GFL の設定と照合して推定の精度を測る（Workshop フォルダを丸ごと指定できる）
npm run evaluate -- <CS2-ZE-Configs/entwatch> "C:\Program Files (x86)\Steam\steamapps\workshop\content\730" --out eval
```

`evaluate` は、読み込めたマップのうち同名の GFL 設定があるものについて、設定の各アイテムでツールの提案と
ハンドラ / トリガーの hammerid、type / event / mode / cooldown / maxuses を突き合わせ、`eval/report.md`（全体とマップ別の一致率）、
`eval/details.md`（一致しなかったアイテムごとの差分）、`eval/results.json` を書き出します。複数のマップを含むパッケージでは
設定と同名のマップを使い、ローダー単体なら別のマップを読む場合はレポートに出します。ヒューリスティクスを変えたときは
この数字で良くなったか確かめてください（アイテムが完全一致する割合は 2026-09 時点で約 41%。残りの多くは、同じ配線でも
ボタン単独で数えるかボタン + 後段で数えるかといった設定作者ごとの書き方の違いです）。

`tests/diagnostics.test.ts` は、`dump:entities` で書き出した ze_tesv_skyrim_p / ze_lotr_minas_tirith_p の JSON
（`skyrim.entities.json` / `minas.entities.json`）を置いたフォルダを `DIAG_DUMP_DIR` で指すと、GFL 設定のハンドラ / トリガーを
ツールが再現できるかを採点します（無ければスキップ）。ヒューリスティクスを変えたときの回帰確認に使います。

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
| `scripts/` | Node 用: `dump-entities.ts`（JSON 書き出し）, `diagnose.ts`（設定との突き合わせレポート）, `evaluate.ts`（GFL 設定との一致率） |

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
- キーコンボ（複数のキーを順番に押すと発動する能力）は、次の段を `Enable` するだけの relay の連鎖なので途中は追えません。
  最後の段が `Trigger` / `Compare` する先は拾いますが、コンボ本体のハンドラは I/O 検索で足してください。
- `KeyValues origin` で位置を変えながら 1 つのテンプレートを何度も ForceSpawn するマップでは、テンプレート内の武器の位置は
  最初の maker / テンプレートの位置としてしか計算できません。
- ハンドラの推定はあくまで雛形です。マップごとの仕様（cooldown 秒数、maxuses など）は必ず確認してください。
- 同じ配線でも、ボタン単独を mode 2 / 3 で数える書き方と、ボタンはフックだけで後段のフィルタ / relay を数える書き方が
  設定作者ごとに混在しています。ツールは多数派（後者）で出します。
- 一部の GFL 設定が使う `"type": "counter"` / `"mode": 6` には対応していません（読み込むと other / mode 1 になります）。

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
  `Unlock`/`Enable` (or a `SetValue 1` / delayed `SetValue 0` pair on a branch / compare / counter), the cooldown is that
  delay. An I/O search tab (`in:unlock`, `out:onpressed`, `class:filter`, …) lists every connection in the map and can
  add a handler from any row.
- Class items: a `game_ui`, or its script stand-in (a `logic_case` with `vscripts=game_ui` and `caseNN = PressedAttack…`),
  is found through the weapon's `OnPlayerPickup → Activate`; the relays behind each key become the handlers (named
  `Attack` / `Attack2` … when there are several keys). Housekeeping inputs (Kill / Disable / Enable / Deactivate …) never
  count as "fed by a button", OnBreak-only physboxes, output-less filters, combo-step relays and strip relays are skipped.
  Entities in `NNN#entityLumpName` lumps get world positions (env_entity_maker or point_template origin + local origin) and
  the `[PR#]` / `&0000` name decorations are ignored when resolving names. Knife items get `triggers` from the trigger that
  ForceSpawns their template, strip zones (`player_weaponstrip`, `point_script RunScriptInput "*Strip*"`,
  `point_entity_finder` → Kill) the map ties to the knife (same template lump, parented to it, or fired at by its
  `OnPlayerPickup`; failing that, a zone within 32 units on top of it) and teleports landing within 64 units, each
  landing assigned to the nearest weapon only.
- Button → filter → relay / counter: a filter that only checks the user and hands the use on to relays / cases /
  counters is replaced by those (as in most GFL configs); a filter with effects of its own stays, unless it counts an
  item-specific `math_counter`, which then reports the use. An output that fires only N times gives mode 3 / maxuses N.
  A button without outputs that the item's logic locks and unlocks is still the +use hook.
- Workshop packages holding several maps (3D skybox, `maps/stages/…`) are read through the map right under `maps/`
  that is not a skybox and has the most entity data, not the biggest file.
- Accuracy: `npm run evaluate -- <CS2-ZE-Configs/entwatch> <workshop/content/730 or map folders> --out eval` compares
  the suggestions with the GFL configs of every map it can load (report.md, details.md, results.json). About 41% of
  the items come out identical (Sept 2026); most of the rest differ in per-author style (counting the button itself vs.
  a plain button hook plus the filter / relay behind it). GFL's `"type": "counter"` / `"mode": 6` are not supported.
- Map updates: CS2Fixes matches entities by hammerid only, so the tool remembers the classname / targetname behind
  each id (from the loaded map and from the comments it writes into the jsonc) and offers "Re-match by name" when a
  newer map version no longer contains those ids.
- Dev: `npm install --legacy-peer-deps`, `npm run dev`, `npm test`, `npm run build`, `npm run build:single`. Deploy with the included
  GitHub Pages workflow (Settings → Pages → Source: GitHub Actions).
