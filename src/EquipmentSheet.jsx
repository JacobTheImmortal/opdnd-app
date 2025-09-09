// src/EquipmentSheet.jsx
import React from 'react';
import { equipmentList } from './equipmentData';

const byName = {};
(equipmentList || []).forEach((e) => (byName[e.name] = e || {}));

export default function EquipmentSheet({ equipment = [], setEquipment }) {
  const updateItem = (idx, patch) => {
    const next = equipment.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setEquipment(next);
  };

  const removeItem = (idx) => {
    const next = equipment.filter((_, i) => i !== idx);
    setEquipment(next);
  };

  const addPremade = () => {
    setEquipment([
      ...equipment,
      // empty slot → user picks from dropdown
      { name: '', quantity: 1 },
    ]);
  };

  const addCustom = () => {
    const name = (prompt('Custom item name?') || '').trim();
    if (!name) return;
    // Provide sensible defaults for custom items
    setEquipment([
      ...equipment,
      {
        name,
        quantity: 1,
        custom: true,
        customDesc: '',
        weight: 'light',
        durability: 1,
        maxDurability: 1,
      },
    ]);
  };

  const bumpDurability = (idx, delta) => {
    const it = equipment[idx] || {};
    const maxD = Number(it.maxDurability ?? 1);
    const curD = Number(it.durability ?? maxD);
    const nextD = Math.min(Math.max(0, curD + delta), maxD);
    updateItem(idx, { durability: nextD });
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {(equipment || []).map((it, idx) => {
        const isCustom = !!it.custom || !!it.customDesc || !byName[it.name];
        const meta = isCustom ? {} : (byName[it.name] || {});
        const showDurability =
          isCustom ||
          meta.maxDurability != null ||
          it.maxDurability != null ||
          it.durability != null;

        return (
          <div key={`eq-${idx}`} style={{ marginBottom: '1.25rem' }}>
            {/* Header row (premade uses a select; custom shows a label) */}
            {!isCustom ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <select
                  value={it.name || ''}
                  onChange={(e) => updateItem(idx, { name: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {equipmentList.map((e) => (
                    <option key={e.name} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <span>
                  Qty{' '}
                  <input
                    type="number"
                    min={0}
                    value={Number(it.quantity ?? 1)}
                    onChange={(e) => updateItem(idx, { quantity: Number(e.target.value || 0) })}
                    style={{ width: 60 }}
                  />
                </span>
                <button onClick={() => removeItem(idx)}>Remove</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <strong>{it.name || 'Custom Item'}</strong>
                <span>
                  Qty{' '}
                  <input
                    type="number"
                    min={0}
                    value={Number(it.quantity ?? 1)}
                    onChange={(e) => updateItem(idx, { quantity: Number(e.target.value || 0) })}
                    style={{ width: 60 }}
                  />
                </span>
                {/* NEW: Remove for custom items too */}
                <button onClick={() => removeItem(idx)}>Remove</button>
              </div>
            )}

            {/* Details */}
            {!isCustom ? (
              <>
                {meta.damage && (
                  <div>
                    <strong>Damage:</strong> {meta.damage}
                  </div>
                )}
                {meta.range && (
                  <div>
                    <strong>Range:</strong> {meta.range}
                  </div>
                )}
                <div>
                  <strong>Weight:</strong> {meta.weight ?? 'light'}
                </div>
                {meta.useCost != null && (
                  <div>
                    <strong>Use Cost:</strong> {meta.useCost} Bar
                  </div>
                )}
              </>
            ) : (
              <>
                {it.customDesc ? (
                  <div style={{ marginTop: 6 }}>
                    <em>{it.customDesc}</em>
                  </div>
                ) : null}
                <div>
                  <strong>Weight:</strong> {it.weight ?? 'light'}
                </div>
              </>
            )}

            {/* Durability (if present or custom) */}
            {showDurability && (
              <div style={{ marginTop: 6 }}>
                <strong>Durability</strong>{' '}
                <button onClick={() => bumpDurability(idx, -1)}>-</button>{' '}
                {Number(it.durability ?? it.maxDurability ?? 1)} /{' '}
                {Number(it.maxDurability ?? meta.maxDurability ?? 1)}{' '}
                <button onClick={() => bumpDurability(idx, +1)}>+</button>
                {it.maxDurability != null || meta.maxDurability != null ? (
                  <div style={{ marginTop: 4 }}>
                    <strong>Max Durability:</strong>{' '}
                    {Number(it.maxDurability ?? meta.maxDurability ?? 1)}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={addPremade}>+ Add Equipment</button>
        <button onClick={addCustom}>+ Add Custom</button>
      </div>
    </div>
  );
}
