// src/devilFruitActions.js
import actionsByFruit from './data/devilFruitActions.json';
import { devilFruits } from './devilFruits'; // names/abilities stay here :contentReference[oaicite:1]{index=1}

// Map fruit name -> { ability, actions: [...] }
export const devilFruitCatalog = (() => {
  const index = {};
  for (const f of devilFruits) {
    index[f.name] = { ability: f.ability, actions: actionsByFruit[f.name] || [] };
  }
  return index;
})();

// Convenience getter that your UI can call
export function getFruitActions(fruitName) {
  return (devilFruitCatalog[fruitName]?.actions || []).map(a => ({
    name: a.name,
    barCost: Number(a.barCost) || 0,
    perTurnCost: Number(a.perTurnCost) || 0,
  }));
}
