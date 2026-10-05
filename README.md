# entWatchMaker

CS2 の Hammer マップ (`.vmap`) や Workshop からダウンロードした `.vpk` をブラウザで読み込み、
Zombie Escape のアイテム（`weapon_*` エンティティ）と、それに関連するボタン / フィルタ / カウンター /
トリガーをツリー表示・Input/Output 確認しながら、[CS2Fixes](https://github.com/Source2ZE/CS2Fixes) 内蔵
EntWatch 用の `<マップ名>.jsonc` を作るツールです。

同じ読み込み・ツリー・Input/Output 画面を使って、[StripperCS2](https://github.com/Source2ZE/StripperCS2)
（マップのエンティティを削除・追加・変更する Metamod プラグイン）の設定を作る **Stripper モード**もあります
（画面上部の「EntWatch / Stripper」スイッチで切り替え → [Stripper モード](#stripper-モードstrippercs2-の設定を作る)）。

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
  どのアイテムに書いたかは関係なく、マップの設定全体に書かれた hammerid がすべて対象です。アイテムを **配るトリガー**
  （アイテム部屋へのテレポート、アイテムの上の strip ゾーン、そのアイテムだけを出すトリガー）だけを入れてください。
  押し返しや heal、ゾンビのダメージなどの **効果ゾーンを入れると eban 中のプレイヤーがその効果を受けなくなり**、
  ステージ開始のトリガーを入れると eban 中のプレイヤーはステージを進められなくなります。ツールはナイフ / クラス系アイテムの配布トリガーだけを候補にし、効果ゾーンや対象外クラスは検証で警告します。
- `templated`: 同じテンプレートから複数スポーンしたアイテムで、武器とハンドラの `_N` 接尾辞を突き合わせるためのフラグです。通常は自動判定で足ります。書く意味があるのは「武器はテンプレート生成だがハンドラはマップに 1 つだけ」のときにハンドラ側へ `false` を付ける場合で、ツールはその場合だけ出力します。

## 推定ロジックと、GFL 設定 211 件から見た傾向

`Add as item` / `+` / `✨` で作られる雛形は、[gflze/CS2-ZE-Configs](https://github.com/gflze/CS2-ZE-Configs/tree/main/entwatch)
の EntWatch 設定 211 ファイル（1774 アイテム、2656 ハンドラ）の傾向に合わせています。

| 傾向 | 件数 | ツールでの扱い |
| --- | --- | --- |
| `button`（フックのみ、event なし）+ `OnPass` のフィルタ | 559 アイテム | 武器に親付けされたボタンは `{"type":"button","hammerid":..}` のみ、メッセージと cooldown は後段のフィルタ / リレー側に付ける |
| `button` + `OnPressed` 単独 | 333 | 後段が無ければボタン自身に event `OnPressed`, mode 2 |
| `button` + `OnTrigger` のリレー | 223 | リレーは `OnTrigger` |
| `button` + `counterdown` / `counterup` | 102 | `math_counter` は counter タイプ。使用ごとに 1 ずつ増減する counter は mode 3 / 4（下記「counter」） |
| `OnEqualTo` (logic_compare), `OnUser1/4`, `OnTrue` (logic_branch), `OnCaseNN` | 54 / 46 / 15 / 5 | イベント推定の事前確率に反映 |
| イベント系ハンドラは `type` を書かない | 1074 | 出力も同じ（CS2Fixes は未指定 = Other） |
| mode 2 の cooldown | 60 秒が最頻、次いで 50 / 65 / 75 / 70 / 90 / 80 | 秒数はマップの配線から推定（下記） |
| mode 3 の maxuses | 1 が大半（152 / 252） | mode 3 で maxuses 0 は警告 |
| `triggers` | 462 アイテム（ほぼ 1 件） | ナイフ / クラス系アイテムを配る trigger だけ（下記）。アイテムに組み込まれた trigger は載せない |

**イベント推定**: エンティティが実際に発火している出力それぞれについて、その先の配線を 3 段まで追い、
「遅延付きの `Unlock` / `Enable` に到達する（= クールダウン付きの能力本体）」出力を最優先、次に効果の数、
最後に classname ごとの事前確率（filter → `OnPass`、button → `OnPressed`、relay → `OnTrigger` …）で順位付けします。
自身を `Kill` / `Lock` するだけの出力は下位になります。同点ならクールダウンにつながる出力を選びます。押下がスクリプトに確認を頼むだけ
（`OnPressed → RunScriptInput CheckOwner`）で、自分の `OnUser1`〜`4` が Lock やクールダウンを持つときは、スクリプトがその出力で
答えるので `OnUserN` を選びます（ze_genso_of_last_v4）。ハンドラ編集欄の event 候補はこの順で並び、推定と違う値のときは根拠付きで提案が出ます。

**クールダウン推定**: 使用そのものが起こす配線だけを見ます。押下（とハンドラの event）から出力を遅延を足し合わせながら追い、
通り道のゲート（ボタン / フィルタ / relay / branch …）が `Lock` → `Unlock`、`Disable` → `Enable`、
`SetValue 1` → `SetValue 0` で閉じてから再び開くまでの時間をクールダウンにします（ハンドラより手前のゲートを優先し、複数あれば最も遅いもの）。
1 回しか発火しない出力を使用が使い切り、後で `AddOutput` で足し直す配線（`OnUser1 → !self AddOutput "OnUser4>!self>FireUser1>>0>1"` を 30 秒後）も、
足し直すまでをクールダウンにします（ze_last_man_standing_p）。
ゾンビの沈黙スキルが人間のアイテム relay を 8 秒止める、ボスの relay がアイテムの branch を戻す、といった他の配線からの再有効化は数えません。
2 秒以下の遅延は連打防止として cooldown 0（GFL 設定もほぼ 0。CS2Fixes は 1 秒の猶予を持つのでゲーム内の差もありません）、
ボタンの `wait` は既定値 3 秒を超えるときだけ数えます。counter の `OnHitMax` / `OnHitMin`（数回使った後のオーバーヒート）は毎回のクールダウンに含めません。
使用がボタンを Lock したまま別の配線（ミニゲーム終了など）が Unlock するときは、その Unlock の遅延を使います。

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

**counter**: CS2Fixes は mode 5（値の表示）の counter の使用をチャットに流しません。アイテムの使用（ボタン / game_ui から続く
filter / relay）が 1 ずつ `Add` / `Subtract` し、タイマーや自分自身のループで増減せず、同じ所が後で戻しもしない counter は
使用回数を数えているので mode 3（`Add` なら counterup、`Subtract` なら counterdown。回数は counter の min / max から）にし、
クールダウンは手前の配線から読みます。上限で アイテムを Lock し N 秒後に戻す（counter の `SetValue 0` / `Unlock`）ものは mode 4、cooldown N。
それ以外（タイマーで溜まるチャージ、30 ずつ減るゲージ、コンボメーター）は mode 5 / message false です。
評価したマップでは GFL の mode 3 / 4 の counter 58 件中 57 件、mode 5 の 22 件すべてと一致します。
使用が値を読むだけの counter（`GetValue` → compare：太陽が足りるか）はハンドラにせず、その先の compare の結果のうち
アイテムを Lock する / クールダウンを持つ方を、色や音を返すだけの「足りない」側より優先します。
弾数・燃料・リキャストのように、使い切るとボタンを `Lock` / `Disable` し、タイマーで回復・消費する counter は、押下から続く
relay / branch の代わりに mode 5 で HUD に出し、ボタン自身が押下を通知します（`OnPressed`、mode 1、HUD なし）。
GFL 設定もこうした counter を持つアイテムの 40 件中 34 件が「ボタン + counter」です。
使用回数を数え、上限（`OnHitMax` / `OnHitMin`）でボタンを Kill / Lock する counter（地雷・ロケットの弾数）も同じように
手前の relay / branch の代わりにハンドラにします。こちらは counter 自身が使用を通知する（mode 3）ので、ボタンは +use のフックのままです。
ただし counter を増減させるのがアイテムの使用とタイマーだけのときに限ります（ボスの HP counter が倒れたときにアイテムを止める形は除きます）。
上限でボタンではなく押下から続く relay を止めっぱなしにする counter（燃料切れで火炎放射の relay を Disable）も同じ扱いです。
上限で Disable して後で Enable し直す counter（オーバーヒート）はクールダウンなので、relay をハンドラのままにします。

**使用回数**: ハンドラ自身の、効果のある出力がすべて N 回しか発火しない（Hammer の Only once）ときは mode 3 / maxuses N にします（初回だけの音や一度きりの補正が 1 本あるだけでは制限しません）。
使用から 15 秒以内に、ハンドラかそのボタンを Kill する、または Lock / Disable してマップのどこからも Unlock / Enable しない
アイテムは使い切り（mode 3 / maxuses 1）です。拾ったときの trigger_once など一度しか発火しない Unlock は使用前の準備なので数えません。
別のエンティティの分岐（ランダムな case の一部の結果）、physbox が壊れたとき（OnBreak）の Kill、手前にあるステージのボタンが後で自分を Kill するのは使い切りではありません。
出力の無いボタンでも、アイテムのロジックが Lock / Unlock しているもの（ze_santassination_p）は +use のフックとして残します。
後ろに filter / relay などのハンドラがあるアイテムのボタンは +use のフックだけにしますが、自分のクールダウンや使用回数を持ち、
後ろのハンドラにつながっていないボタン（別のボタンの攻撃とは別の必殺技、game_ui のキーとは別に OnUser4 で数えるボタン）は
そのまま押下を報告します。

**ハンドラにしないもの**: `Kill` / `Disable` / `Enable` / `Deactivate` / `CancelPending` / `Lock` / `Unlock` などの後始末入力は
「ボタンから撃たれている」に数えません。`OnBreak` しか撃たない physbox（当たり判定）、出力の無い filter（ナイフ除去用の部品）、
他のロジックを Enable / Disable するだけの relay（キーコンボの段）、他の relay に `Trigger` するだけの relay（先の relay を代わりに判定）、
strip を撃つ relay、ボタンから撃たれていない logic_timer は候補から外し、理由をメモに出します。
タイマー（と自分が回す counter のループ）にしか撃たれないゲート（弾薬アイテムの `give_ammo`）、ヒント表示や音だけを返す 2 つ目のボタン
（回復待ちの「ロック中」表示）、ボタンを `Press` するだけの physbox（プレイヤーが E を押す当たり判定。押されたボタンが使用を報告します）も
外します。テンプレート内で唯一のゲートを代わりにハンドラにするのは、ボタンや filter が何も選ばれなかったときだけです（`OnSpawn` だけで
動く準備用の relay、武器から値をセットされるだけの branch は使いません。入力が何も無い relay はスクリプトや AddOutput から撃たれるので
使います。counter は使用回数なので、ボタンがあっても使います）。game_ui は、キーの出力がモデルの `FireUser1` などを経由して
選んだ relay に届くときも、自分ではハンドラになりません。キーが複数あるときは、クールダウンの配線も使用回数も無いキー
（通常攻撃や切り替え）を外します。2 秒の連打防止でも配線があれば残します（GFL 設定は書いています）。
テンプレート生成の武器では、**テンプレートの外（default_ents など）にあって、マップや別のアイテムからも動かされる relay / counter / filter は
ハンドラにしません**（ボスの HP counter、ステージやタイマーが動かす counter、別のアイテムも撃つボス用 relay）。テンプレートから数手で届くものを
いったんアイテムのものとし、外から動かされるもの、そこから先のものを順に外します。値をセットするだけの入力（ステージがアイテムを止める
`SetValue`）、武器を含まないテンプレート（アイテムが出す部品）、何にも撃たれていないロジック（アイテムが出す拾い物の filter）は
「外から」に数えません。アイテムだけが動かす default_ents の filter / relay はハンドラのままです。GFL 設定はこれを載せていて、
CS2Fixes もテンプレート番号の付かないエンティティは武器の出現 0.5 秒後に登録するので、`"templated": false` は要りません。
テンプレート内の relay が外のロジックに渡すだけのときは、その relay 自身がハンドラになります。

**テンプレート（point_template）**: `NNN#entityLumpName` という lump は point_template #NNN の子で、中の `origin` は
テンプレート基準のローカル座標です。距離を測るときは、そのテンプレートを `entitytemplate` に持つ env_entity_maker
（無ければ point_template 自身）の origin を足してワールド座標にします。名前修飾（`[PR#]` 接頭辞、`&0000` 接尾辞）は
名前解決のときに外すので、`template07=[PR#]ww_knife` から `[PR#]ww_knife&0000` が引けます。

**ナイフ / クラス系アイテムの `triggers`**: ナイフは武器を strip しないと拾えないため、こうしたアイテムは
「アイテムの上の strip ゾーン」と「そこへ飛ばすテレポート」で配られます。どちらも武器と名前でつながっていないので、
`weapon_knife*` / `weapon_bayonet` のときは次を `triggers` 候補にします。
- 武器のテンプレートを `ForceSpawn` する trigger（env_entity_maker 経由も含む）。ただし他のアイテムも出すもの、
  扉を開ける / テレポートを有効にする / 壁を消すなどステージを進めるものはステージ開始のトリガーなので付けません
  （GFL 設定はこの 17 件を載せ、ステージ開始のものは 1 つも載せていません）
- マップが武器に結び付けている strip ゾーン: 武器と同じテンプレート lump にある、武器に親付けされている、
  または武器の `OnPlayerPickup` の送り先（拾ったら Kill するもの）。結び付いたものが無いときだけ、武器の真上
  32 ユニット以内にあって他の武器より近い strip ゾーンも入れます。位置が近いだけの strip ゾーン（ラウンド開始時の strip や
  隣のアイテムのもの）は付けません（GFL 設定は結び付いた strip ゾーンの 136 / 139 を載せ、隣のアイテム寄りのものは 1 つも載せていません）。
  strip の判定は `player_weaponstrip` / `game_player_equip`、`point_script` への `RunScriptInput "*Strip*"` / `"*PickUp*"`（拾えるかをスクリプトが決める、ze_castlevania）、ナイフに結び付いていて最初から有効で、触れるとスクリプトを呼ぶだけのゾーン（ze_atos の `item_*_weapon_pick`）、
  `point_entity_finder` の `FindEntity`（`OnFoundEntity → Kill`）
- 着地点（`trigger_teleport` の `target`、または `point_teleport`）が武器から 64 ユニット以内にあるテレポート。
  着地点は **最も近い武器にだけ** 割り当てるので、隣のアイテムのテレポートは付きません（GFL 設定の着地点はどれも数十ユニット以内です）。
  アイテム自身のロジックが有効にするテレポート（ゾンビが人間を引き寄せるポータルなど）は能力の一部なので付けません。
  ハンドラから先の配線に加えて、`AddOutput` で実行時に結ばれる先（能力がポータルの maker を後から繋ぐもの）と、
  武器自身の `OnPlayerPickup` 以外の出力（持ち主が抜けたときに、捕まえた人間を戻す救出テレポートを有効にする後始末）もたどります。

アイテムに組み込まれた trigger（ホルダーが触れて発動するゾーン、武器に親付けされたダメージ / 重力ゾーン、拾えるようにする
`ToggleCanBePickedUp` の trigger）はハンドラ探しには使いますが `triggers` には載せません。GFL 設定もこの種類は 1 つも載せていません（評価したマップで 0 / 44）。
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

## Stripper モード（StripperCS2 の設定を作る）

画面上部のスイッチを **Stripper** にすると、右側が StripperCS2 の設定（`filter` / `add` / `modify`）の編集になります。
マップの読み込み、エンティティ一覧、関連ツリー、プロパティ / Output / Input の表示、I/O 検索はそのまま使えます。
手で jsonc を書く代わりに、見ているエンティティからアクションを作ります。

| やりたいこと | 操作 | 出力される内容 |
| --- | --- | --- |
| エンティティを消す | 詳細パネルの「このエンティティを削除」（ツリー行の ✂ でも可） | `filter`（`classname` + `hammeruniqueid`） |
| 同じ classname をすべて消す | 「同じ classname をすべて削除」 | `filter`（`classname` のみ） |
| プロパティを書き換える / 足す / 消す | プロパティ表の ✎ / 🗑、下の「＋ キーを追加」 | `modify` の `replace` / `insert` / `delete`（同じエンティティの編集は 1 つの `modify` にまとまる） |
| Output を消す | Output 表の 🗑（Input 表・I/O 検索の 🗑 なら送信元の Output を消す） | `modify` の `delete.io` |
| Output を書き換える | Output 表の ✎ → 右のエディタで変えたい欄だけ入力 | `match.io` + `replace.io` |
| Output を足す | Output 表下の「＋ 出力を追加」 | `modify` の `insert.io` |
| エンティティを複製する | 「複製して追加」 | `add`（`hammeruniqueid` を除いた全キー値と全 Output） |
| 自由に書く | 右上の「＋ 削除 / 変更 / 追加」 | 空のアクション。照合は「選択中のエンティティから作る」で ID / 名前 / 位置 / クラスから自動入力 |

- **一致件数がその場で出ます。** 各アクションに「1 件に一致」「一致なし」が付き、一致したエンティティをクリックして確認できます。
  左の一覧とツリーには、削除される ✂ / 変更される ✎ のバッジが付き、詳細パネルの「適用後」タブで書き換え後のプロパティと Output の差分を見られます。
- **照合の既定は `classname` + `hammeruniqueid`** です。マップ更新で ID が振り直されても誤爆しないよう `classname` を併記し、一致しなければ何も起きません
  （名前で照合に切り替えるボタンもあります）。値を `/…/` で囲むと正規表現です。
- **出力先は lump ごとのファイル**です。メインは `addons/StripperCS2/maps/<マップ>/default_ents.jsonc`、`point_template` の子 lump は
  `maps/<マップ>/9#entitylumpname.jsonc` のように lump 名のファイルになります。エンティティの lump から自動で振り分け、複数ファイルのときは
  「すべて zip で保存」で `addons/StripperCS2/…` 付きの zip にまとめます（`csgo` フォルダに展開）。`global_map.jsonc`（メイン lump だけ）/
  `global_lump.jsonc`（全 lump）も出力先に選べます。
- **既存の StripperCS2 の jsonc も読み込めます**（同じキーを繰り返した `"add"` や単一オブジェクト形式も可）。末尾カンマなど、プラグインが読めない書き方には警告が出ます。
- 編集内容はマップ名ごとにブラウザへ保存されます（EntWatch の設定とは別）。

プラグインの実装（`src/actions/actions.cpp` / `json_actions.cpp`）に合わせた挙動で、ツールはこれを再現して件数を出しています。

- 実行順は lump ごとに **filter → add → modify**（ファイル内の並びは無関係）。そのため `filter` は同じファイルの `add` で作ったエンティティを消せず、`modify` は `add` したエンティティにも一致します。
  lump のファイル → `global_map` → `global_lump` の順に適用されます。
- キー値はすべて **文字列**です（数値で書くとプラグインが読み込みに失敗します）。正規表現は PCRE2 で、**大文字小文字を区別せず部分一致**です（完全一致は `/^…$/`）。
- `match` が空の `filter` は lump の全エンティティを消します。`delete` のキーは値が一致したときだけ消えるので、値を問わず消すなら `/.*/` です（ツールはエンティティの現在値を書きます）。
- `replace.io` は `match.io` で選んだ Output すべてに適用され、`match.io` が空だと何も起きません。

注意点:

- 正規表現の一致件数は JavaScript の正規表現で数えています。PCRE2 固有の構文（`(?i)` など）は件数を出せず、エラー扱いになることがあります。
- `origin` / `angles` はゲーム内部の文字列表現がこのツールの表示と違う可能性があるため、一致しないことがあります（警告が出ます）。ID か名前での照合が確実です。
- lump 名は vpk 内のパス（`maps/<マップ>/entities/<lump>.vents_c`）から決めています。`.vmap` を読み込んだ場合は lump 構成が分からないため、すべて `default_ents` として扱います。
  サーバーで `entity_lump_list` を実行して、実際の lump 名と合っているか確認してください。
- プラグインの動作確認（実機でのマップロード）まではしていません。出力はプラグインのソースとスキーマ（`schema.json`）に合わせています。

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
# GFL の設定と照合して推定の精度を測る（Workshop フォルダを丸ごと、いくつでも指定できる）
npm run evaluate -- <CS2-ZE-Configs/entwatch> "C:\Program Files (x86)\Steam\steamapps\workshop\content\730" --out eval [--prefer <ids.tsv>]
```

`evaluate` は、読み込めたマップのうち同名の GFL 設定があるものについて、設定の各アイテムでツールの提案と
ハンドラ / トリガーの hammerid、type / event / mode / cooldown / maxuses を突き合わせ、`eval/report.md`（全体とマップ別の一致率）、
`eval/details.md`（一致しなかったアイテムごとの差分）、`eval/results.json` を書き出します。複数のマップを含むパッケージでは
設定と同名のマップを使い、ローダー単体なら別のマップを読む場合はレポートに出します。同じマップが複数のフォルダにあるとき
（作者のアップロードと GFL コレクションのもの）は 1 つだけ評価します: `--prefer` のファイルに挙げた Workshop ID（GFL の
Workshop コレクションの ID 一覧など。1 行 1 件、タブ区切りなら 1 列目）のフォルダ、なければ設定の hammerid が多く見つかるほうです。

report.md 先頭の「ゲーム内で設定と同じ動きをするアイテム」は、CS2Fixes での動作で比べた指標です。ボタン単独で数えるか、
ボタンのフック + 後段のフィルタ / リレーで数えるかといった書き方だけの違いは、GFL とツールのどちらがどちらでも同じとみなします（GFL が同じボタンを「+use のフックだけ」と
「その OnUser1 / OnUser4 で数える行」の 2 行で書いたものも、CS2Fixes では 1 つの button ハンドラと同じなので 1 つにまとめて比べます）。次を確かめます:
GFL がフックするボタンをフックしているか（CS2Fixes は button ハンドラで持ち主以外の +use を止めます）、GFL の各ハンドラに
同じ使用で発火する相手があり余分なハンドラが無いか、チャット通知が同じか（mode 5 の counter は通知しません）、
アイテムが HUD に出るか（CS2Fixes は ui のどれかが有効なら 1 行出します。GFL の `"counter"`（mode 6）は counter の表示として比べます）、
cooldown の差が 1 秒以内か（CS2Fixes の猶予。2 秒以下は 0 と同じ扱いで、そのうえで 1 秒以上離れたものだけを違いとします）、使用回数、triggers（CS2Fixes と同じくマップ全体で比べます）。
「What differs in game」の表に、残っている違いの種類ごとの件数が出ます。ヒューリスティクスを変えたときはこの数字で
良くなったか確かめてください（2026-10 時点の 186 マップで、ゲーム内で同じ動き 79%、完全一致 58%）。

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
| `src/model/stripper.ts` | StripperCS2 設定のモデル、jsonc の書き出し / 読み込み（重複キー対応）、lump → ファイルの対応 |
| `src/model/stripperMatch.ts` | プラグインの照合と filter → add → modify の再現（一致件数・適用後の状態） |
| `src/model/stripperBuild.ts` | エンティティからの照合 / 削除 / 複製 / キー値・Output 編集の生成 |
| `src/model/stripperValidate.ts` | Stripper 設定の検証 |
| `src/model/zip.ts` | 複数ファイルをまとめる zip 書き出し |
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
  `Unlock`/`Enable` (or a `SetValue 1` / delayed `SetValue 0` pair on a branch / compare / counter), winning ties too; a
  press that only asks a script (`OnPressed → RunScriptInput CheckOwner`) gives way to the entity's own `OnUser1`–`4`
  that locks it or starts its cooldown, which the script fires when it lets the use through. The cooldown is read
  from what the use itself sets off: the chain is followed from the press with the delays added up, and the cooldown is
  the time until the gates the use goes through (button, filter, relay, branch; those in front of the handler first) are
  open again (a once-only output the use spends stays closed until an `AddOutput` adds it back). Re-enables from
  other wiring (a zombie silence, a boss relay) do not count, delays of 2 s or less are
  double-press guards (cooldown 0), a button `wait` counts only above the default 3 s, and a counter's `OnHitMax` /
  `OnHitMin` (an overheat after several uses) is not the per-use cooldown. An I/O search tab (`in:unlock`,
  `out:onpressed`, `class:filter`, …) lists every connection in the map and can add a handler from any row.
- Class items: a `game_ui`, or its script stand-in (a `logic_case` with `vscripts=game_ui` and `caseNN = PressedAttack…`),
  is found through the weapon's `OnPlayerPickup → Activate`; the relays behind each key become the handlers (named
  `Attack` / `Attack2` … when there are several keys). Housekeeping inputs (Kill / Disable / Enable / Deactivate …) never
  count as "fed by a button", OnBreak-only physboxes, output-less filters, combo-step relays and strip relays are skipped.
  So are gates only a timer drives (besides the counter they loop through: the ammo item's `give_ammo`), a second
  button that only answers the player (a "locked" hint) and a physbox that only `Press`es the item's button (the button
  reports the use). The template's lone gate stands in for the use only when no button or filter was chosen (not a relay
  running only `OnSpawn`, not a branch the weapon only stores a value on; a relay with no inputs at all is fired by a
  script or an AddOutput and still counts, and a lone counter is the use count either way), and a game_ui whose key
  reaches a chosen relay through another entity (the model's `FireUser1`) is not a handler itself. Of several keys, those
  with neither cooldown wiring nor uses (a plain attack, a toggle) are left out; a 2 s double-press guard still counts as
  wiring (the GFL configs list such keys).
  For a templated weapon, logic outside its template lump that the map or another item drives too (a boss HP counter, a
  counter stages or timers move, a boss relay another item also fires) is not a handler: of what the lump sets going within
  a few hops, whatever an outside driver also sets going is dropped, then what dropped logic sets going. Value-storing
  inputs (a stage switching the item off with `SetValue`), templates without a weapon (parts the item spawns) and logic
  nothing fires (a pickup filter the item's spawned parts test) do not count as outside drivers. A filter or relay in
  default_ents that only the item drives stays a handler: the GFL configs list it, and CS2Fixes registers an entity with no
  template suffix 0.5 s after the weapon spawns, so it needs no `"templated": false`.
  Entities in `NNN#entityLumpName` lumps get world positions (env_entity_maker or point_template origin + local origin) and
  the `[PR#]` / `&0000` name decorations are ignored when resolving names. Knife items get `triggers` from the trigger that
  ForceSpawns their template (unless it spawns other items too or moves the stage on: opens doors, switches teleports,
  removes walls — a stage start), strip zones (`player_weaponstrip`, `point_script RunScriptInput "*Strip*"` or `"*PickUp*"` (a script deciding who gets the item), a zone tied to the knife that is on from the start and only hands the toucher to a script,
  `point_entity_finder` → Kill) the map ties to the knife (same template lump, parented to it, or fired at by its
  `OnPlayerPickup`; failing that, a zone within 32 units on top of it) and teleports landing within 64 units, each
  landing assigned to the nearest weapon only (a teleport the item's own logic switches on is its ability, not listed;
  that logic includes what an `AddOutput` wires up at run time and the weapon's own outputs other than
  `OnPlayerPickup`, such as the clean-up that frees grabbed players when the holder leaves).
- `triggers` are the ones ebanned players must not touch; CS2Fixes hooks every hammerid listed under any item. Triggers
  built into the item (the zone the holder touches, hurt / gravity zones parented to the weapon, `ToggleCanBePickedUp`
  pickups) help find the handlers but are never listed: ebanned players would become immune to them, and GFL lists
  none of them (0 of 44 on the evaluated maps).
- Button → filter → relay / counter: a filter that only checks the user and hands the use on to relays / cases /
  counters is replaced by those (as in most GFL configs); a filter with effects of its own stays, unless it counts an
  item-specific `math_counter`, which then reports the use. When every output doing something fires only N times, that gives mode 3 / maxuses N (a one-off on the side, like the first use's sound, does not).
  A button without outputs that the item's logic locks and unlocks is still the +use hook. Buttons become plain +use
  hooks when a filter / relay / counter handler follows; one with a cooldown or uses of its own that no follow-up hangs
  on (a special beside the attack behind another button, a button counting on OnUser4 beside a game_ui key) keeps
  reporting its press.
- Counters: CS2Fixes never announces the uses of a counter in mode 5 (a value). A counter the item's use steps by one
  (Add → counterup, Subtract → counterdown), not driven by a timer or a loop of its own and not stepped back by the same
  source, counts uses: mode 3 with the cooldown read in front of it, or mode 4 when reaching the limit locks the item
  and frees it N seconds later. Everything else (a charge a timer refills, a gauge stepped by 30, a combo meter) stays
  mode 5 with message false. On the evaluated maps this matches 57 of the 58 counters GFL writes in mode 3 / 4 and all 22
  in mode 5. A counter the use only reads (`GetValue` → compare: enough sun?) is not the handler; of the compare's
  outcomes the one that locks the item / has a cooldown wins over a colour-and-sound "not ready" reply. Ammo, fuel or a
  recast that locks / disables the button when it runs out and is refilled or drained by a timer is shown on the HUD
  (mode 5) in place of the relays / branches the press sets off, and the button reports the press (`OnPressed`,
  mode 1, no HUD) — "button + counter" is what GFL writes for 34 of the 40 items with such a counter. A counter that
  counts the uses and kills / locks the button at its limit (`OnHitMax` / `OnHitMin`: mines, rockets) replaces them the
  same way but announces the uses itself (mode 3), so the button stays a plain +use hook — as long as only the item's
  use and timers step it (a boss HP counter that stops the items when the boss dies is not one). A counter that at its
  limit stops the relay the press sets off for good (out of fuel: the flame relay Disabled) counts too; one that
  disables it and enables it again later (an overheat) is a cooldown and leaves the relay the handler.
- Single use: when, within 15 s of the use and not through another entity's choice, the use kills the handler or its
  button, or locks / disables it and nothing in the map unlocks / enables it again, the item gets mode 3 / maxuses 1.
  An Unlock that can fire only once (the pickup trigger_once, an "only once" output) arms the item before its use and
  does not count; a random case outcome, a kill on a physbox breaking (OnBreak) or a stage button that kills itself
  later is not a single use.
- Workshop packages holding several maps (3D skybox, `maps/stages/…`) are read through the map right under `maps/`
  that is not a skybox and has the most entity data, not the biggest file.
- Accuracy: `npm run evaluate -- <CS2-ZE-Configs/entwatch> <workshop/content/730 or map folders> --out eval` compares
  the suggestions with the GFL configs of every map it can load (report.md, details.md, results.json); a map found in
  several folders is evaluated once, from the upload listed in `--prefer ids.tsv` or else where most config ids are
  found. The headline
  metric is whether an item would behave like the config in CS2Fixes: per-author style is accepted either way (counting the button
  itself vs. a plain button hook plus the filter / relay behind it; a button GFL writes twice, as a plain hook and as an
  entry counting its OnUser1 / OnUser4, is the one button handler CS2Fixes needs), and it checks that the buttons GFL hooks are hooked
  (CS2Fixes blocks other players' +use on them), every GFL handler has a counterpart firing on the same use and there
  are no extra ones, uses are announced alike (a counter in mode 5 never announces), the item is on the HUD when GFL
  puts it there (CS2Fixes shows one line per item; GFL's `"type": "counter"` / `"mode": 6`, which CS2Fixes does not
  know, is compared as the counter display it is meant to be), the cooldown is within 1 s (2 s or less counts as none, and only values more than 1 s apart differ),
  the max uses and the triggers (over the whole map, as CS2Fixes hooks them). Oct 2026, 186 maps: 79% behave the same
  in game, 58% are identical; "What differs in game" lists the rest by kind.
- Map updates: CS2Fixes matches entities by hammerid only, so the tool remembers the classname / targetname behind
  each id (from the loaded map and from the comments it writes into the jsonc) and offers "Re-match by name" when a
  newer map version no longer contains those ids.
- **Stripper mode** (switch at the top): the same loader, relation tree and Inputs/Outputs views build
  [StripperCS2](https://github.com/Source2ZE/StripperCS2) configs (`filter` / `add` / `modify`). Remove or copy the selected entity,
  edit its key values and outputs in place, or start from a blank action whose match is filled from the selected entity (by
  `classname` + `hammeruniqueid` by default, or name / origin / class). Every action shows how many entities it matches in the
  loaded map, the entity list and tree badge removed / changed entities, and the "After" tab diffs the entity. Output is one
  jsonc per lump (`maps/<map>/default_ents.jsonc`, template lumps as `maps/<map>/9#entitylumpname.jsonc`, plus `global_map` /
  `global_lump`), saved individually or as one zip rooted at `addons/StripperCS2/`. Existing StripperCS2 files can be imported
  (repeated `"add"` keys included). The tool mirrors the plugin's semantics: filter → add → modify per lump, string values only,
  `/regex/` values are case-insensitive and unanchored, `replace.io` only touches outputs selected by `match.io`. Caveats: counts
  use JavaScript regexes (PCRE2-only syntax can't be counted), coordinates may be written differently by the game, lump names
  come from the vpk paths (check with `entity_lump_list` on the server), and the output has not been loaded on a live server.
- Dev: `npm install --legacy-peer-deps`, `npm run dev`, `npm test`, `npm run build`, `npm run build:single`. Deploy with the included
  GitHub Pages workflow (Settings → Pages → Source: GitHub Actions).
