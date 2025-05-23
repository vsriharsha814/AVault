# AV Inventory Management App – Build Plan

## 1. Overview  
- Import existing Excel inventory as seed data  
- Provide a web dashboard for the AV team to:  
  - Add new stock items  
  - Conduct one-time-per-semester inventory counts  
  - Generate “new item” and “shortage” reports  

## 2. Tech Stack  
- **Backend:** Django (Python) with built-in ORM & auth  
- **Frontend:** Server-rendered Django templates + Bootstrap  
- **Database:** PostgreSQL (or MySQL; SQLite for prototyping)  
- **Excel Parsing:** Pandas + openpyxl in Django management command or admin view  

## 3. Data Model  
1. **Category** (e.g. “Wired Mics”, “Cables”)  
2. **Location** (e.g. “GMB AV Closet”)  
3. **Item**  
   - Name/Model, Category FK, Location FK  
   - Expected quantity, condition, details, date added  
4. **InventorySession** (e.g. “Spring 2025”)  
5. **InventoryCount** (Item FK, Session FK, counted quantity)  

## 4. Core Features & Pages  
1. **Dashboard**  
   - Table of all items with search/filter by category/location  
   - Inline or modal “Edit” for item details  
2. **Add New Item**  
   - Form to capture model, category, location, initial quantity, etc.  
3. **Excel Import**  
   - Admin-only upload page to parse spreadsheet and seed DB  
   - Create Categories, Locations, Items, and latest InventoryCount  
4. **Inventory Count**  
   - Create a new session (semester)  
   - List all items grouped by category with input fields for counted quantities  
   - Save counts to InventoryCount records  
5. **Reports**  
   - **New Items:** items added since last session  
   - **Shortages:** items where counted < expected  
   - (Optional: surplus/overage flag)  
6. **Authentication**  
   - Login page for AV team members  
   - Admin role for imports and user management  

## 5. Excel Import Workflow  
- Upload Excel file → read into Pandas DataFrame  
- Iterate rows:  
  - Detect category headers → create Category entries  
  - Parse item rows → create Item and Location entries  
  - Extract “most recent” semester column → create InventorySession and InventoryCount  
- Set each Item’s expected quantity to its latest count  

## 6. Semester Tracking & Reporting  
- **Periodic counts** stored in InventoryCount table  
- Compare current vs. previous session to:  
  - Identify **new items** (no prior count or added date > last session)  
  - Flag **shortages** (current count < previous count)  
- Display results on Reports page (with option to export)  

## 7. Security & Deployment  
- Restrict all pages behind Django’s auth (no public access)  
- Admin creates user accounts for AV team  
- Host on internal network or HTTPS-enabled server  
- Regular database backups (e.g. export to CSV/Excel)  

## 8. Next Steps  
1. Scaffold Django project & define models  
2. Build import feature & seed with existing spreadsheet  
3. Create forms/pages for add, edit, count, and reports  
4. Implement authentication and deploy to a staging server  
5. Test end-to-end: import → add item → count → report  
6. Iterate on UI/UX based on AV team feedback  