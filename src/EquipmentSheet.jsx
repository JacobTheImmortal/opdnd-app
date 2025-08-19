import React, { useMemo, useState } from 'react';
import { equipmentList } from './equipmentData';

/**
 * EquipmentSheet
 * Props:
 *  - equipment: Array of items { name, quantity, currentDurability?, currentAmmo?, customMeta? }
 *  - setEquipment: (newList) => void  (parent persists to character)
 */
export default function EquipmentSheet({ equipment = [], setEquipment }) {
  const [customItems, setCustomItems] = useState([]); // [{ name, damage, range, durability, ammo, weight, growthTime, yieldVal, useCost }]

  // Helper: get "meta" for an item (built-in definitions OR custom meta embedded on item)
  const lookupMeta = (item) => {
    if (!item) return {};
    if (item.customMeta) return item.customMeta;
    const builtin = equipmentList.find((e) => e.name === item.name);
    if (builtin) return builtin;
    const custom = customItems.find((e) => e.name === item.name);
    return custom || {};
  };

  const allOptions = useMemo(() => {
    const builtin = equipmentList.map((e) => e.name);
    const custom = customItems.map((e) => e.name);
    return [...new Set([...builtin, ...custom])];
  }, [customItems]);

  const update = (idx, patch) => {
    const list = equipment.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setEquipment(list);
  };

  const removeIndex = (idx) => {
    const list = equipment.filter((_, i) => i !== idx);
    setEquipment(list);
  };

  const addRow = () => {
    setEquipment([
      ...equipment,
      { name: '', quantity: 1 },
    ]);
  };

  const ensureCounters = (idx, meta) => {
    const it = equipment[idx];
    const patch = {};
    if (meta && meta.durability && (it.currentDurability == null)) {
      patch.currentDurability = Number(meta.durability);
    }
    if (meta && meta.ammo && (it.currentAmmo == null)) {
      patch.currentAmmo = Number(meta.ammo);
    }
    if (Object.keys(patch).length) update(idx, patch);
  };

  const changeName = (idx, name) => {
    const base = { name };
    // reset counters; will be re-initialized by ensureCounters
    base.currentDurability = undefined;
    base.currentAmmo = undefined;
    // if user selected a custom definition, embed it to keep behavior stable even if dropdown loses it later
    const custom = customItems.find((c) => c.name === name);
    if (custom) base.customMeta = { ...custom };
    else base.customMeta = undefined;
    update(idx, base);
  };

  const bumpDurability = (idx, delta) => {
    const it = equipment[idx];
    const meta = lookupMeta(it);
    if (!meta || !meta.durability) return;
    const max = Number(meta.durability) || 0;
    let cur = (it.currentDurability ?? max) + delta;
    if (cur <= 0) {
      // lose one quantity, and if still have, reset durability to max
      const qty = Math.max(0, (Number(it.quantity) || 0) - 1);
      if (qty <= 0) {
        removeIndex(idx);
      } else {
        update(idx, { quantity: qty, currentDurability: max });
      }
      return;
    }
    if (cur > max) cur = max;
    update(idx, { currentDurability: cur });
  };

  const bumpAmmo = (idx, delta) => {
    const it = equipment[idx];
    const meta = lookupMeta(it);
    if (!meta || !meta.ammo) return;
    const max = Number(meta.ammo) || 0;
    let cur = (it.currentAmmo ?? max) + delta;
    if (cur < 0) cur = 0;
    if (cur > max) cur = max;
    update(idx, { currentAmmo: cur });
  };

  const reload = (idx) => {
    const it = equipment[idx];
    const meta = lookupMeta(it);
    if (!meta || !meta.ammo) return;
    const max = Number(meta.ammo) || 0;
    update(idx, { currentAmmo: max });
  };

  const addCustom = () => {
    const name = prompt('Custom item name?');
    if (!name) return;

    const ask = (label) => {
      const v = prompt(label + ' (number or n/a)') || '';
      if (/^\s*(n\/a|na|null|none)\s*$/i.test(v)) return null;
      if (v.trim() === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : v; // numbers where sensible; strings for damage/range/weight
    };

    const durability = ask('Durability (max)');
    const ammo = ask('Ammo (max)');
    const weight = ask('Weight (e.g., light/heavy)');
    const damage = ask('Damage (e.g., 2d6 or "Melee + 1d4")');
    const range = ask('Range (e.g., "30ft - 60ft" or "Melee range")');
    const growthTime = ask('Growth time');
    const yieldVal = ask('Yield');
    const useCost = ask('Bar usage (use cost)');

    const meta = {
      name,
      durability: durability ?? undefined,
      ammo: ammo ?? undefined,
      weight: typeof weight === 'string' ? weight : undefined,
      damage: typeof damage === 'string' ? damage : undefined,
      range: typeof range === 'string' ? range : undefined,
      growthTime: growthTime ?? undefined,
      yield: yieldVal ?? undefined,
      useCost: useCost ?? undefined,
    };

    setCustomItems((prev) => [...prev, meta]);
    setEquipment([
      ...equipment,
      {
        name,
        quantity: 1,
        customMeta: meta,
        currentDurability: meta.durability ? Number(meta.durability) : undefined,
        currentAmmo: meta.ammo ? Number(meta.ammo) : undefined,
      },
    ]);
  };

  return (
    <div>
      {equipment.map((it, idx) => {
        const meta = lookupMeta(it);
        // Initialize counters lazily when rendering
        if (meta) ensureCounters(idx, meta);

        const showDur = meta && meta.durability;
        const showAmmo = meta && meta.ammo && !showDur; // treat items as either durability or ammo (not both)

        return (
          <div key={idx} style={{ borderBottom: '1px solid #eee', padding: '0.5rem 0' }}>
            {/* Header row: selector + qty + counters + remove */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={it.name} onChange={(e) => changeName(idx, e.target.value)}>
                <option value="">-- Select Item --</option>
                {allOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>

              <span>Qty</span>
              <input
                style={{ width: 50 }}
                type="number"
                min={0}
                value={it.quantity ?? 1}
                onChange={(e) => {
                  const q = Math.max(0, Number(e.target.value) || 0);
                  if (q === 0) removeIndex(idx);
                  else update(idx, { quantity: q });
                }}
              />

              {showDur && (
                <>
                  <span>Durability</span>
                  <button onClick={() => bumpDurability(idx, -1)}>-</button>
                  <span>
                    {' '}
                    {(it.currentDurability ?? meta.durability)} / {meta.durability}
                  </span>
                  <button onClick={() => bumpDurability(idx, +1)}>+</button>
                </>
              )}

              {showAmmo && (
                <>
                  <span>Ammo</span>
                  <button onClick={() => bumpAmmo(idx, -1)}>-</button>
                  <span>
                    {' '}
                    {(it.currentAmmo ?? meta.ammo)} / {meta.ammo}
                  </span>
                  <button onClick={() => bumpAmmo(idx, +1)}>+</button>
                  <button onClick={() => reload(idx)} style={{ marginLeft: 6 }}>Reload</button>
                </>
              )}

              <button onClick={() => removeIndex(idx)} style={{ marginLeft: 'auto' }}>Remove</button>
            </div>

            {/* Details */}
            <div style={{ marginTop: 6 }}>
              {meta?.damage ? (
                <div><strong>Damage:</strong> {meta.damage}</div>
              ) : null}
              {meta?.range ? (
                <div><strong>Range:</strong> {meta.range}</div>
              ) : null}
              {meta?.weight ? (
                <div><strong>Weight:</strong> {meta.weight}</div>
              ) : null}
              {meta?.durability ? (
                <div><em>Max Durability:</em> {meta.durability}</div>
              ) : null}
              {meta?.ammo ? (
                <div><em>Max Ammo:</em> {meta.ammo}</div>
              ) : null}
              {meta?.growthTime ? (
                <div><strong>Growth time:</strong> {meta.growthTime}</div>
              ) : null}
              {meta?.yield ? (
                <div><strong>Yield:</strong> {meta.yield}</div>
              ) : null}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button onClick={addRow}>+ Add Equipment</button>
        <button onClick={addCustom}>+ Add Custom</button>
      </div>
    </div>
  );
}
