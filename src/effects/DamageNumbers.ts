import Phaser from 'phaser';

const POOL_SIZE = 40;
const DEPTH     = 70;
const FLOAT_VY  = -50;  // px/s
const LIFETIME  = 900;  // ms

interface DmgLabel {
  obj:  Phaser.GameObjects.Text;
  vy:   number;
  life: number;
  active: boolean;
}

export class DamageNumbers {
  private pool:  DmgLabel[];

  constructor(scene: Phaser.Scene) {
    this.pool  = Array.from({ length: POOL_SIZE }, () => {
      const obj = scene.add
        .text(0, 0, '', { fontFamily: 'Georgia, serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold' })
        .setDepth(DEPTH)
        .setVisible(false);
      return { obj, vy: FLOAT_VY, life: 0, active: false };
    });
  }

  spawn(x: number, y: number, amount: number, type: 'physical' | 'electric' | 'fire' | 'heal' = 'physical'): void {
    const lbl = this.pool.find(l => !l.active);
    if (!lbl) return;

    const col = type === 'heal'     ? '#55ff88'
              : type === 'electric' ? '#ffee44'
              : type === 'fire'     ? '#ff6622'
              : '#ffffff';

    lbl.obj.setText(type === 'heal' ? `+${amount}` : `-${amount}`)
           .setColor(col)
           .setPosition(x + Phaser.Math.Between(-12, 12), y - 20)
           .setAlpha(1)
           .setScale(type === 'physical' && amount > 30 ? 1.4 : 1)
           .setVisible(true);

    lbl.vy     = FLOAT_VY;
    lbl.life   = LIFETIME;
    lbl.active = true;
  }

  update(delta: number): void {
    this.pool.forEach(lbl => {
      if (!lbl.active) return;
      lbl.life -= delta;
      if (lbl.life <= 0) {
        lbl.active = false;
        lbl.obj.setVisible(false);
        return;
      }
      lbl.obj.y    += (lbl.vy * delta) / 1000;
      lbl.obj.alpha = Phaser.Math.Clamp(lbl.life / LIFETIME, 0, 1);
    });
  }
}
