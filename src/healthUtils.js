// healthUtils.js

export function calculateMaxHealth(baseHP, con, level) {
  const conBonus = Math.max(0, Math.floor(con - 10)); // +1 HP per point above 10
  const adjustedBase = baseHP + conBonus;
  const maxHP = Math.floor(adjustedBase * (1 + 0.2 * (level - 1))); // +20% per level
  return maxHP;
}

export function applyDamage(currentHP, amount) {
  return Math.max(0, currentHP - amount);
}

export function applyHeal(currentHP, maxHP, amount) {
  return Math.min(maxHP, currentHP + amount);
}