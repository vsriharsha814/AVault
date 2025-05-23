from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from django.http import HttpResponse, JsonResponse
from django.db.models import Q
from django.utils import timezone
import pandas as pd
from io import BytesIO

from .models import Category, Item, AcademicTerm, HistoricalCount, InventorySession, InventoryCount
from .forms import ItemForm, InventorySessionForm
from .utils import import_excel_data, get_trend_analysis, generate_semester_comparison_report

# ... (keep all existing views as they are) ...

@login_required
def semester_history(request):
    """View historical data by academic terms"""
    terms = AcademicTerm.objects.all()
    selected_term = request.GET.get('term')
    
    context = {
        'terms': terms,
        'selected_term': selected_term
    }
    
    if selected_term:
        term_obj = get_object_or_404(AcademicTerm, id=selected_term)
        historical_counts = HistoricalCount.objects.filter(
            academic_term=term_obj
        ).select_related('item', 'item__category').order_by('item__category__name', 'item__name')
        
        # Group by category
        counts_by_category = {}
        for count in historical_counts:
            cat_name = count.item.category.name
            if cat_name not in counts_by_category:
                counts_by_category[cat_name] = []
            counts_by_category[cat_name].append(count)
        
        context.update({
            'selected_term_obj': term_obj,
            'counts_by_category': counts_by_category,
            'total_items': historical_counts.count()
        })
    
    return render(request, 'inventory/semester_history.html', context)

@login_required
def semester_comparison(request):
    """Compare inventory between two semesters"""
    terms = AcademicTerm.objects.all()
    term1_id = request.GET.get('term1')
    term2_id = request.GET.get('term2')
    
    context = {
        'terms': terms,
        'term1_id': term1_id,
        'term2_id': term2_id
    }
    
    if term1_id and term2_id:
        term1 = get_object_or_404(AcademicTerm, id=term1_id)
        term2 = get_object_or_404(AcademicTerm, id=term2_id)
        
        # Get comparison data
        comparison = generate_semester_comparison_report(term1.name, term2.name)
        
        context.update({
            'term1': term1,
            'term2': term2,
            'comparison': comparison
        })
    
    return render(request, 'inventory/semester_comparison.html', context)

@login_required
def item_trend_analysis(request, item_id):
    """Show historical trends for a specific item"""
    item = get_object_or_404(Item, id=item_id)
    
    # Get historical data
    historical_counts = item.get_count_history()
    trend_data = get_trend_analysis(item)
    
    # Prepare chart data
    chart_data = {
        'labels': [count.academic_term.name for count in historical_counts],
        'data': [count.counted_quantity for count in historical_counts]
    }
    
    context = {
        'item': item,
        'historical_counts': historical_counts,
        'trend_data': trend_data,
        'chart_data': chart_data
    }
    
    return render(request, 'inventory/item_trend.html', context)

@login_required
def enhanced_reports(request):
    """Enhanced reports with semester analysis"""
    # Get the latest completed session
    current_session = InventorySession.objects.filter(is_complete=True).first()
    
    # Get latest two academic terms for comparison
    latest_terms = AcademicTerm.objects.all()[:2]
    
    context = {
        'current_session': current_session,
        'latest_terms': latest_terms,
        'total_items': Item.objects.count(),
        'total_terms': AcademicTerm.objects.count()
    }
    
    if current_session and len(latest_terms) >= 2:
        # Generate semester comparison
        comparison = generate_semester_comparison_report(
            latest_terms[1].name,  # Previous term
            latest_terms[0].name   # Latest term
        )
        context['semester_comparison'] = comparison
    
    # Get items with trends (increasing/decreasing over time)
    trending_items = []
    for item in Item.objects.select_related('category').all():
        trend_data = get_trend_analysis(item, num_terms=3)
        if trend_data and trend_data['trend'] != 'stable':
            trending_items.append({
                'item': item,
                'trend': trend_data
            })
    
    context['trending_items'] = trending_items[:10]  # Top 10 trending items
    
    # Get items with no recent activity
    if latest_terms:
        latest_term = latest_terms[0]
        items_no_recent_activity = Item.objects.exclude(
            historical_counts__academic_term=latest_term
        ).select_related('category')[:10]
        
        context['items_no_recent_activity'] = items_no_recent_activity
    
    return render(request, 'inventory/enhanced_reports.html', context)

