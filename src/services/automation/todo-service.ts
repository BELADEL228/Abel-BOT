/**
 * TodoService — Gestionnaire de tâches WhatsApp synchronisé avec PostgreSQL.
 * Stockage en mémoire avec persistance DB fire-and-forget.
 */

import prisma from '../../core/db/prisma.js';
import logger from '../../core/logger/logger.js';

export type TodoStatus = 'pending' | 'done' | 'cancelled';
export type TodoPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TodoItem {
  id: string;
  ownerJid: string;
  title: string;
  dueDate?: Date;
  priority: TodoPriority;
  status: TodoStatus;
  createdAt: Date;
  completedAt?: Date;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export class TodoService {
  private static instance: TodoService;
  private todos: Map<string, TodoItem[]> = new Map(); // ownerJid -> todos
  private dbAvailable = true;

  private constructor() {}
  public static getInstance(): TodoService {
    if (!TodoService.instance) TodoService.instance = new TodoService();
    return TodoService.instance;
  }

  // ── Load from DB ─────────────────────────────────────────────────────────────

  public async loadForOwner(ownerJid: string): Promise<void> {
    if (!this.dbAvailable || !prisma) return;
    try {
      const rows = await (prisma as any).todo?.findMany({
        where: { ownerJid, status: { not: 'cancelled' } },
        orderBy: { createdAt: 'desc' }
      }).catch(() => null);

      if (rows) {
        this.todos.set(ownerJid, rows.map((r: any) => ({
          id: r.id,
          ownerJid: r.ownerJid,
          title: r.title,
          dueDate: r.dueDate || undefined,
          priority: r.priority as TodoPriority,
          status: r.status as TodoStatus,
          createdAt: r.createdAt,
          completedAt: r.completedAt || undefined
        })));
      }
    } catch {
      this.dbAvailable = false;
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  public add(ownerJid: string, title: string, priority: TodoPriority = 'normal', dueDate?: Date): TodoItem {
    const item: TodoItem = {
      id: genId(),
      ownerJid,
      title,
      priority,
      status: 'pending',
      createdAt: new Date(),
      dueDate
    };

    if (!this.todos.has(ownerJid)) this.todos.set(ownerJid, []);
    const list = this.todos.get(ownerJid)!;
    if (list.length >= 200) {
      list.pop(); // Remove oldest
    }
    list.unshift(item);
    this.persist(item, 'create');
    return item;
  }

  public complete(ownerJid: string, id: string): TodoItem | null {
    const list = this.todos.get(ownerJid) || [];
    const item = list.find(t => t.id.toUpperCase() === id.toUpperCase());
    if (!item || item.status === 'done') return null;
    item.status = 'done';
    item.completedAt = new Date();
    this.persist(item, 'update');
    return item;
  }

  public remove(ownerJid: string, id: string): boolean {
    const list = this.todos.get(ownerJid) || [];
    const idx = list.findIndex(t => t.id.toUpperCase() === id.toUpperCase());
    if (idx === -1) return false;
    list[idx].status = 'cancelled';
    this.persist(list[idx], 'update');
    list.splice(idx, 1);
    return true;
  }

  public getPending(ownerJid: string): TodoItem[] {
    return (this.todos.get(ownerJid) || []).filter(t => t.status === 'pending');
  }

  public getDone(ownerJid: string): TodoItem[] {
    return (this.todos.get(ownerJid) || []).filter(t => t.status === 'done');
  }

  public getAll(ownerJid: string): TodoItem[] {
    return this.todos.get(ownerJid) || [];
  }

  // ── Persist ──────────────────────────────────────────────────────────────────

  private async persist(item: TodoItem, op: 'create' | 'update'): Promise<void> {
    if (!this.dbAvailable || !prisma) return;
    try {
      const model = (prisma as any).todo;
      if (!model) return;
      if (op === 'create') {
        await model.create({
          data: {
            id: item.id,
            ownerJid: item.ownerJid,
            title: item.title,
            priority: item.priority,
            status: item.status,
            dueDate: item.dueDate || null,
            createdAt: item.createdAt
          }
        }).catch(() => {});
      } else {
        await model.update({
          where: { id: item.id },
          data: {
            status: item.status,
            completedAt: item.completedAt || null
          }
        }).catch(() => {});
      }
    } catch {
      this.dbAvailable = false;
    }
  }
}

export default TodoService.getInstance();
