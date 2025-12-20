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
  writeBatch,
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
    name: name.trim(),
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateCategory(id: string, name: string): Promise<void> {
  const docRef = doc(requireDb(), 'categories', id);
  await updateDoc(docRef, {
    name: name.trim(),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  const docRef = doc(requireDb(), 'categories', id);
  await deleteDoc(docRef);
}

// Academic Terms
export const getAcademicTermsCollection = () => collection(requireDb(), 'academicTerms');

export async function getAcademicTerms(): Promise<AcademicTerm[]> {
  // Order by year only (descending) - most recent first
  // If you need to sort by both year and term, create a composite index in Firestore
  const snapshot = await getDocs(
    query(getAcademicTermsCollection(), orderBy('year', 'desc'))
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

export async function findOrCreateAcademicTermByCode(
  term: AcademicTerm['term'],
  year: number,
  name?: string
): Promise<AcademicTerm> {
  // Look for an existing term with the same term code and year
  const snapshot = await getDocs(
    query(
      getAcademicTermsCollection(),
      where('term', '==', term),
      where('year', '==', year)
    )
  );

  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: (docSnap.data() as any).createdAt || Timestamp.now(),
    } as AcademicTerm;
  }

  const termName = name ?? `${term} ${year}`;
  const id = await createAcademicTerm(termName, term, year);
  return {
    id,
    name: termName,
    term,
    year,
    createdAt: Timestamp.now(),
  };
}

// Items
export const getItemsCollection = () => collection(requireDb(), 'items');

export async function getItems(categoryId?: string): Promise<Item[]> {
  let constraints: QueryConstraint[] = [];
  
  if (categoryId) {
    // When filtering by category, don't use orderBy to avoid needing composite index
    // We'll sort in memory instead
    constraints.push(where('categoryId', '==', categoryId));
  } else {
    // Only use orderBy when not filtering (no composite index needed)
    constraints.push(orderBy('name'));
  }
  
  const snapshot = await getDocs(query(getItemsCollection(), ...constraints));
  const items = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt || Timestamp.now(),
  })) as Item[];
  
  // Sort by name in memory (works for both filtered and unfiltered queries)
  return items.sort((a, b) => a.name.localeCompare(b.name));
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

export async function updateItemsCategory(itemIds: string[], newCategoryId: string): Promise<void> {
  const db = requireDb();
  const batch = writeBatch(db);
  itemIds.forEach((itemId) => {
    const itemRef = doc(db, 'items', itemId);
    batch.update(itemRef, { categoryId: newCategoryId });
  });
  await batch.commit();
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

export async function deleteInventorySession(sessionId: string): Promise<void> {
  // Delete all historicalCounts that were created from this session
  const historicalCountsSnapshot = await getDocs(
    query(getHistoricalCountsCollection(), where('sessionId', '==', sessionId))
  );
  
  const deleteHistoricalCountsPromises = historicalCountsSnapshot.docs.map((docSnap) => {
    const docRef = doc(requireDb(), 'historicalCounts', docSnap.id);
    return deleteDoc(docRef);
  });
  
  await Promise.all(deleteHistoricalCountsPromises);
  
  // Then delete the session itself
  const sessionRef = doc(requireDb(), 'inventorySessions', sessionId);
  await deleteDoc(sessionRef);
}

// Inventory Counts - DEPRECATED: Now using historicalCounts with sessionId
// Keeping collection reference for backwards compatibility during migration
export const getInventoryCountsCollection = () => collection(requireDb(), 'inventoryCounts');

// Legacy function - now redirects to historicalCounts
// Kept for backwards compatibility
export async function createOrUpdateInventoryCount(
  itemId: string,
  sessionId: string,
  countedQuantity: number,
  countedByUid?: string
): Promise<void> {
  // Get the session to find its academicTermId
  const session = await getInventorySession(sessionId);
  if (!session || !session.academicTermId) {
    throw new Error('Session not found or has no academic term');
  }
  
  // Save to historicalCounts instead
  await createOrUpdateHistoricalCount(
    itemId,
    session.academicTermId,
    countedQuantity,
    sessionId,
    countedByUid
  );
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

export async function createOrUpdateHistoricalCount(
  itemId: string,
  academicTermId: string,
  countedQuantity: number,
  sessionId?: string,
  countedByUid?: string
): Promise<void> {
  const existingQuery = query(
    getHistoricalCountsCollection(),
    where('itemId', '==', itemId),
    where('academicTermId', '==', academicTermId)
  );
  const existing = await getDocs(existingQuery);

  if (!existing.empty) {
    const docRef = doc(requireDb(), 'historicalCounts', existing.docs[0].id);
    const updateData: any = {
      countedQuantity,
      importedAt: Timestamp.now(),
    };
    if (sessionId) {
      updateData.sessionId = sessionId;
    }
    if (countedByUid) {
      updateData.countedByUid = countedByUid;
    }
    await updateDoc(docRef, updateData);
  } else {
    const newData: any = {
      itemId,
      academicTermId,
      countedQuantity,
      importedAt: Timestamp.now(),
    };
    if (sessionId) {
      newData.sessionId = sessionId;
    }
    if (countedByUid) {
      newData.countedByUid = countedByUid;
    }
    await addDoc(getHistoricalCountsCollection(), newData);
  }
}

// Get historical counts for a specific session
export async function getHistoricalCountsBySession(sessionId: string): Promise<HistoricalCount[]> {
  const snapshot = await getDocs(
    query(getHistoricalCountsCollection(), where('sessionId', '==', sessionId))
  );
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    importedAt: doc.data().importedAt || Timestamp.now(),
  })) as HistoricalCount[];
}

// Legacy function - kept for backwards compatibility but now just calls getHistoricalCountsBySession
export async function getInventoryCounts(sessionId: string): Promise<HistoricalCount[]> {
  return getHistoricalCountsBySession(sessionId);
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
  try {
    // Only log non-sensitive info in development
    if (process.env.NODE_ENV === 'development') {
      console.log('createOrUpdateUser called for uid:', uid);
    }
    const userRef = doc(requireDb(), 'users', uid);
    
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // Update existing user (don't change isAuthorized on login)
      await updateDoc(userRef, {
        email,
        displayName: displayName || null,
        photoURL: photoURL || null,
        lastLoginAt: Timestamp.now(),
      });
    } else {
      // Create new user - not authorized by default
      const userData = {
        id: uid,
        email,
        displayName: displayName || null,
        photoURL: photoURL || null,
        lastLoginAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        isAdmin: false,
        isAuthorized: false, // New users need to be authorized by admin
      };
      await setDoc(userRef, userData);
    }
  } catch (error: any) {
    // Log error without sensitive details
    console.error('Error in createOrUpdateUser:', {
      code: error.code,
      message: error.message,
    });
    throw error; // Re-throw to be caught by caller
  }
}

export async function authorizeUser(uid: string): Promise<void> {
  const userRef = doc(requireDb(), 'users', uid);
  await updateDoc(userRef, {
    isAuthorized: true,
  });
}

export async function revokeUserAccess(uid: string): Promise<void> {
  const userRef = doc(requireDb(), 'users', uid);
  await updateDoc(userRef, {
    isAuthorized: false,
  });
}

export async function deleteUser(uid: string): Promise<void> {
  const userRef = doc(requireDb(), 'users', uid);
  await deleteDoc(userRef);
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

