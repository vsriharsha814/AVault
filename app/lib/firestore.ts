import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';

// Helper to check if db is available
const requireDb = () => {
  if (!db) {
    throw new Error('Firebase is not configured. Please set up your environment variables.');
  }
  return db;
};
import type {
  Category,
  AcademicTerm,
  Item,
  HistoricalCount,
  InventorySession,
  InventoryCount,
  User,
} from '../types';

// Categories
export const getCategoriesCollection = () => collection(requireDb(), 'categories');

export async function getCategories(): Promise<Category[]> {
  const snapshot = await getDocs(query(getCategoriesCollection(), orderBy('name')));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt || Timestamp.now(),
  })) as Category[];
}

export async function getCategory(id: string): Promise<Category | null> {
  const docRef = doc(requireDb(), 'categories', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt || Timestamp.now(),
  } as Category;
}

export async function createCategory(name: string): Promise<string> {
  const docRef = await addDoc(getCategoriesCollection(), {
    name: name.toUpperCase(),
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

// Academic Terms
export const getAcademicTermsCollection = () => collection(requireDb(), 'academicTerms');

export async function getAcademicTerms(): Promise<AcademicTerm[]> {
  const snapshot = await getDocs(
    query(getAcademicTermsCollection(), orderBy('year', 'desc'), orderBy('term', 'desc'))
  );
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt || Timestamp.now(),
  })) as AcademicTerm[];
}

export async function getAcademicTerm(id: string): Promise<AcademicTerm | null> {
  const docRef = doc(requireDb(), 'academicTerms', id);
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
  const docRef = await addDoc(getAcademicTermsCollection(), {
    name,
    term,
    year,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

// Items
export const getItemsCollection = () => collection(requireDb(), 'items');

export async function getItems(categoryId?: string): Promise<Item[]> {
  const constraints: QueryConstraint[] = [orderBy('name')];
  if (categoryId) {
    constraints.unshift(where('categoryId', '==', categoryId));
  }
  const snapshot = await getDocs(query(getItemsCollection(), ...constraints));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt || Timestamp.now(),
  })) as Item[];
}

export async function getItem(id: string): Promise<Item | null> {
  const docRef = doc(requireDb(), 'items', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt || Timestamp.now(),
  } as Item;
}

export async function createItem(item: Omit<Item, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(getItemsCollection(), {
    ...item,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateItem(id: string, updates: Partial<Item>): Promise<void> {
  const docRef = doc(requireDb(), 'items', id);
  await updateDoc(docRef, updates);
}

export async function deleteItem(id: string): Promise<void> {
  const docRef = doc(requireDb(), 'items', id);
  await deleteDoc(docRef);
}

// Inventory Sessions
export const getInventorySessionsCollection = () => collection(requireDb(), 'inventorySessions');

export async function getInventorySessions(): Promise<InventorySession[]> {
  const snapshot = await getDocs(
    query(getInventorySessionsCollection(), orderBy('date', 'desc'))
  );
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt || Timestamp.now(),
  })) as InventorySession[];
}

export async function getInventorySession(id: string): Promise<InventorySession | null> {
  const docRef = doc(requireDb(), 'inventorySessions', id);
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
  const docRef = await addDoc(getInventorySessionsCollection(), {
    ...session,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateInventorySession(
  id: string,
  updates: Partial<InventorySession>
): Promise<void> {
  const docRef = doc(requireDb(), 'inventorySessions', id);
  await updateDoc(docRef, updates);
}

// Inventory Counts
export const getInventoryCountsCollection = () => collection(requireDb(), 'inventoryCounts');

export async function getInventoryCounts(sessionId: string): Promise<InventoryCount[]> {
  const snapshot = await getDocs(
    query(
      getInventoryCountsCollection(),
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
    getInventoryCountsCollection(),
    where('itemId', '==', itemId),
    where('sessionId', '==', sessionId)
  );
  const existing = await getDocs(existingQuery);

  if (!existing.empty) {
    // Update existing
    const docRef = doc(requireDb(), 'inventoryCounts', existing.docs[0].id);
    await updateDoc(docRef, {
      countedQuantity,
      countedByUid,
      countedAt: Timestamp.now(),
    });
  } else {
    // Create new
    await addDoc(getInventoryCountsCollection(), {
      itemId,
      sessionId,
      countedQuantity,
      countedByUid,
      countedAt: Timestamp.now(),
    });
  }
}

// Historical Counts
export const getHistoricalCountsCollection = () => collection(requireDb(), 'historicalCounts');

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
  const snapshot = await getDocs(query(getHistoricalCountsCollection(), ...constraints));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    importedAt: doc.data().importedAt || Timestamp.now(),
  })) as HistoricalCount[];
}

export async function createHistoricalCount(
  count: Omit<HistoricalCount, 'id' | 'importedAt'>
): Promise<string> {
  const docRef = await addDoc(getHistoricalCountsCollection(), {
    ...count,
    importedAt: Timestamp.now(),
  });
  return docRef.id;
}

// Users Collection
export const getUsersCollection = () => collection(requireDb(), 'users');

export async function getUser(uid: string): Promise<User | null> {
  const docRef = doc(requireDb(), 'users', uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data(),
    lastLoginAt: docSnap.data().lastLoginAt || Timestamp.now(),
    createdAt: docSnap.data().createdAt || Timestamp.now(),
  } as User;
}

export async function createOrUpdateUser(
  uid: string,
  email: string,
  displayName?: string,
  photoURL?: string
): Promise<void> {
  const userRef = doc(requireDb(), 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    // Update existing user
    await updateDoc(userRef, {
      email,
      displayName: displayName || null,
      photoURL: photoURL || null,
      lastLoginAt: Timestamp.now(),
    });
  } else {
    // Create new user
    await setDoc(userRef, {
      id: uid,
      email,
      displayName: displayName || null,
      photoURL: photoURL || null,
      lastLoginAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      isAdmin: false,
    });
  }
}

export async function getAllUsers(): Promise<User[]> {
  const snapshot = await getDocs(query(getUsersCollection(), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    lastLoginAt: doc.data().lastLoginAt || Timestamp.now(),
    createdAt: doc.data().createdAt || Timestamp.now(),
  })) as User[];
}

