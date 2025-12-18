import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Category,
  AcademicTerm,
  Item,
  HistoricalCount,
  InventorySession,
  InventoryCount,
} from '../types';

// Categories
export const categoriesCollection = collection(db, 'categories');

export async function getCategories(): Promise<Category[]> {
  const snapshot = await getDocs(query(categoriesCollection, orderBy('name')));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt || Timestamp.now(),
  })) as Category[];
}

export async function getCategory(id: string): Promise<Category | null> {
  const docRef = doc(db, 'categories', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt || Timestamp.now(),
  } as Category;
}

export async function createCategory(name: string): Promise<string> {
  const docRef = await addDoc(categoriesCollection, {
    name: name.toUpperCase(),
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

// Academic Terms
export const academicTermsCollection = collection(db, 'academicTerms');

export async function getAcademicTerms(): Promise<AcademicTerm[]> {
  const snapshot = await getDocs(
    query(academicTermsCollection, orderBy('year', 'desc'), orderBy('term', 'desc'))
  );
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt || Timestamp.now(),
  })) as AcademicTerm[];
}

export async function getAcademicTerm(id: string): Promise<AcademicTerm | null> {
  const docRef = doc(db, 'academicTerms', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt || Timestamp.now(),
  } as AcademicTerm;
}

export async function createAcademicTerm(
  name: string,
  term: AcademicTerm['term'],
  year: number
): Promise<string> {
  const docRef = await addDoc(academicTermsCollection, {
    name,
    term,
    year,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

// Items
export const itemsCollection = collection(db, 'items');

export async function getItems(categoryId?: string): Promise<Item[]> {
  const constraints: QueryConstraint[] = [orderBy('name')];
  if (categoryId) {
    constraints.unshift(where('categoryId', '==', categoryId));
  }
  const snapshot = await getDocs(query(itemsCollection, ...constraints));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt || Timestamp.now(),
  })) as Item[];
}

export async function getItem(id: string): Promise<Item | null> {
  const docRef = doc(db, 'items', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt || Timestamp.now(),
  } as Item;
}

export async function createItem(item: Omit<Item, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(itemsCollection, {
    ...item,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateItem(id: string, updates: Partial<Item>): Promise<void> {
  const docRef = doc(db, 'items', id);
  await updateDoc(docRef, updates);
}

export async function deleteItem(id: string): Promise<void> {
  const docRef = doc(db, 'items', id);
  await deleteDoc(docRef);
}

// Inventory Sessions
export const inventorySessionsCollection = collection(db, 'inventorySessions');

export async function getInventorySessions(): Promise<InventorySession[]> {
  const snapshot = await getDocs(
    query(inventorySessionsCollection, orderBy('date', 'desc'))
  );
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt || Timestamp.now(),
  })) as InventorySession[];
}

export async function getInventorySession(id: string): Promise<InventorySession | null> {
  const docRef = doc(db, 'inventorySessions', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt || Timestamp.now(),
  } as InventorySession;
}

export async function createInventorySession(
  session: Omit<InventorySession, 'id' | 'createdAt'>
): Promise<string> {
  const docRef = await addDoc(inventorySessionsCollection, {
    ...session,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateInventorySession(
  id: string,
  updates: Partial<InventorySession>
): Promise<void> {
  const docRef = doc(db, 'inventorySessions', id);
  await updateDoc(docRef, updates);
}

// Inventory Counts
export const inventoryCountsCollection = collection(db, 'inventoryCounts');

export async function getInventoryCounts(sessionId: string): Promise<InventoryCount[]> {
  const snapshot = await getDocs(
    query(
      inventoryCountsCollection,
      where('sessionId', '==', sessionId),
      orderBy('itemId')
    )
  );
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    countedAt: doc.data().countedAt || Timestamp.now(),
  })) as InventoryCount[];
}

export async function createOrUpdateInventoryCount(
  itemId: string,
  sessionId: string,
  countedQuantity: number,
  countedByUid?: string
): Promise<void> {
  // Check if count already exists
  const existingQuery = query(
    inventoryCountsCollection,
    where('itemId', '==', itemId),
    where('sessionId', '==', sessionId)
  );
  const existing = await getDocs(existingQuery);

  if (!existing.empty) {
    // Update existing
    const docRef = doc(db, 'inventoryCounts', existing.docs[0].id);
    await updateDoc(docRef, {
      countedQuantity,
      countedByUid,
      countedAt: Timestamp.now(),
    });
  } else {
    // Create new
    await addDoc(inventoryCountsCollection, {
      itemId,
      sessionId,
      countedQuantity,
      countedByUid,
      countedAt: Timestamp.now(),
    });
  }
}

// Historical Counts
export const historicalCountsCollection = collection(db, 'historicalCounts');

export async function getHistoricalCounts(
  itemId?: string,
  academicTermId?: string
): Promise<HistoricalCount[]> {
  const constraints: QueryConstraint[] = [];
  if (itemId) {
    constraints.push(where('itemId', '==', itemId));
  }
  if (academicTermId) {
    constraints.push(where('academicTermId', '==', academicTermId));
  }
  const snapshot = await getDocs(query(historicalCountsCollection, ...constraints));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    importedAt: doc.data().importedAt || Timestamp.now(),
  })) as HistoricalCount[];
}

export async function createHistoricalCount(
  count: Omit<HistoricalCount, 'id' | 'importedAt'>
): Promise<string> {
  const docRef = await addDoc(historicalCountsCollection, {
    ...count,
    importedAt: Timestamp.now(),
  });
  return docRef.id;
}

