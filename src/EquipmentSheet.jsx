import React, { useMemo } from 'react';
import { equipmentList } from './equipmentData';

/**
 * EquipmentSheet
 * - Displays and edits a character's equipment
 * - Adds durability controls for items that have a durability stat
 * - Durability logic:
 *    - When an item with durability is added/selected, it initializes to maxDurability
 *    - "-" reduces current durability by 1
 *       - If it hits 0: quantity is reduced by 1
 *       - If quantity stays > 0: durability resets to maxDurability
 *       - If quantity becomes 0: the item is removed
 *    - "+" increases current durability up to maxDurability
 * - Items without a durability stat (e.g., guns with Ammo) are not affected here
 */
export default function EquipmentSheet({ equipment, setEquipment }) {
  const allNames = useMemo(() => equipmentList.map(e => e.name), []);

  const findMeta = (name) => equipmentList.find(e => e.name === name) || null;

  const initDurabilityIfNeeded = (slot, meta) => {
    if (!meta || !meta.durability) return slot; // no durability defined
    const next = { ...slot };
    if (next.maxDurability == null) next.maxDurability = Number(meta.durability);
    if (next.durability == null) next.durability = Number(meta.durability);
    return next;
  };

  const initAmmoIfNeeded = (slot, meta) => {
    if (!meta || !meta.ammo) return slot; // no ammo defined
    const next = { ...slot };
    if (next.maxAmmo == null) next.maxAmmo = Number(meta.ammo);
    if (next.ammo == null) next.ammo = Number(meta.ammo);
    return next;
  };

  const updateSlot = (idx, updater) => {
    const updated = [...equipment];
    const current = updated[idx] || {};
    updated[idx] = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
    // Auto-remove if name cleared or quantity 0
    if (!updated[idx].name || Number(updated[idx].quantity) <= 0) {
      updated.splice(idx, 1);
    }
    setEquipment(updated);
  };

  const addSlot = () => {
    setEquipment([
      ...equipment,
      { name: '', quantity: 1, customDesc: '' }
    ]);
  };

  const removeSlot = (idx) => {
    const updated = equipment.slice();
    updated.splice(idx, 1);
    setEquipment(updated);
  };

  const adjustDurability = (idx, delta) => {
    const slot = equipment[idx];
    const meta = findMeta(slot.name);
    if (!meta || !meta.durability) return; // only for durable items

    updateSlot(idx, (cur) => {
      let next = initDurabilityIfNeeded(cur, meta);
      const maxD = Number(next.maxDurability || meta.durability || 0);
      let curD = Number(next.durability ?? maxD);
      curD += delta;

      if (curD > maxD) curD = maxD;

      if (curD <= 0) {
        // break: reduce quantity
        const q = Math.max(0, Number(next.quantity || 0) - 1);
        if (q <= 0) {
          // handled by updateSlot auto-remove, set quantity to 0 to trigger removal
          return { ...next, quantity: 0 };
        }
        // reset durability and keep item
        return { ...next, quantity: q, durability: maxD };
      }

      return { ...next, durability: curD };
    });
  };

  const adjustAmmo = (idx, delta) => {
    const slot = equipment[idx];
    const meta = findMeta(slot.name);
    if (!meta || !meta.ammo) return; // only for ammo items

    updateSlot(idx, (cur) => {
      let next = initAmmoIfNeeded(cur, meta);
      const maxA = Number(next.maxAmmo || meta.ammo || 0);
      let curA = Number(next.ammo ?? maxA);
      curA += delta;
      if (curA > maxA) curA = maxA;
      if (curA < 0) curA = 0; // does not remove the item
      return { ...next, ammo: curA };
    });
  };

  const reloadAmmo = (idx) => {
    const slot = equipment[idx];
    const meta = findMeta(slot.name);
    if (!meta || !meta.ammo) return;
    updateSlot(idx, (cur) => {
      const next = initAmmoIfNeeded(cur, meta);
      const maxA = Number(next.maxAmmo || meta.ammo || 0);
      return { ...next, ammo: maxA };
    });
  };

  const onSelectName = (idx, name) => {
    updateSlot(idx, (cur) => {
      const base = { ...cur, name };
      const meta = findMeta(name);
      if (meta && meta.durability) {
        // initialize durability fields for durable items
        base.maxDurability = Number(meta.durability);
        base.durability = Number(meta.durability);
      } else {
        // clear durability fields for non-durable items
        delete base.maxDurability;
        delete base.durability;
      }
      if (meta && meta.ammo) {
        base.maxAmmo = Number(meta.ammo);
        base.ammo = Number(meta.ammo);
      } else {
        delete base.maxAmmo;
        delete base.ammo;
      }
      if (base.quantity == null || base.quantity === '') base.quantity = 1;
      return base;
    });
  };

  const onChangeQty = (idx, qtyStr) => {
    const qty = Math.max(0, Number(qtyStr || 0));
    updateSlot(idx, (cur) => {
      if (qty <= 0) return { ...cur, quantity: 0 }; // triggers removal
      return { ...cur, quantity: qty };
    });
  };

  return (
    <div>
      <h3>Equipment</h3>

      {equipment.map((slot, idx) => {
        const meta = findMeta(slot.name);
        const hasDurability = Boolean(meta && meta.durability && Number(meta.durability) > 0);
        const quantity = Number(slot.quantity || 1);
        const curD = hasDurability ? (slot.durability ?? meta.durability) : null;
        const maxD = hasDurability ? (slot.maxDurability ?? meta.durability) : null;

        return (
          <div key={`eq-${idx}`} style={{ borderTop: '1px solid #ddd', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={slot.name || ''} onChange={(e) => onSelectName(idx, e.target.value)}>
                <option value=''>-- Select Item --</option>
                {allNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>

              <label>
                Qty&nbsp;
                <input
                  type='number'
                  min={0}
                  value={quantity}
                  onChange={(e) => onChangeQty(idx, e.target.value)}
                  style={{ width: 64 }}
                />
              </label>

              {/* Durability controls only for items that have durability */}
              {hasDurability && (
                <div>
                  <span style={{ marginRight: 6 }}>Durability</span>
                  <button onClick={() => adjustDurability(idx, -1)}>-</button>
                  <span style={{ margin: '0 6px' }}>{curD} / {maxD}</span>
                  <button onClick={() => adjustDurability(idx, +1)}>+</button>
                </div>
              )}

              <button style={{ marginLeft: 'auto' }} onClick={() => removeSlot(idx)}>Remove</button>
            </div>

            {/* Basic readout of item stats for convenience */}
            {meta && (
              <div style={{ marginTop: 6 }}>
                {meta.damage && <div><strong>Damage:</strong> {meta.damage}</div>}
                {meta.range && <div><strong>Range:</strong> {meta.range}</div>}
                {hasDurability && <div><strong>Max Durability:</strong> {maxD}</div>}
                {meta.weight && <div><strong>Weight:</strong> {meta.weight}</div>}
                {meta.description && (
                  <div style={{ marginTop: 4, fontStyle: 'italic' }}>{meta.description}</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: '0.75rem' }}>
        <button onClick={addSlot}>+ Add Equipment</button>
      </div>
    </div>
  );
}
