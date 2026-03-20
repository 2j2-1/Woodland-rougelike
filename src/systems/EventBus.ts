import Phaser from 'phaser';
import type { GameEventValue } from '@/types/events';

/**
 * Typed singleton event bus wrapping Phaser.Events.EventEmitter.
 * Use GameEvents constants for all event names — never raw strings.
 */
class EventBusClass extends Phaser.Events.EventEmitter {
  emit(event: GameEventValue, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: GameEventValue, callback: (data: any) => void, context?: unknown): this {
    return super.on(event, callback, context);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once(event: GameEventValue, callback: (data: any) => void, context?: unknown): this {
    return super.once(event, callback, context);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: GameEventValue, callback?: (data: any) => void, context?: unknown): this {
    return super.off(event, callback, context);
  }
}

export const EventBus = new EventBusClass();
