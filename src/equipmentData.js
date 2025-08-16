// equipmentData.js

export const equipmentList = [
  // Weapons / Melee
  {
    name: 'Sword',
    damage: 'Melee + 1d6',
    durability: 'n/a',
    useCost: 2,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 'n/a',
    range: 'Melee range',
    weight: 'light',
    description: 'A balanced blade for close combat.'
  },
  {
    name: 'Hammer',
    damage: 'Melee + 1d8',
    durability: 'n/a',
    useCost: 2,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 'n/a',
    range: 'Melee range',
    weight: 'heavy',
    description: 'A heavy striking tool used as a weapon.'
  },
  {
    name: 'Shield',
    damage: 'Melee',
    durability: 'n/a',
    useCost: 1,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 'n/a',
    range: 'Melee range',
    weight: 'heavy',
    description: 'Defensive equipment; can be used to bash.'
  },
  {
    name: 'Axe',
    damage: 'Melee + 1d8',
    durability: 'n/a',
    useCost: 2,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 'n/a',
    range: 'Melee range',
    weight: 'heavy',
    description: 'Single‑hand or two‑handed chopping weapon.'
  },
  {
    name: 'Spear',
    damage: 'Melee + 1d4',
    durability: 'n/a',
    useCost: 2,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 'n/a',
    range: 'Melee range + 5',
    weight: 'light',
    description: 'A thrusting spear with a bit of extra reach.'
  },
  {
    name: 'Trident',
    damage: 'Melee + 1d4',
    durability: 'n/a',
    useCost: 2,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 'n/a',
    range: 'Melee range + 5',
    weight: 'light',
    description: 'Three‑pronged spear often used at sea.'
  },
  {
    name: 'Knife',
    damage: 'Melee + 1d4',
    durability: 'n/a',
    useCost: 1,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 'n/a',
    range: 'Melee range',
    weight: 'light',
    description: 'A small blade for close quarters.'
  },
  {
    name: 'Knuckles',
    damage: 'Melee + 1d4',
    durability: 'n/a',
    useCost: 1,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 'n/a',
    range: 'Melee range',
    weight: 'light',
    description: 'Reinforced striking implements.'
  },
  {
    name: 'Chains',
    damage: 'Melee + 1d6',
    durability: 'n/a',
    useCost: 2,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 'n/a',
    range: 'Melee range + 10',
    weight: 'heavy',
    description: 'Length of chain used to strike and entangle.'
  },
  {
    name: 'Sythe',
    damage: 'Melee + 1d6',
    durability: 'n/a',
    useCost: 2,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 'n/a',
    range: 'Melee range + 5',
    weight: 'heavy',
    description: 'Curved blade on a long handle; unwieldy but strong.'
  },
  {
    name: 'Shigure',
    damage: 'Melee + 1d8',
    durability: 'n/a',
    useCost: 2,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 'n/a',
    range: 'Melee range',
    weight: 'light',
    description: 'Named blade of fine craft.'
  },

  // Ranged Firearms / Bows
  {
    name: 'Pistol',
    damage: '2d6',
    durability: 8,
    useCost: 2,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 6,
    range: '30ft - 60ft',
    weight: 'light',
    description: 'A standard 6‑shot firearm.'
  },
  {
    name: 'Rifle',
    damage: '2d8',
    durability: 6,
    useCost: 3,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 1,
    range: '30ft - 120ft',
    weight: 'heavy',
    description: 'Long gun with extended range.'
  },
  {
    name: 'CrossBow',
    damage: '2d4',
    durability: 'n/a',
    useCost: 2,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 1,
    range: '30ft - 60ft',
    weight: 'light',
    description: 'Mechanical bow that fires bolts.'
  },
  {
    name: 'Long Neck Rifle',
    damage: '2d8',
    durability: 6,
    useCost: 3,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 1,
    range: '30ft - 240ft',
    weight: 'heavy',
    description: 'Extreme‑range rifle.'
  },
  {
    name: 'Pistol+MagAttach',
    damage: '2d6',
    durability: 10,
    useCost: 2,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 12,
    range: '30ft - 60ft',
    weight: 'light',
    description: 'Pistol with an attached magazine for more shots.'
  },

  // Tools / Misc
  {
    name: 'Fishing Rod',
    damage: '0',
    durability: 20,
    useCost: 1,
    sellValue: 'n/a',
    buyValue: 'n/a',
    ammo: 'n/a',
    range: '60ft',
    weight: 'light',
    description: 'Basic rod for fishing; also handy for utility.'
  },

  // Dials / Special (placeholders with minimal known values)
  { name: 'Ball Dial', damage: 'n/a', durability: 'n/a', useCost: 2, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: '30ft', weight: 'light', description: 'Skypiea dial that stores kinetic energy.' },
  { name: 'Breath Dial', damage: 'n/a', durability: 'n/a', useCost: 2, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: 'n/a', weight: 'light', description: 'Stores and releases breath/air.' },
  { name: 'Flame Dial', damage: '2d6', durability: 'n/a', useCost: 3, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: '30ft', weight: 'light', description: 'Produces flames from stored energy.' },
  { name: 'Flash Dial', damage: 'n/a', durability: 'n/a', useCost: 2, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: 'n/a', weight: 'light', description: 'Emits a blinding flash.' },
  { name: 'Impact Dial', damage: 'Depends', durability: 'n/a', useCost: 3, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: '5ft', weight: 'light', description: 'Absorbs impact to release later.' },
  { name: 'Lamp Dial', damage: 'n/a', durability: 'n/a', useCost: 1, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: 'n/a', weight: 'light', description: 'Produces light.' },
  { name: 'Reject Dial', damage: 'Depends', durability: 'n/a', useCost: 5, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: '5ft', weight: 'light', description: 'Powerful, risky output of stored force.' },
  { name: 'Water Dial', damage: 'n/a', durability: 'n/a', useCost: 2, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: 'n/a', weight: 'light', description: 'Stores water for later use.' },

  // Explosives / Throwables (placeholders; refine later)
  { name: 'Hand Grenade', damage: '3d4', durability: 'n/a', useCost: 3, sellValue: 'n/a', buyValue: 'n/a', ammo: 1, range: '60ft', weight: 'light', description: 'Thrown explosive.' },
  { name: 'Flare', damage: 'n/a', durability: 'n/a', useCost: 1, sellValue: 'n/a', buyValue: 'n/a', ammo: 1, range: '60ft', weight: 'light', description: 'Signal flare.' },
  { name: 'Lighter', damage: 'n/a', durability: 'n/a', useCost: 1, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: 'Melee Range', weight: 'light', description: 'Creates flame.' },
  { name: 'BlastPouch', damage: '2d8', durability: 'n/a', useCost: 3, sellValue: 'n/a', buyValue: 'n/a', ammo: 1, range: 'Melee Range', weight: 'light', description: 'Small explosive packet.' },
  { name: 'Disposable CL', damage: '3d10', durability: 'n/a', useCost: 4, sellValue: 'n/a', buyValue: 'n/a', ammo: 1, range: '30ft - 60ft', weight: 'light', description: 'Disposable explosive/charge (placeholder).' },
  { name: 'CannonBall', damage: '3d8', durability: 'n/a', useCost: 4, sellValue: 'n/a', buyValue: 'n/a', ammo: 1, range: '60ft - 120ft', weight: 'heavy', description: 'Cannon projectile.' },
  { name: 'Explosive Barrel', damage: '4d10', durability: 'n/a', useCost: 5, sellValue: 'n/a', buyValue: 'n/a', ammo: 1, range: '30ft', weight: 'heavy', description: 'Large explosive barrel.' },

  // Utility / Kits (placeholders)
  { name: 'Medical Tools', damage: 'n/a', durability: 'n/a', useCost: 1, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: 'n/a', weight: 'light', description: 'Precision tools for medical use.' },
  { name: 'Medic Kit', damage: 'n/a', durability: 'n/a', useCost: 2, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: 'n/a', weight: 'light', description: 'Supplies for stabilizing wounds.' },
  { name: 'Ship Repairs', damage: 'n/a', durability: 'n/a', useCost: 2, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: 'n/a', weight: 'heavy', description: 'Tools & materials for ship repair.' },
  { name: 'Iron Dial', damage: 'Depends', durability: 'n/a', useCost: 3, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: '30ft', weight: 'light', description: 'Dial that stores and releases iron/metallic force (placeholder).' },
  { name: 'Fluid Pouch', damage: 'n/a', durability: 'n/a', useCost: 1, sellValue: 'n/a', buyValue: 'n/a', ammo: 'n/a', range: 'n/a', weight: 'light', description: 'General container for liquids.' }
];
