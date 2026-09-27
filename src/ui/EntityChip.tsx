import type { MapEntity } from '../model/entity';
import { friendlyName } from '../model/entity';
import { selectEntity } from './actions';

export function EntityChip({ entity, showId = true, onClick }: { entity: MapEntity; showId?: boolean; onClick?: () => void }) {
  const name = friendlyName(entity.targetname);
  return (
    <button
      type="button"
      className="chip"
      title={`${entity.classname} ${name} #${entity.hammerId}`}
      onClick={onClick ?? (() => selectEntity(entity.id))}
    >
      <span className="chip-class">{entity.classname}</span>
      {name && <span className="chip-name">{name}</span>}
      {showId && entity.hammerId && <span className="chip-id">#{entity.hammerId}</span>}
    </button>
  );
}
