import Phaser from 'phaser';
import type { DialogueNode } from '@/types/content';
import { EventBus } from '@/systems/EventBus';
import { GameEvents } from '@/types/events';

const DEPTH    = 180;
const CHAR_MS  = 35;  // typewriter milliseconds per character
const PAN_H    = 130;

export class DialogueBox {
  private scene:     Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private nameText:  Phaser.GameObjects.Text;
  private bodyText:  Phaser.GameObjects.Text;
  private arrow:     Phaser.GameObjects.Text;

  private queue:     DialogueNode[] = [];
  private typing:    boolean  = false;
  private fullText:  string   = '';
  private displayed: string   = '';
  private charIdx:   number   = 0;
  private typeTimer?: Phaser.Time.TimerEvent;

  private advanceKey?: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width, height } = scene.scale;
    const y = height - PAN_H / 2 - 8;

    const bg = scene.add.rectangle(width / 2, y, width - 16, PAN_H, 0x000000, 0.88)
      .setStrokeStyle(1, 0x446644);

    this.nameText = scene.add.text(20, y - PAN_H / 2 + 12, '', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#74C69D', fontStyle: 'bold',
    });

    this.bodyText = scene.add.text(20, y - PAN_H / 2 + 32, '', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#e8e8cc',
      wordWrap: { width: width - 56 }, lineSpacing: 4,
    });

    this.arrow = scene.add.text(width - 30, y + PAN_H / 2 - 20, '▼', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#74C69D',
    }).setOrigin(0.5);

    this.container = scene.add.container(0, 0, [bg, this.nameText, this.bodyText, this.arrow])
      .setDepth(DEPTH).setScrollFactor(0).setVisible(false);

    // Bounce tween on arrow
    scene.tweens.add({
      targets: this.arrow, y: this.arrow.y - 4,
      yoyo: true, repeat: -1, duration: 500, ease: 'Sine.easeInOut',
    });

    if (scene.input.keyboard) {
      this.advanceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.advanceKey.on('down', () => this.advance());
    }
    scene.input.on('pointerup', () => this.advance());
  }

  /** Queue a sequence of nodes and start displaying */
  play(nodes: DialogueNode[]): void {
    this.queue = [...nodes];
    this.container.setVisible(true);
    this.showNext();
  }

  private showNext(): void {
    if (this.queue.length === 0) {
      this.close();
      return;
    }
    const node = this.queue.shift()!;
    this.fullText  = node.text;
    this.displayed = '';
    this.charIdx   = 0;

    this.nameText.setText(node.speakerId ?? '');
    this.bodyText.setText('');
    this.arrow.setVisible(false);
    this.typing = true;

    this.typeTimer?.destroy();
    this.typeTimer = this.scene.time.addEvent({
      delay: CHAR_MS, loop: true, callback: this.typeNextChar, callbackScope: this,
    });
  }

  private typeNextChar(): void {
    if (this.charIdx >= this.fullText.length) {
      this.typeTimer?.destroy();
      this.typing = false;
      this.arrow.setVisible(true);
      return;
    }
    this.displayed += this.fullText[this.charIdx++];
    this.bodyText.setText(this.displayed);
  }

  /** Advance: if typing, skip to full text; if done, show next node */
  private advance(): void {
    if (!this.container.visible) return;
    if (this.typing) {
      this.typeTimer?.destroy();
      this.typing = false;
      this.displayed = this.fullText;
      this.bodyText.setText(this.displayed);
      this.arrow.setVisible(true);
    } else {
      this.showNext();
    }
  }

  private close(): void {
    this.typeTimer?.destroy();
    this.container.setVisible(false);
    EventBus.emit(GameEvents.DIALOGUE_ENDED, undefined);
  }

  isVisible(): boolean { return this.container.visible; }

  destroy(): void {
    this.typeTimer?.destroy();
    this.container.destroy();
  }
}
