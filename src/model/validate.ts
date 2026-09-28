import type { EntityGraph } from './graph';
import type { EntWatchConfig } from './entwatch';
import { outputChoices } from './suggest';
import { hintMatches, type HintMap } from './remap';
import { HOOKABLE_TRIGGERS } from './suggest';

export interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  itemUid: string;
  handlerUid?: string;
  /** i18n key */
  key: string;
  detail?: string;
}

export function validateConfig(config: EntWatchConfig, graph: EntityGraph | null, hints?: HintMap): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>();
  const stale = (hid: string, itemUid: string, handlerUid?: string) => {
    if (!graph || !hints) return;
    const hint = hints.get(hid);
    const e = graph.byHammerId.get(hid)?.[0];
    if (hint && e && !hintMatches(hint, e)) {
      issues.push({ level: 'warning', itemUid, handlerUid, key: 'v.idPointsElsewhere', detail: `${hid}: ${hint.classname ?? ''} ${hint.targetname ?? ''} → ${e.classname} ${e.targetname}`.trim() });
    }
  };
  for (const item of config.items) {
    stale(item.hammerid, item.uid);
    for (const t of item.triggers) stale(t, item.uid);
    for (const h of item.handlers) stale(h.hammerid, item.uid, h.uid);
    if (!item.hammerid) issues.push({ level: 'error', itemUid: item.uid, key: 'v.itemNoHammerId' });
    if (!item.name) issues.push({ level: 'warning', itemUid: item.uid, key: 'v.itemNoName' });
    if (item.hammerid) {
      const dup = seen.get(item.hammerid);
      if (dup) issues.push({ level: 'error', itemUid: item.uid, key: 'v.duplicateItem', detail: item.hammerid });
      else seen.set(item.hammerid, item.uid);
    }
    if (graph && item.hammerid) {
      const ents = graph.byHammerId.get(item.hammerid) ?? [];
      if (ents.length === 0) issues.push({ level: 'error', itemUid: item.uid, key: 'v.itemNotInMap', detail: item.hammerid });
      else if (!ents.some((e) => e.classname.startsWith('weapon_'))) {
        issues.push({ level: 'warning', itemUid: item.uid, key: 'v.itemNotWeapon', detail: ents[0].classname });
      }
    }
    for (const t of item.triggers) {
      if (!graph) continue;
      const ents = graph.byHammerId.get(t) ?? [];
      if (ents.length === 0) {
        issues.push({ level: 'error', itemUid: item.uid, key: 'v.triggerNotInMap', detail: t });
        continue;
      }
      const trig = ents[0];
      if (!HOOKABLE_TRIGGERS.has(trig.classname)) {
        issues.push({ level: 'warning', itemUid: item.uid, key: 'v.triggerNotHookable', detail: `${t} ${trig.classname}` });
        continue;
      }
      // switched on by one of this item's handlers and firing nothing back: an effect zone
      const handlerIds = new Set(item.handlers.map((h) => h.hammerid).concat(item.hammerid));
      const fromItem = (e: { hammerId: string }) => handlerIds.has(e.hammerId);
      const switchedOn = graph.incomingConnections(trig).some(({ from, connection }) => fromItem(from) && ['enable', 'unlock', 'open', 'turnon', 'start'].includes(connection.input.toLowerCase()));
      const feedsItem = graph.relationsOf(trig).some((r) => r.kind === 'output' && fromItem(r.other));
      if (switchedOn && !feedsItem) issues.push({ level: 'warning', itemUid: item.uid, key: 'v.triggerEffectZone', detail: `${t} ${trig.targetname || trig.classname}` });
    }
    for (const h of item.handlers) {
      if (!h.hammerid) {
        issues.push({ level: 'error', itemUid: item.uid, handlerUid: h.uid, key: 'v.handlerNoHammerId' });
        continue;
      }
      if (h.type === 'other' && !h.event) issues.push({ level: 'error', itemUid: item.uid, handlerUid: h.uid, key: 'v.handlerNoEvent' });
      if ((h.mode === 2 || h.mode === 3 || h.mode === 4) && !(h.cooldown && h.cooldown > 0) && h.mode !== 3) {
        issues.push({ level: 'info', itemUid: item.uid, handlerUid: h.uid, key: 'v.handlerNoCooldown' });
      }
      // a counter's max uses come from its min / max, not from maxuses
      const counter = h.type === 'counterup' || h.type === 'counterdown';
      if ((h.mode === 3 || h.mode === 4) && !counter && !(h.maxuses && h.maxuses > 0)) {
        issues.push({ level: 'warning', itemUid: item.uid, handlerUid: h.uid, key: 'v.handlerNoMaxUses' });
      }
      if (!graph) continue;
      const ents = graph.byHammerId.get(h.hammerid) ?? [];
      if (ents.length === 0) {
        issues.push({ level: 'error', itemUid: item.uid, handlerUid: h.uid, key: 'v.handlerNotInMap', detail: h.hammerid });
        continue;
      }
      const ent = ents[0];
      if ((h.type === 'counterup' || h.type === 'counterdown') && ent.classname !== 'math_counter') {
        issues.push({ level: 'warning', itemUid: item.uid, handlerUid: h.uid, key: 'v.counterNotMathCounter', detail: ent.classname });
      }
      if (h.type !== 'counterup' && h.type !== 'counterdown' && h.event) {
        const choices = outputChoices(ent);
        if (!choices.includes(h.event)) {
          issues.push({ level: 'info', itemUid: item.uid, handlerUid: h.uid, key: 'v.eventUnknown', detail: `${h.event} (${ent.classname})` });
        }
      }
      if (h.type === 'button' && !['func_button', 'func_rot_button', 'momentary_rot_button', 'func_physbox', 'func_physbox_multiplayer', 'game_ui'].includes(ent.classname) && !ent.classname.startsWith('prop_physics') && !ent.classname.startsWith('weapon_')) {
        issues.push({ level: 'info', itemUid: item.uid, handlerUid: h.uid, key: 'v.buttonTypeOnNonButton', detail: ent.classname });
      }
    }
  }
  return issues;
}
