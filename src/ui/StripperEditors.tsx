import { IO_NUMBER_FIELDS, IO_STRING_FIELDS, TARGET_TYPES, isRegexValue, type IoSpec, type KV } from '../model/stripper';
import { useT } from './useT';

const IO_LABEL: Record<(typeof IO_STRING_FIELDS)[number], 'insp.col.output' | 'insp.col.target' | 'insp.col.input' | 'insp.col.param'> = {
  outputname: 'insp.col.output',
  targetname: 'insp.col.target',
  inputname: 'insp.col.input',
  overrideparam: 'insp.col.param',
};

/** Rows of key / value inputs. A value wrapped in slashes is shown as a regex. */
export function KvEditor({ rows, onChange, keyHints, listId }: { rows: KV[]; onChange: (rows: KV[]) => void; keyHints: string[]; listId: string }) {
  const t = useT();
  const set = (i: number, patch: Partial<KV>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="kv-editor">
      <datalist id={listId}>
        {keyHints.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      {rows.map((r, i) => (
        <div className="kv-row" key={i} data-testid="kv-row">
          <input className="input mono" list={listId} value={r.key} placeholder="key" onChange={(e) => set(i, { key: e.target.value })} data-testid="kv-key" />
          <input className="input mono" value={r.value} placeholder="value" onChange={(e) => set(i, { value: e.target.value })} data-testid="kv-value" />
          <span className={`rx${isRegexValue(r.value) ? ' on' : ''}`} title={isRegexValue(r.value) ? t('st.regex') : ''}>
            .*
          </span>
          <button type="button" className="mini danger" title={t('st.removeRow')} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="mini add" onClick={() => onChange([...rows, { key: '', value: '' }])} data-testid="kv-add">
        {t('st.addRow')}
      </button>
    </div>
  );
}

function numberOrUndefined(text: string): number | undefined {
  if (text.trim() === '') return undefined;
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : undefined;
}

/** One output description: seven optional fields. `placeholders` shows the values an empty field keeps. */
export function IoRow({ io, onChange, onRemove, withType, placeholders }: { io: IoSpec; onChange: (io: IoSpec) => void; onRemove?: () => void; withType: boolean; placeholders?: IoSpec }) {
  const t = useT();
  const setStr = (f: (typeof IO_STRING_FIELDS)[number], v: string) => {
    const next = { ...io };
    if (v === '') delete next[f];
    else next[f] = v;
    onChange(next);
  };
  const setNum = (f: (typeof IO_NUMBER_FIELDS)[number], v: string) => {
    const next = { ...io };
    const n = numberOrUndefined(v);
    if (n === undefined) delete next[f];
    else next[f] = n;
    onChange(next);
  };
  return (
    <div className={`io-row${withType ? ' typed' : ''}`} data-testid="io-edit-row">
      {IO_STRING_FIELDS.map((f) => (
        <input
          key={f}
          className="input mono"
          value={io[f] ?? ''}
          placeholder={placeholders?.[f] ?? t(IO_LABEL[f])}
          title={t(IO_LABEL[f])}
          onChange={(e) => setStr(f, e.target.value)}
          data-testid={`io-${f}`}
        />
      ))}
      <input
        className="input mono num"
        type="number"
        step="0.1"
        value={io.delay ?? ''}
        placeholder={placeholders?.delay !== undefined ? String(placeholders.delay) : t('insp.col.delay')}
        title={t('insp.col.delay')}
        onChange={(e) => setNum('delay', e.target.value)}
        data-testid="io-delay"
      />
      <input
        className="input mono num"
        type="number"
        step="1"
        value={io.timestofire ?? ''}
        placeholder={placeholders?.timestofire !== undefined ? String(placeholders.timestofire) : t('insp.col.times')}
        title={t('insp.col.times')}
        onChange={(e) => setNum('timestofire', e.target.value)}
        data-testid="io-timestofire"
      />
      {withType && (
        <select className="input" value={io.targettype ?? ''} title={t('st.col.type')} onChange={(e) => setNum('targettype', e.target.value)}>
          <option value="">{t('st.col.type')}</option>
          {TARGET_TYPES.map((tt) => (
            <option key={tt.value} value={tt.value}>
              {tt.value} {tt.label}
            </option>
          ))}
        </select>
      )}
      {onRemove ? (
        <button type="button" className="mini danger" title={t('st.removeRow')} onClick={onRemove}>
          ✕
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

/** A list of outputs. */
export function IoListEditor({ rows, onChange, withType, placeholders }: { rows: IoSpec[]; onChange: (rows: IoSpec[]) => void; withType: boolean; placeholders?: IoSpec }) {
  const t = useT();
  return (
    <div className="io-editor">
      {rows.map((io, i) => (
        <IoRow key={i} io={io} withType={withType} placeholders={placeholders} onChange={(next) => onChange(rows.map((r, j) => (j === i ? next : r)))} onRemove={() => onChange(rows.filter((_, j) => j !== i))} />
      ))}
      <button type="button" className="mini add" onClick={() => onChange([...rows, {}])} data-testid="io-add">
        {t('st.addIo')}
      </button>
    </div>
  );
}
