// -------- src/devilFruitActions.js --------
import actionsByFruit from './data/devilFruitActions.json';

export function getFruitActions(fruitName) {
  const list = actionsByFruit[fruitName] || [];
  return list.map(a => ({
    name: a.name,
    barCost: Number(a.barCost) || 0,
    perTurnCost: Number(a.perTurnCost) || 0,
  }));
}

export default actionsByFruit;

