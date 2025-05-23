import pandas as pd
from django.utils import timezone
from .models import Category, Item, InventorySession, InventoryCount

def import_excel_data(excel_file):
    """
    Import data from the Excel file maintaining the exact structure
    """
    # Read the Excel file
    df = pd.read_excel(excel_file, sheet_name=0)
    
    # Initialize counters
    categories_created = 0
    items_created = 0
    counts_created = 0
    
    # Create a session for the import (use the latest semester column)
    semester_columns = [col for col in df.columns if col not in ['Item', 'LOCATION', 'CONDITION', 'S/N - FREQUENCY']]
    latest_semester = semester_columns[-1] if semester_columns else 'Import Session'
    
    session, created = InventorySession.objects.get_or_create(
        name=latest_semester,
        defaults={
            'date': timezone.now().date(),
            'is_complete': True
        }
    )
    
    current_category = None
    
    # Process each row
    for index, row in df.iterrows():
        item_name = str(row['Item']).strip() if pd.notna(row['Item']) else ''
        
        if not item_name:
            continue
            
        # Check if this is a category header (no count data in semester columns)
        has_count_data = any(pd.notna(row.get(col)) and isinstance(row.get(col), (int, float)) 
                           for col in semester_columns)
        
        if not has_count_data and len(item_name) > 3:
            # This is a category header
            category, created = Category.objects.get_or_create(name=item_name)
            current_category = category
            if created:
                categories_created += 1
        
        elif has_count_data and current_category:
            # This is an item with inventory data
            location = str(row.get('LOCATION', '')).strip() if pd.notna(row.get('LOCATION')) else ''
            condition = str(row.get('CONDITION', '')).strip() if pd.notna(row.get('CONDITION')) else ''
            serial_freq = str(row.get('S/N - FREQUENCY', '')).strip() if pd.notna(row.get('S/N - FREQUENCY')) else ''
            
            # Get the latest count (most recent semester with data)
            latest_count = 0
            for col in reversed(semester_columns):
                if pd.notna(row.get(col)) and isinstance(row.get(col), (int, float)):
                    latest_count = int(row.get(col))
                    break
            
            # Create or update the item
            item, created = Item.objects.get_or_create(
                name=item_name,
                category=current_category,
                defaults={
                    'location': location,
                    'condition': condition,
                    'serial_frequency': serial_freq,
                    'expected_quantity': latest_count
                }
            )
            
            if created:
                items_created += 1
            else:
                # Update existing item
                item.location = location
                item.condition = condition
                item.serial_frequency = serial_freq
                item.expected_quantity = latest_count
                item.save()
            
            # Create inventory count for the latest session
            count, count_created = InventoryCount.objects.get_or_create(
                item=item,
                session=session,
                defaults={'counted_quantity': latest_count}
            )
            
            if count_created:
                counts_created += 1
    
    return {
        'categories': categories_created,
        'items': items_created,
        'counts': counts_created,
        'session': session.name
    }