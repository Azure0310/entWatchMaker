/**
 * Finds the player-facing text of a map written in Chinese (game_text / point_worldtext messages,
 * "say" commands in output parameters, …) and turns translations of it into StripperCS2 modify
 * actions, so a map made for Chinese servers can be shown in another language without recompiling.
 *
 * A key value is translated with a "replace" on the entity's own modify; an output parameter with
 * a modify that selects that one output (matchIo) and rewrites its overrideparam (replaceIo).
 */

import type { EntityConnection, MapEntity } from './entity';
import { cloneAction, type ModifyAction, type StripperConfig } from './stripper';
import { editKeyValue, ensureEntityModify, findEntityModify, isEmptyModify, replaceAction, rewriteOutput } from './stripperBuild';

export type TextLang = 'zh' | 'ja' | 'ko';

const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const HAN = /[㐀-䶿一-鿿豈-﫿]|[\ud840-\ud87f][\udc00-\udfff]/;

/**
 * The CJK language a text is written in, or null for text without any. Han characters count as
 * Chinese unless kana (Japanese) or hangul (Korean) appear next to them; a Japanese text written
 * in kanji alone cannot be told apart and is reported as Chinese.
 */
export function detectTextLang(text: string): TextLang | null {
  if (KANA.test(text)) return 'ja';
  if (HANGUL.test(text)) return 'ko';
  if (HAN.test(text)) return 'zh';
  return null;
}

/** Keys holding names or paths other entities and the engine refer to: renaming them would break the map. */
const IDENTIFIER_KEYS = new Set(['classname', 'targetname', 'parentname', 'filtername', 'damagefilter', 'target', 'globalname', 'hammeruniqueid', 'model', 'vscripts']);

function isIdentifierKey(key: string): boolean {
  return IDENTIFIER_KEYS.has(key) || /^template\d+$/.test(key);
}

export type TextHit =
  | { kind: 'key'; entity: MapEntity; key: string; text: string; lang: TextLang }
  | { kind: 'io'; entity: MapEntity; connection: EntityConnection; text: string; lang: TextLang };

/** Every key value and output parameter with CJK text, in entity order. */
export function scanTexts(entities: MapEntity[]): TextHit[] {
  const out: TextHit[] = [];
  for (const e of entities) {
    for (const [key, text] of Object.entries(e.props)) {
      if (isIdentifierKey(key)) continue;
      const lang = detectTextLang(text);
      if (lang) out.push({ kind: 'key', entity: e, key, text, lang });
    }
    for (const c of e.connections) {
      const lang = detectTextLang(c.param);
      if (lang) out.push({ kind: 'io', entity: e, connection: c, text: c.param, lang });
    }
  }
  return out;
}

/** Hits sharing the same text, so one translation covers them all. */
export interface TextGroup {
  text: string;
  lang: TextLang;
  hits: TextHit[];
}

export function groupTexts(hits: TextHit[]): TextGroup[] {
  const byText = new Map<string, TextGroup>();
  for (const h of hits) {
    const g = byText.get(h.text);
    if (g) g.hits.push(h);
    else byText.set(h.text, { text: h.text, lang: h.lang, hits: [h] });
  }
  return [...byText.values()];
}

// ---------------------------------------------------------------------------------------------
// Translations as stripper actions
// ---------------------------------------------------------------------------------------------

function sameMatch(a: ModifyAction, b: ModifyAction): boolean {
  return JSON.stringify([a.target, a.match, a.matchIo]) === JSON.stringify([b.target, b.match, b.matchIo]);
}

/** The modify that rewrites this output (made by rewriteOutput), if the config has one. */
function findOutputRewrite(config: StripperConfig, e: MapEntity, c: EntityConnection, mapName: string): ModifyAction | undefined {
  const probe = rewriteOutput(e, c, mapName);
  return config.actions.find((a): a is ModifyAction => a.kind === 'modify' && a.replaceIo !== undefined && sameMatch(a, probe));
}

/** The translation the config currently gives a hit, or undefined when it leaves the text alone. */
export function translationOf(config: StripperConfig, hit: TextHit, mapName: string): string | undefined {
  if (hit.kind === 'io') return findOutputRewrite(config, hit.entity, hit.connection, mapName)?.replaceIo?.overrideparam;
  return findEntityModify(config, hit.entity, mapName)?.replace.find((r) => r.key.toLowerCase() === hit.key)?.value;
}

/**
 * Sets (or, with an empty or unchanged text, removes) the translation of one hit. The other
 * edits of the same modify are kept; a modify left with nothing to do is dropped.
 */
export function applyTranslation(config: StripperConfig, hit: TextHit, translation: string, mapName: string): StripperConfig {
  const value = translation === hit.text ? '' : translation;
  if (hit.kind === 'key') {
    const { config: withModify, action } = ensureEntityModify(config, hit.entity, mapName);
    const next = editKeyValue(action, hit.entity, hit.key, value === '' ? hit.text : value);
    if (isEmptyModify(next)) return { actions: withModify.actions.filter((a) => a.uid !== next.uid) };
    return replaceAction(withModify, next);
  }
  const found = findOutputRewrite(config, hit.entity, hit.connection, mapName);
  if (!found) {
    if (value === '') return config;
    const action = rewriteOutput(hit.entity, hit.connection, mapName);
    action.replaceIo = { overrideparam: value };
    action.note = `translate: ${action.note ?? ''}`.trim();
    return { actions: [...config.actions, action] };
  }
  const next = cloneAction(found);
  next.replaceIo = { ...next.replaceIo };
  if (value === '') delete next.replaceIo.overrideparam;
  else next.replaceIo.overrideparam = value;
  if (isEmptyModify(next)) return { actions: config.actions.filter((a) => a.uid !== next.uid) };
  return replaceAction(config, next);
}

/** Applies one translation to every hit of a group. */
export function applyGroupTranslation(config: StripperConfig, group: TextGroup, translation: string, mapName: string): StripperConfig {
  return group.hits.reduce((c, h) => applyTranslation(c, h, translation, mapName), config);
}

// ---------------------------------------------------------------------------------------------
// Translation table (original text -> translation), for translating outside the tool
// ---------------------------------------------------------------------------------------------

/** A JSON object of every original text and its current translation ("" when untranslated). */
export function exportTranslationTable(groups: TextGroup[], config: StripperConfig, mapName: string): string {
  const table: Record<string, string> = {};
  for (const g of groups) table[g.text] = translationOf(config, g.hits[0], mapName) ?? '';
  return JSON.stringify(table, null, 2);
}

/**
 * Reads a translation table: a JSON object { original: translation }, or tab separated lines
 * "original<TAB>translation". Entries with an empty translation are skipped.
 */
export function parseTranslationTable(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed) as unknown;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) if (typeof v === 'string' && v !== '') out.set(k, v);
    }
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf('\t');
    if (i <= 0) continue;
    const translation = line.slice(i + 1);
    if (translation !== '') out.set(line.slice(0, i), translation);
  }
  return out;
}

/** Applies a translation table to the groups it names; returns the config and how many groups it changed. */
export function applyTranslationTable(config: StripperConfig, groups: TextGroup[], table: Map<string, string>, mapName: string): { config: StripperConfig; applied: number } {
  let applied = 0;
  let c = config;
  for (const g of groups) {
    const translation = table.get(g.text);
    if (translation === undefined) continue;
    c = applyGroupTranslation(c, g, translation, mapName);
    applied += 1;
  }
  return { config: c, applied };
}
