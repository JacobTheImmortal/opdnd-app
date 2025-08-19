import React, { useMemo } from 'react';
import { equipmentList } from './equipmentData';

/**
 * EquipmentSheet
 * - Shows equipment rows with stats
 * - Supports BOTH durability and ammo items
 * - Hides n/a / empty stats
 * - "+ Add Equipment" adds a catalog item
 * - "+ Add Custom" creates a user item with prompts
 *
 * Props
 *  - equipment: Array<EquipItem>
 *  - setEquipment(next: EquipItem[]): void  (also persists in parent)
 */
export default function EquipmentSheet({ equipment, setEquipment }) {
  // Fast lookup for catalog meta
  const catalog = useMemo(() => {
    const map = new Map();
    equipmentList.forEach((m) => map.set(m.name, m));
    return map;
  }, []);

  // Helpers --------------------------------------------------------------
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const isNA = (v) => v === undefined || v === null || v === '' || String(v).toLowerCase() === 'n/a';

  const getMeta = (name) => catalog.get(name) || {};

  // Given item + meta, compute the effective fields we should show
  const shapeItem = (item) => {
    const meta = getMeta(item.name);

    // Base stats: prefer item overrides, then meta values
    const damage = item.damage ?? meta.damage;
    const range = item.range ?? meta.range;
    const weight = item.weight ?? meta.weight;
    const description = item.customDesc ?? meta.description;
    const useCost = item.useCost ?? meta.useCost ?? 0;
    const growthTime = item.growthTime ?? meta.growthTime; // may be n/a
    const yieldStat = item.yield ?? meta.yield;

    // Durability: support both legacy meta.durability and item.maxDurability
    const maxDurability = Number(
      item.maxDurability ?? meta.durability ?? meta.maxDurability ?? 0
    ) || 0;
    const curDurability = Number(
      item.currentDurability ?? item.durability ?? maxDurability
    );

    // Ammo: support meta.ammo as max, with item.currentAmmo falling back to max
    const maxAmmo = Number(item.maxAmmo ?? meta.ammo ?? 0) || 0;
    const curAmmo = Number(item.currentAmmo ?? (maxAmmo > 0 ? maxAmmo : 0));

    return {
      meta,
      damage,
      range,
      weight,
      description,
      useCost,
      growthTime,
      yieldStat,
      maxDurability,
      curDurability,
      maxAmmo,
      curAmmo,
    };
  };

  // Mutators ------------------------------------------------------------
  const updateAt = (idx, patch) => {
    const next = equipment.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setEquipment(next);
  };

  const removeAt = (idx) => {
    const next = equipment.filter((_, i) => i !== idx);
    setEquipment(next);
  };

  // When user changes the selected catalog name
  const onChangeName = (idx, name) => {
    const meta = getMeta(name);
    // Reset per-item dynamic state when choosing a new catalog item
    const withDefaults = {
      name,
      // quantity keeps its current value if present, else 1
      quantity: clamp(Number(equipment[idx]?.quantity || 1), 1, 999),
      // durability defaults to max if present
      maxDurability: Number(meta.durability ?? meta.maxDurability ?? 0) || 0,
      currentDurability: Number(meta.durability ?? meta.maxDurability ?? 0) || 0,
      // ammo defaults to max if present
      maxAmmo: Number(meta.ammo ?? 0) || 0,
      currentAmmo: Number(meta.ammo ?? 0) || 0,
      damage: meta.damage,
      range: meta.range,
      weight: meta.weight,
      useCost: meta.useCost ?? 0,
      customDesc: '',
      growthTime: meta.growthTime,
      yield: meta.yield,
    };
    updateAt(idx, withDefaults);
  };

  const changeQty = (idx, quantity) => {
    const q = clamp(Number(quantity || 0), 0, 999);
    if (q <= 0) return removeAt(idx);
    updateAt(idx, { quantity: q });
  };

  // Durability controls
  const incDurability = (idx, delta) => {
    const item = equipment[idx];
    const { maxDurability = 0, currentDurability = 0 } = item;
    if (maxDurability <= 0) return; // no durability for this item

    let cur = clamp(Number(currentDurability) + delta, 0, Number(maxDurability));

    // If we hit 0 when subtracting, consume one quantity and reset durability if any left
    if (cur === 0 && delta < 0) {
      const qty = clamp(Number(item.quantity || 1) - 1, 0, 999);
      if (qty <= 0) {
        removeAt(idx);
        return;
      } else {
        updateAt(idx, { quantity: qty, currentDurability: Number(maxDurability) });
        return;
      }
    }

    updateAt(idx, { currentDurability: cur });
  };

  // Ammo controls
  const incAmmo = (idx, delta) => {
    const item = equipment[idx];
    const { maxAmmo = 0 } = item;
    if (maxAmmo <= 0) return; // not an ammo item
    const cur = clamp(Number(item.currentAmmo ?? maxAmmo) + delta, 0, Number(maxAmmo));
    updateAt(idx, { currentAmmo: cur });
  };

  const reload = (idx) => {
    const item = equipment[idx];
    const { maxAmmo = 0 } = item;
    if (maxAmmo <= 0) return;
    updateAt(idx, { currentAmmo: Number(maxAmmo) });
  };

  // Adders --------------------------------------------------------------
  const addCatalog = () => {
    // add a fresh, blank row (user selects name)
    setEquipment([
      ...equipment,
      { name: '', quantity: 1 },
    ]);
  };

  const addCustom = () => {
    const name = prompt('Item name?');
    if (!name) return;

    const toVal = (label) => {
      const raw = prompt(label + ' (number or n/a/blank)');
      if (!raw || raw.toLowerCase() === 'n/a') return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    };

    const damage = prompt('Damage (text, e.g., "2d6" or "Melee + 1d4")') || undefined;
    const range = prompt('Range (text, e.g., "30ft - 60ft" or "Melee range")') || undefined;
    const weight = prompt('Weight (light/heavy or text)') || undefined;

    const maxDurability = toVal('Max Durability');
    const maxAmmo = toVal('Max Ammo');
    const growthTime = prompt('Growth time (text/number or n/a)') || undefined;
    const yieldStat = prompt('Yield (text/number or n/a)') || undefined;
    const useCost = toVal('Bar usage per action') ?? 0;

    setEquipment([
      ...equipment,
      {
        name,
        quantity: 1,
        // Stats
        damage,
        range,
        weight,
        useCost,
        growthTime,
        yield: yieldStat,
        // Durability / ammo
        maxDurability: Number(maxDurability || 0),
        currentDurability: Number(maxDurability || 0),
        maxAmmo: Number(maxAmmo || 0),
        currentAmmo: Number(maxAmmo || 0),
        isCustom: true,
      },
    ]);
  };

  // Rendering -----------------------------------------------------------
  return (
    <div>
      <h3>Equipment</h3>

      {equipment.map((it, idx) => {
        const shaped = shapeItem(it);
        const q = Number(it.quantity || 1);

        const showDur = shaped.maxDurability > 0;
        const showAmmo = shaped.maxAmmo > 0;

        return (
          <div key={idx} style={{ borderTop: '1px solid #ddd', paddingTop: 10, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Item chooser */}
              <select
                value={it.name || ''}
                onChange={(e) => onChangeName(idx, e.target.value)}
              >
                <option value="">-- Select Item --</option>
                {equipmentList.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>

              {/* Quantity */}
              <span>Qty</span>
              <input
                style={{ width: 60 }}
                type="number"
                min={0}
                value={q}
                onChange={(e) => changeQty(idx, e.target.value)}
              />

              {/* Durability controls (only when supported) */}
              {showDur && (
                <>
                  <span>Durability</span>
                  <button onClick={() => incDurability(idx, -1)}>-</button>
                  <span style={{ minWidth: 56, display: 'inline-block', textAlign: 'center' }}>
                    {shaped.curDurability} / {shaped.maxDurability}
                  </span>
                  <button onClick={() => incDurability(idx, +1)}>+</button>
                </>
              )}

              {/* Ammo controls (only when supported) */}
              {showAmmo && (
                <>
                  <span>Ammo</span>
                  <button onClick={() => incAmmo(idx, -1)}>-</button>
                  <span style={{ minWidth: 56, display: 'inline-block', textAlign: 'center' }}>
                    {shaped.curAmmo} / {shaped.maxAmmo}
                  </span>
                  <button onClick={() => incAmmo(idx, +1)}>+</button>
                  <button onClick={() => reload(idx)} style={{ marginLeft: 6 }}>Reload</button>
                </>
              )}

              <button onClick={() => removeAt(idx)} style={{ marginLeft: 'auto' }}>Remove</button>
            </div>

            {/* Stats block - hide empty / n/a rows */}
            <div style={{ marginTop: 6 }}>
              {!isNA(shaped.damage) && (
                <div><strong>Damage:</strong> {shaped.damage}</div>
              )}
              {!isNA(shaped.range) && (
                <div><strong>Range:</strong> {shaped.range}</div>
              )}
              {!isNA(shaped.weight) && (
                <div><strong>Weight:</strong> {shaped.weight}</div>
              )}
              {showDur && (
                <div><em>Max Durability:</em> {shaped.maxDurability}</div>
              )}
              {showAmmo && (
                <div><em>Max Ammo:</em> {shaped.maxAmmo}</div>
              )}
              {!isNA(shaped.growthTime) && (
                <div><strong>Growth time:</strong> {shaped.growthTime}</div>
              )}
              {!isNA(shaped.yieldStat) && (
                <div><strong>Yield:</strong> {shaped.yieldStat}</div>
              )}
              {!isNA(shaped.description) && (
                <p style={{ fontStyle: 'italic', marginTop: 6 }}>{shaped.description}</p>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button onClick={addCatalog}>+ Add Equipment</button>
        <button onClick={addCustom}>+ Add Custom</button>
      </div>
    </div>
  );
}
