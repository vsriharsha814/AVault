Sample Excel Import Format for AVault
========================================

Your Excel file should have the following structure:

Column Headers:
- Item (required)
- LOCATION  
- CONDITION
- S/N - FREQUENCY  
- [Semester columns like "Summer 2024", "Fall 2024", etc.]

Sample Data:
+----------------------+-------------+-----------+---------------+-------------+
| Item                 | LOCATION    | CONDITION | S/N-FREQUENCY | Summer 2024 |
+----------------------+-------------+-----------+---------------+-------------+
| WIRED MICS           |             |           |               |             |  ← Category header
| Shure SM-57          | GMB Closet  | Good      | SN123456      | 4           |  ← Item row
| Shure SM-58          | GMB Closet  | Fair      | SN789012      | 2           |  ← Item row
|                      |             |           |               |             |
| WIRELESS MICS        |             |           |               |             |  ← Category header  
| Shure GLXD24         | AV Cart     | Good      | 2.4GHz Ch1    | 1           |  ← Item row
| Sennheiser EW        | Storage     | Good      | 516-558MHz    | 2           |  ← Item row
|                      |             |           |               |             |
| CABLES               |             |           |               |             |  ← Category header
| XLR Male to Female   | Cable Box   | Good      | 25ft          | 10          |  ← Item row
+----------------------+-------------+-----------+---------------+-------------+

Rules:
1. Category headers have no count data (empty cells in semester columns)
2. Item rows have numeric count data in semester columns
3. The rightmost semester column with data will be used as the latest count
4. Location, Condition, and S/N-Frequency are optional but recommended
5. Use consistent naming for categories (e.g., "WIRED MICS", not "wired mics")

Example file saved as "av_inventory.xlsx" can be imported through:
Admin Panel → Import → Upload Excel File