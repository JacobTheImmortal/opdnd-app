// barUtils.js

export function calculateMaxBar(baseBar, int, wis, level) {
  const intBonus = Math.max(0, int - 10) * 2;
  const wisBonus = Math.max(0, wis - 10) * 2;
  const levelBonus = level * 5;
  return baseBar + intBonus + wisBonus + levelBonus;
}

export function spendBar(currentBar, amount) {
  return Math.max(0, currentBar - amount);
}

export function gainBar(currentBar, maxBar, amount) {
  return Math.min(maxBar, currentBar + amount);
}