@user_passes_test(lambda u: u.is_staff)
def enhanced_import_excel(request):
    """Enhanced Excel import with semester support"""
    if request.method == 'POST' and request.FILES.get('excel_file'):
        try:
            excel_file = request.FILES['excel_file']
            result = import_excel_data(excel_file)
            
            # Create success message with details
            success_msg = f"""
            Successfully imported:
            • {result['categories_created']} new categories
            • {result['items_created']} new items  
            • {result['terms_created']} new academic terms
            • {result['historical_counts_created']} historical counts
            • Academic terms: {', '.join(result['academic_terms'])}
            """
            
            if result['errors']:
                success_msg += f"\n• {len(result['errors'])} errors encountered"
            
            messages.success(request, success_msg)
            
            if result['errors']:
                for error in result['errors'][:5]:  # Show first 5 errors
                    messages.warning(request, f"Import warning: {error}")
            
            return redirect('inventory:semester_history')
            
        except Exception as e:
            messages.error(request, f'Import failed: {str(e)}')
    
    return render(request, 'inventory/enhanced_import.html')

@login_required
def export_semester_data(request):
    """Export data with full semester history"""
    # Get all terms and items
    terms = AcademicTerm.objects.all().order_by('year', 'term')
    items = Item.objects.select_related('category').all()
    
    # Create Excel file
    output = BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Historical Data Sheet (recreating original Excel format)
        historical_data = []
        
        # Create column headers
        columns = ['Item'] + [term.name for term in terms] + ['LOCATION', 'CONDITION', 'S/N - FREQUENCY']
        
        # Group items by category
        for category in Category.objects.all():
            # Add category header row
            row_data = {'Item': category.name}
            for col in columns[1:]:
                row_data[col] = ''
            historical_data.append(row_data)
            
            # Add items in this category
            category_items = items.filter(category=category)
            for item in category_items:
                row_data = {
                    'Item': item.name,
                    'LOCATION': item.location or '',
                    'CONDITION': item.condition or '',
                    'S/N - FREQUENCY': item.serial_frequency or ''
                }
                
                # Add historical counts for each term
                for term in terms:
                    count = item.get_count_for_term(term)
                    row_data[term.name] = count if count > 0 else ''
                
                historical_data.append(row_data)
            
            # Add empty row after each category
            empty_row = {col: '' for col in columns}
            historical_data.append(empty_row)
        
        # Create DataFrame and export
        if historical_data:
            df_historical = pd.DataFrame(historical_data)
            df_historical = df_historical.reindex(columns=columns)
            df_historical.to_excel(writer, sheet_name='Historical Inventory', index=False)
        
        # Trends Analysis Sheet
        trends_data = []
        for item in items:
            trend_data = get_trend_analysis(item)
            if trend_data:
                trends_data.append({
                    'Category': item.category.name,
                    'Item': item.name,
                    'Current Count': trend_data['latest_count'],
                    'Previous Count': trend_data['previous_count'],
                    'Trend': trend_data['trend'],
                    'Change': trend_data['change'],
                    'Location': item.location or ''
                })
        
        if trends_data:
            df_trends = pd.DataFrame(trends_data)
            df_trends.to_excel(writer, sheet_name='Trends Analysis', index=False)
        
        # Semester Summary Sheet
        summary_data = []
        for term in terms:
            counts = HistoricalCount.objects.filter(academic_term=term)
            total_items = counts.count()
            total_quantity = sum(count.counted_quantity for count in counts)
            
            summary_data.append({
                'Academic Term': term.name,
                'Year': term.year,
                'Season': term.term,
                'Total Items': total_items,
                'Total Quantity': total_quantity,
                'Average per Item': round(total_quantity / total_items, 2) if total_items > 0 else 0
            })
        
        if summary_data:
            df_summary = pd.DataFrame(summary_data)
            df_summary.to_excel(writer, sheet_name='Semester Summary', index=False)
    
    output.seek(0)
    
    response = HttpResponse(
        output.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="avault_full_history_{timezone.now().strftime("%Y%m%d_%H%M")}.xlsx"'
    
    return response

# Add to URL patterns
@login_required
def ajax_get_term_data(request):
    """AJAX endpoint to get data for a specific term"""
    term_id = request.GET.get('term_id')
    if not term_id:
        return JsonResponse({'error': 'Term ID required'})
    
    try:
        term = AcademicTerm.objects.get(id=term_id)
        counts = HistoricalCount.objects.filter(academic_term=term).select_related(
            'item', 'item__category'
        )
        
        data = []
        for count in counts:
            data.append({
                'item_id': count.item.id,
                'item_name': count.item.name,
                'category': count.item.category.name,
                'count': count.counted_quantity,
                'location': count.item.location or '',
                'condition': count.item.condition or ''
            })
        
        return JsonResponse({
            'term': term.name,
            'data': data,
            'total_items': len(data),
            'total_quantity': sum(item['count'] for item in data)
        })
        
    except AcademicTerm.DoesNotExist:
        return JsonResponse({'error': 'Term not found'})
    except Exception as e:
        return JsonResponse({'error': str(e)})