import { useMemo } from 'react';
import { validateConfig } from '../model/validate';
import { clearMap, exportEntityDump, setLang } from './actions';
import { ConfigPanel, ItemListPanel } from './ConfigPanel';
import { DropZone } from './DropZone';
import { EntityList } from './EntityList';
import { Inspector } from './Inspector';
import { JsonPanel } from './JsonPanel';
import { RelationTree } from './RelationTree';
import { useAppState } from './store';
import { useT } from './useT';

export function App() {
  const t = useT();
  const { map, graph, config, lang, toast, hints } = useAppState();
  const issues = useMemo(() => validateConfig(config, graph, hints), [config, graph, hints]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">EW</span>
          <div>
            <div className="title">{t('app.title')}</div>
            <div className="subtitle">{t('app.subtitle')}</div>
          </div>
        </div>
        {map && (
          <div className="mapinfo" data-testid="map-info">
            <span className="mapname">{map.mapName}</span>
            <span className="muted small">
              {map.stats.entities} {t('map.entities')} · {map.stats.weapons} {t('map.weapons')} · {map.stats.connections} {t('map.connections')} · {map.stats.lumps} {t('map.lumps')}
            </span>
            {map.warnings.length > 0 && (
              <details className="warnings">
                <summary className="warn small">
                  {map.warnings.length} {t('map.warnings')}
                </summary>
                <ul>
                  {map.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
            <button type="button" className="btn" onClick={() => exportEntityDump()} title={t('map.exportHint')} data-testid="export-entities">
              {t('map.export')}
            </button>
            <button type="button" className="btn" onClick={() => clearMap()} data-testid="reload-map">
              {t('map.reload')}
            </button>
          </div>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={() => setLang(lang === 'ja' ? 'en' : 'ja')} data-testid="lang-toggle">
          {t('lang.toggle')}
        </button>
      </header>

      {!map ? (
        <main className="landing">
          <DropZone />
          <section className="howto">
            {lang === 'ja' ? (
              <ol>
                <li>Hammer の .vmap、または Workshop からダウンロードした .vpk をドロップします（すべてブラウザ内で処理され、アップロードはされません）。</li>
                <li>左に weapon_ エンティティが並ぶので選択し、「アイテムとして追加」を押すと、親子関係や Output から関連するボタン / フィルタ / カウンターを推定してハンドラを作ります。</li>
                <li>中央のツリーと Output / Input 一覧で配線を確認し、足りないハンドラやトリガーは「+」で追加します。</li>
                <li>右下の jsonc をダウンロードして addons/cs2fixes/configs/entwatch/maps/ に置きます。</li>
              </ol>
            ) : (
              <ol>
                <li>Drop a Hammer .vmap or a Workshop .vpk (everything runs in your browser, nothing is uploaded).</li>
                <li>Pick a weapon_ entity on the left and press "Add as item": related buttons / filters / counters are inferred from parenting and outputs.</li>
                <li>Check the wiring in the relation tree and the Outputs / Inputs tables; add missing handlers or triggers with "+".</li>
                <li>Download the jsonc and place it in addons/cs2fixes/configs/entwatch/maps/.</li>
              </ol>
            )}
          </section>
        </main>
      ) : (
        <main className="workspace">
          <section className="col left">
            <EntityList />
            <ItemListPanel issues={issues} />
          </section>
          <section className="col center">
            <RelationTree />
            <Inspector />
          </section>
          <section className="col right">
            <ConfigPanel issues={issues} />
            <JsonPanel issues={issues} />
          </section>
        </main>
      )}
      {toast && (
        <div className="toast" data-testid="toast">
          {toast}
        </div>
      )}
    </div>
  );
}
