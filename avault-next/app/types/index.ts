import { Timestamp } from 'firebase/firestore';

export type TermType = 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER';

export interface Category {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export interface AcademicTerm {
  id: string;
  name: string; // e.g., "SPRING 2024"
  term: TermType;
  year: number;
  startDate?: Timestamp;
  endDate?: Timestamp;
  createdAt: Timestamp;
}

export interface Item {
  id: string;
  name: string;
  categoryId: string;
  location?: string;
  condition?: string;
  serialFrequency?: string;
  notes?: string;
  createdAt: Timestamp;
}

export interface HistoricalCount {
  id: string;
  itemId: string;
  academicTermId: string;
  countedQuantity: number;
  importedAt: Timestamp;
  notes?: string;
}

export interface InventorySession {
  id: string;
  name: string;
  academicTermId?: string;
  date: Timestamp;
  conductedByUid?: string;
  isComplete: boolean;
  notes?: string;
  createdAt: Timestamp;
}

export interface InventoryCount {
  id: string;
  itemId: string;
  sessionId: string;
  countedQuantity: number;
  countedByUid?: string;
  countedAt: Timestamp;
  notes?: string;
}

