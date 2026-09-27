import type { EntityGraph } from './graph';
import type { EntWatchConfig } from './entwatch';
import { outputChoices } from './suggest';

export interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  itemUid: string;
  handlerUid?: string;
  /** i18n key */
  key: string;
  detail?: string;
}

export function validateConfig(config: EntWatchConfig, graph: EntityGraph | null): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>();
  for (const item of config.items) {
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
      if (ents.length === 0) issues.push({ level: 'error', itemUid: item.uid, key: 'v.triggerNotInMap', detail: t });
      else if (!ents.some((e) => e.classname.startsWith('trigger_'))) issues.push({ level: 'warning', itemUid: item.uid, key: 'v.triggerNotTrigger', detail: `${t} ${ents[0].classname}` });
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
      if ((h.mode === 3 || h.mode === 4) && !(h.maxuses && h.maxuses > 0)) {
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
