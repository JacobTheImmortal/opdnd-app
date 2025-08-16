// EquipmentSheet.jsx
// Displays only allowed stats, persists full item
// =================================

import React from 'react';
import { equipmentList } from './equipmentData';

const allowedStat = (v) => v !== undefined && v !== null && v !== 'n/a' && v !== '';

const EquipmentRow = ({ item, index, onChange, onRemove }) => {
  const selected = equipmentList.find(e => e.name === item.name) || null;

  return (
    <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <select
          value={item.name || ''}
          onChange={(e) => onChange(index, { ...item, name: e.target.value })}
        >
          <option value="">-- Select Item --</option>
          {equipmentList.map((eq) => (
            <option key={eq.name} value={eq.name}>{eq.name}</option>
          ))}
        </select>

        <label>
          Qty
          <input
            type="number"
            min={1}
            value={item.quantity ?? 1}
            onChange={(e) => onChange(index, { ...item, quantity: Number(e.target.value) })}
            style={{ width: 60, marginLeft: 6 }}
          />
        </label>

        <button onClick={() => onRemove(index)} style={{ marginLeft: 'auto' }}>Remove</button>
      </div>

      {/* Visible stats in Equipment tab */}
      {selected && (
        <div style={{ marginTop: '0.5rem', paddingLeft: '0.25rem' }}>
          {allowedStat(selected.damage) && <div><strong>Damage:</strong> {selected.damage}</div>}
          {allowedStat(selected.range) && <div><strong>Range:</strong> {selected.range}</div>}
          {allowedStat(selected.ammo) && <div><strong>Ammo:</strong> {selected.ammo}</div>}
          {allowedStat(selected.durability) && <div><strong>Durability:</strong> {selected.durability}</div>}
          <div><strong>Weight:</strong> {selected.weight || 'n/a'}</div>

          {allowedStat(selected.description) && (
            <div style={{ marginTop: 6 }}>
              <em>{selected.description}</em>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function EquipmentSheet({ equipment, setEquipment }) {
  const update = (idx, updated) => {
    const next = equipment.map((e, i) => (i === idx ? updated : e));
    setEquipment(next);
  };
  const add = () => setEquipment([...(equipment || []), { name: '', quantity: 1, customDesc: '' }]);
  const remove = (idx) => setEquipment(equipment.filter((_, i) => i !== idx));

  return (
    <div>
      <h3>Equipment</h3>

      {(equipment && equipment.length > 0) ? (
        equipment.map((item, i) => (
          <EquipmentRow key={`eq-${i}-${item.name || 'blank'}`} index={i} item={item} onChange={update} onRemove={remove} />
        ))
      ) : (
        <p>No equipment yet.</p>
      )}

      <button onClick={add} style={{ marginTop: '0.75rem' }}>+ Add Equipment</button>

      {/* Hidden fields stored with the item but not displayed here: */}
      {/* useCost, buyValue, sellValue are part of equipmentList entries and will be available to actions/shop later */}
    </div>
  );
}
