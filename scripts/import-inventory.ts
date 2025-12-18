/**
 * Script to import inventory data from JSON file to Firestore
 * 
 * Usage: npm run import-inventory
 */

import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('❌ Firebase project ID missing!');
  console.error('Please set NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local');
  process.exit(1);
}

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: projectId,
  });
  console.log('✅ Using service account authentication\n');
} else {
  try {
    admin.initializeApp({
      projectId: projectId,
    });
    console.log('✅ Using Application Default Credentials\n');
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed!');
    console.error('\nYou need to either:');
    console.error('1. Create a service account key and set FIREBASE_SERVICE_ACCOUNT_PATH');
    console.error('2. Run: gcloud auth application-default login');
    process.exit(1);
  }
}

const db = admin.firestore();

interface InventoryData {
  metadata: {
    title: string;
    as_of: string;
    inventory_periods: string[];
  };
  categories: Array<{
    name: string;
    items: Array<{
      name: string;
      inventory_counts: Record<string, number>;
      location?: string;
      condition?: string;
      serial_number_frequency?: string;
    }>;
  }>;
}

function parseAcademicTerm(termName: string): { term: 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER', year: number } | null {
  const upper = termName.toUpperCase().trim();
  
  const yearMatch = upper.match(/\b(20\d{2}|19\d{2})\b/);
  if (!yearMatch) return null;
  
  const year = parseInt(yearMatch[1]);
  
  let term: 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER' | null = null;
  if (upper.includes('SPRING')) term = 'SPRING';
  else if (upper.includes('SUMMER')) term = 'SUMMER';
  else if (upper.includes('FALL')) term = 'FALL';
  else if (upper.includes('WINTER')) term = 'WINTER';
  
  if (!term) return null;
  
  return { term, year };
}

function cleanCategoryName(name: string): string {
  // Replace slashes and other invalid Firestore characters
  return name.toUpperCase().replace(/\//g, '_').replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

async function importInventory() {
  console.log('📊 Starting inventory import...\n');
  
  // Read JSON file
  const jsonPath = path.join(process.cwd(), 'umc_av_inventory.json');
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ File not found: ${jsonPath}`);
    process.exit(1);
  }
  
  console.log(`📖 Reading ${jsonPath}...`);
  const data: InventoryData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  console.log(`✅ Loaded data:`);
  console.log(`   Title: ${data.metadata.title}`);
  console.log(`   As of: ${data.metadata.as_of}`);
  console.log(`   Categories: ${data.categories.length}`);
  console.log(`   Inventory Periods: ${data.metadata.inventory_periods.length}\n`);
  
  const stats = {
    categories: 0,
    items: 0,
    terms: 0,
    historicalCounts: 0,
    errors: [] as string[],
  };
  
  // Parse and import academic terms
  console.log('📅 Importing academic terms...');
  const termMap = new Map<string, string>(); // term name -> Firestore doc ID
  
  for (const termName of data.metadata.inventory_periods) {
    try {
      const parsed = parseAcademicTerm(termName);
      if (!parsed) {
        console.log(`  ⚠️  Skipping invalid term: ${termName}`);
        continue;
      }
      
      const termRef = db.collection('academicTerms').doc(termName);
      const termDoc = await termRef.get();
      
      if (!termDoc.exists) {
        await termRef.set({
          name: termName,
          term: parsed.term,
          year: parsed.year,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        stats.terms++;
        console.log(`  ✓ ${termName}`);
      } else {
        console.log(`  ⊙ ${termName} (already exists)`);
      }
      
      termMap.set(termName, termRef.id);
    } catch (error: any) {
      const errorMsg = `Error importing term ${termName}: ${error.message}`;
      console.error(`  ❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
  }
  
  // Import categories and items
  console.log('\n📁 Importing categories and items...');
  
  for (const category of data.categories) {
    try {
      const categoryCleanName = cleanCategoryName(category.name);
      const categoryRef = db.collection('categories').doc(categoryCleanName);
      const categoryDoc = await categoryRef.get();
      
      if (!categoryDoc.exists) {
        await categoryRef.set({
          name: category.name,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        stats.categories++;
        console.log(`\n📁 ${category.name} (${category.items.length} items)`);
      } else {
        console.log(`\n📁 ${category.name} (${category.items.length} items) - category exists`);
      }
      
      // Import items in this category
      for (const item of category.items) {
        try {
          const itemsRef = db.collection('items');
          const itemDoc = itemsRef.doc();
          
          await itemDoc.set({
            name: item.name,
            categoryId: categoryCleanName,
            location: item.location || null,
            condition: item.condition || null,
            serialFrequency: item.serial_number_frequency || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          stats.items++;
          console.log(`  ✓ ${item.name}`);
          
          // Import historical counts
          for (const [termName, quantity] of Object.entries(item.inventory_counts)) {
            if (quantity === null || quantity === undefined || isNaN(quantity)) continue;
            
            const termId = termMap.get(termName);
            if (!termId) {
              console.log(`    ⚠️  Term not found: ${termName}`);
              continue;
            }
            
            const countsRef = db.collection('historicalCounts');
            const countDoc = countsRef.doc();
            
            await countDoc.set({
              itemId: itemDoc.id,
              academicTermId: termId,
              countedQuantity: quantity,
              importedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            stats.historicalCounts++;
          }
        } catch (error: any) {
          const errorMsg = `Error importing item ${item.name}: ${error.message}`;
          console.error(`  ❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }
    } catch (error: any) {
      const errorMsg = `Error importing category ${category.name}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
  }
  
  console.log('\n✅ Import completed!\n');
  console.log('📊 Final Statistics:');
  console.log(`   Categories: ${stats.categories} created`);
  console.log(`   Items: ${stats.items} created`);
  console.log(`   Academic Terms: ${stats.terms} created`);
  console.log(`   Historical Counts: ${stats.historicalCounts} created`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  ${stats.errors.length} errors occurred:`);
    stats.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
    if (stats.errors.length > 10) {
      console.log(`   ... and ${stats.errors.length - 10} more errors`);
    }
  }
  
  console.log('\n✨ Done!');
}

// Run the import
importInventory()
  .then(() => {
    console.log('\n🎉 Import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });

