import type { SaveData } from '@/types/game';
import { ContentLoader } from './ContentLoader';
import { EventBus } from './EventBus';
import { GameEvents } from '@/types/events';
import type { DialogueNode, DialogueTree } from '@/types/content';

class NarrativeServiceClass {
  private flags = new Set<string>();

  applyFlagsFromSave(save: SaveData): void {
    this.flags.clear();
    for (const f of save.narrativeFlags) this.flags.add(f);
  }

  setFlag(id: string): void {
    if (this.flags.has(id)) return;
    this.flags.add(id);
    const save = (globalThis as unknown as Record<string, unknown>)['__save'] as SaveData | undefined;
    if (save && !save.narrativeFlags.includes(id)) {
      save.narrativeFlags.push(id);
    }
    EventBus.emit(GameEvents.NARRATIVE_FLAG_SET, { flagId: id });
  }

  getFlag(id: string): boolean {
    return this.flags.has(id);
  }

  /** Returns the best-matching DialogueNode for npcId given current flags */
  resolveDialogue(npcId: string): DialogueNode | null {
    const tree = ContentLoader.getDialogueTree(npcId);
    if (!tree) return null;
    return this.findBestNode(tree);
  }

  getDialogueTree(npcId: string): DialogueTree | undefined {
    return ContentLoader.getDialogueTree(npcId);
  }

  getNextNode(npcId: string, currentNodeId: string): DialogueNode | null {
    const tree = ContentLoader.getDialogueTree(npcId);
    if (!tree) return null;
    const current = tree.nodes.find((n) => n.nodeId === currentNodeId);
    if (!current?.nextNodeId) return null;
    return tree.nodes.find((n) => n.nodeId === current.nextNodeId) ?? null;
  }

  private findBestNode(tree: DialogueTree): DialogueNode | null {
    const matching = tree.nodes
      .filter((node) =>
        node.conditions.every((cond) => this.flags.has(cond))
      )
      .sort((a, b) => b.priority - a.priority);

    return matching[0] ?? null;
  }

  recordLoreFind(memoId: string): void {
    const save = import('@/systems/SaveService').then(({ SaveService }) => {
      const s = SaveService.getCurrent();
      if (!s) return;
      if (!s.foundMemoIds.includes(memoId)) {
        s.foundMemoIds.push(memoId);
        this.setFlag(`lore_${memoId}_found`);
        EventBus.emit(GameEvents.LORE_FOUND, { memoId });
      }
    });
    void save;
  }

  hasFoundLore(memoId: string): boolean {
    return this.flags.has(`lore_${memoId}_found`);
  }
}

export const NarrativeService = new NarrativeServiceClass();
