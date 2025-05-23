# inventory/utils.py
import pandas as pd
from django.utils import timezone
from django.db import models
from .models import Category, Item, AcademicTerm, HistoricalCount, InventorySession, InventoryCount
import logging

logger = logging.getLogger(__name__)

def import_excel_data(excel_file):
    """
    Import data from Excel file with full semester history support
    """
    try:
        # Read the Excel file
        df = pd.read_excel(excel_file, sheet_name=0)
        
        # Initialize counters
        results = {
            'categories_created': 0,
            'categories_updated': 0,
            'items_created': 0,
            'items_updated': 0,
            'terms_created': 0,
            'historical_counts_created': 0,
            'historical_counts_updated': 0,
            'errors': []
        }
        
        # Identify semester columns (exclude metadata columns)
        metadata_columns = {'Item', 'LOCATION', 'CONDITION', 'S/N - FREQUENCY'}
        semester_columns = [col for col in df.columns if col not in metadata_columns]
        
        logger.info(f"Found semester columns: {semester_columns}")
        
        # Create AcademicTerm objects for each semester column
        academic_terms = {}
        for col in semester_columns:
            term = AcademicTerm.get_or_create_from_excel_header(col)
            if term:
                academic_terms[col] = term
                if hasattr(term, '_state') and term._state.adding:
                    results['terms_created'] += 1
                logger.info(f"Created/found academic term: {term.name}")
            else:
                logger.warning(f"Could not parse semester column: {col}")
        
        current_category = None
        
        # Process each row
        for index, row in df.iterrows():
            try:
                item_name = str(row['Item']).strip() if pd.notna(row['Item']) else ''
                
                if not item_name:
                    continue
                
                # Check if this row has count data in any semester column
                has_count_data = any(
                    pd.notna(row.get(col)) and 
                    str(row.get(col)).strip() not in ['', 'n/a', 'N/A'] and
                    (isinstance(row.get(col), (int, float)) or str(row.get(col)).isdigit())
                    for col in semester_columns
                )
                
                if not has_count_data and len(item_name) > 2:
                    # This is likely a category header
                    category, created = Category.objects.get_or_create(
                        name=item_name.upper()
                    )
                    current_category = category
                    
                    if created:
                        results['categories_created'] += 1
                        logger.info(f"Created category: {category.name}")
                    else:
                        results['categories_updated'] += 1
                        logger.info(f"Found existing category: {category.name}")
                
                elif has_count_data and current_category:
                    # This is an item with inventory data
                    location = str(row.get('LOCATION', '')).strip() if pd.notna(row.get('LOCATION')) else ''
                    condition = str(row.get('CONDITION', '')).strip() if pd.notna(row.get('CONDITION')) else ''
                    serial_freq = str(row.get('S/N - FREQUENCY', '')).strip() if pd.notna(row.get('S/N - FREQUENCY')) else ''
                    
                    # Create or update the item
                    item, item_created = Item.objects.get_or_create(
                        name=item_name,
                        category=current_category,
                        defaults={
                            'location': location,
                            'condition': condition,
                            'serial_frequency': serial_freq,
                        }
                    )
                    
                    if item_created:
                        results['items_created'] += 1
                        logger.info(f"Created item: {item.name}")
                    else:
                        # Update existing item metadata
                        item.location = location
                        item.condition = condition
                        item.serial_frequency = serial_freq
                        item.save()
                        results['items_updated'] += 1
                        logger.info(f"Updated item: {item.name}")
                    
                    # Process historical counts for each semester
                    for col in semester_columns:
                        if col in academic_terms and pd.notna(row.get(col)):
                            count_value = row.get(col)
                            
                            # Handle various count formats
                            if isinstance(count_value, str):
                                count_value = count_value.strip()
                                if count_value.lower() in ['n/a', 'na', '']:
                                    continue
                                try:
                                    count_value = int(float(count_value))
                                except ValueError:
                                    logger.warning(f"Could not parse count '{count_value}' for {item.name} in {col}")
                                    continue
                            elif isinstance(count_value, float):
                                count_value = int(count_value)
                            
                            if count_value >= 0:  # Allow zero counts
                                academic_term = academic_terms[col]
                                historical_count, count_created = HistoricalCount.objects.get_or_create(
                                    item=item,
                                    academic_term=academic_term,
                                    defaults={'counted_quantity': count_value}
                                )
                                
                                if count_created:
                                    results['historical_counts_created'] += 1
                                    logger.debug(f"Created historical count: {item.name} - {academic_term.name}: {count_value}")
                                else:
                                    # Update existing count if different
                                    if historical_count.counted_quantity != count_value:
                                        historical_count.counted_quantity = count_value
                                        historical_count.save()
                                        results['historical_counts_updated'] += 1
                                        logger.debug(f"Updated historical count: {item.name} - {academic_term.name}: {count_value}")
                
            except Exception as e:
                error_msg = f"Error processing row {index}: {str(e)}"
                results['errors'].append(error_msg)
                logger.error(error_msg)
                continue
        
        # Create a summary session for the import
        latest_term = max(academic_terms.values(), key=lambda t: (t.year, t.term)) if academic_terms else None
        session_name = f"Import - {timezone.now().strftime('%Y-%m-%d %H:%M')}"
        
        session = InventorySession.objects.create(
            name=session_name,
            academic_term=latest_term,
            date=timezone.now().date(),
            is_complete=True,
            notes=f"Imported from Excel file with {len(semester_columns)} semester columns"
        )
        
        # Create inventory counts for the latest semester (for current session compatibility)
        if latest_term:
            latest_col = None
            for col, term in academic_terms.items():
                if term == latest_term:
                    latest_col = col
                    break
            
            if latest_col:
                for item in Item.objects.all():
                    historical_count = HistoricalCount.objects.filter(
                        item=item, 
                        academic_term=latest_term
                    ).first()
                    
                    if historical_count:
                        InventoryCount.objects.get_or_create(
                            item=item,
                            session=session,
                            defaults={
                                'counted_quantity': historical_count.counted_quantity})
        
        results['session_name'] = session.name
        results['academic_terms'] = list(academic_terms.keys())
        
        return results
        
    except Exception as e:
        logger.error(f"Excel import failed: {str(e)}")
        raise Exception(f"Import failed: {str(e)}")

def get_trend_analysis(item, num_terms=5):
    """
    Analyze trends for an item across recent academic terms
    """
    recent_counts = item.get_count_history()[:num_terms]
    
    if len(recent_counts) < 2:
        return None
    
    counts = [count.counted_quantity for count in recent_counts]
    terms = [count.academic_term.name for count in recent_counts]
    
    # Calculate simple trend
    if len(counts) > 1:
        trend = "increasing" if counts[-1] > counts[0] else "decreasing" if counts[-1] < counts[0] else "stable"
        change = counts[-1] - counts[0]
    else:
        trend = "stable"
        change = 0
    
    return {
        'terms': terms,
        'counts': counts,
        'trend': trend,
        'change': change,
        'latest_count': counts[-1] if counts else 0,
        'previous_count': counts[-2] if len(counts) > 1 else 0
    }

def generate_semester_comparison_report(term1, term2):
    """
    Generate a comparison report between two academic terms
    """
    term1_obj = AcademicTerm.objects.filter(name=term1).first()
    term2_obj = AcademicTerm.objects.filter(name=term2).first()
    
    if not term1_obj or not term2_obj:
        return None
    
    report = {
        'term1': term1_obj.name,
        'term2': term2_obj.name,
        'items_added': [],
        'items_removed': [],
        'items_increased': [],
        'items_decreased': [],
        'items_stable': []
    }
    
    # Get all items that have counts in either term
    all_items = Item.objects.filter(
        models.Q(historical_counts__academic_term=term1_obj) |
        models.Q(historical_counts__academic_term=term2_obj)
    ).distinct()
    
    for item in all_items:
        count1 = item.get_count_for_term(term1_obj)
        count2 = item.get_count_for_term(term2_obj)
        
        if count1 == 0 and count2 > 0:
            report['items_added'].append({
                'item': item,
                'count': count2
            })
        elif count1 > 0 and count2 == 0:
            report['items_removed'].append({
                'item': item,
                'previous_count': count1
            })
        elif count2 > count1:
            report['items_increased'].append({
                'item': item,
                'previous_count': count1,
                'current_count': count2,
                'increase': count2 - count1
            })
        elif count2 < count1:
            report['items_decreased'].append({
                'item': item,
                'previous_count': count1,
                'current_count': count2,
                'decrease': count1 - count2
            })
        else:
            report['items_stable'].append({
                'item': item,
                'count': count1
            })
    
    return report