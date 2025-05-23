from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from django.http import HttpResponse, JsonResponse
from django.db.models import Q
from django.utils import timezone
import pandas as pd
from io import BytesIO
import json

from .models import Category, Item, AcademicTerm, HistoricalCount, InventorySession, InventoryCount
from .forms import ItemForm, InventorySessionForm
from .utils import import_excel_data, get_trend_analysis, generate_semester_comparison_report
from datetime import datetime
import re

def get_current_academic_term():
    """
    Automatically determine current academic term based on current date
    """
    now = timezone.now()
    month = now.month
    year = now.year
    
    # Determine semester based on month
    if month >= 1 and month <= 5:  # January to May
        term = 'SPRING'
    elif month >= 6 and month <= 8:  # June to August  
        term = 'SUMMER'
    elif month >= 9 and month <= 12:  # September to December
        term = 'FALL'
    
    # Create term name
    term_name = f"{term} {year}"
    
    # Get or create the academic term
    academic_term, created = AcademicTerm.objects.get_or_create(
        name=term_name,
        defaults={
            'term': term,
            'year': year
        }
    )
    
    return academic_term

def get_or_create_semester_session(academic_term):
    """
    Get existing session for academic term or create a new one
    """
    # Check if there's already a session for this term
    existing_session = InventorySession.objects.filter(
        academic_term=academic_term,
        name__icontains=academic_term.name
    ).first()
    
    if existing_session:
        return existing_session, False
    
    # Create new session for this semester
    session_name = f"{academic_term.name} Inventory"
    session = InventorySession.objects.create(
        name=session_name,
        academic_term=academic_term,
        date=timezone.now().date(),
        notes=f"Automatic session for {academic_term.name}"
    )
    
    return session, True

@login_required
def enhanced_dashboard(request):
    """Enhanced dashboard with automatic session management"""
    # Get or create current academic term
    current_term = get_current_academic_term()
    
    # Get or create session for current semester
    current_session, session_created = get_or_create_semester_session(current_term)
    
    if session_created:
        messages.info(request, f'Created new inventory session for {current_term.name}')
    
    # Get search and filter parameters
    search = request.GET.get('search', '')
    category_filter = request.GET.get('category', '')
    
    # Base queryset
    items = Item.objects.select_related('category').all()
    
    # Apply filters
    if search:
        items = items.filter(
            Q(name__icontains=search) |
            Q(location__icontains=search) |
            Q(serial_frequency__icontains=search)
        )
    
    if category_filter:
        items = items.filter(category_id=category_filter)
    
    # Group items by category
    items_by_category = {}
    for item in items:
        cat_name = item.category.name
        if cat_name not in items_by_category:
            items_by_category[cat_name] = []
        items_by_category[cat_name].append(item)
    
    context = {
        'items_by_category': items_by_category,
        'categories': Category.objects.all(),
        'search': search,
        'category_filter': category_filter,
        'total_items': Item.objects.count(),
        'total_categories': Category.objects.count(),
        'latest_session': InventorySession.objects.first(),
        'current_term': current_term,
        'current_session': current_session,
        'session_created': session_created,
    }
    
    return render(request, 'inventory/enhanced_dashboard.html', context)

@login_required
def smart_create_session(request):
    """Smart session creation that links to academic terms"""
    current_term = get_current_academic_term()
    
    if request.method == 'POST':
        form = InventorySessionForm(request.POST)
        if form.is_valid():
            session = form.save(commit=False)
            session.conducted_by = request.user
            
            # Try to parse academic term from session name
            session_name = session.name.upper()
            parsed_term = None
            
            # Check if session name contains semester info
            for term_choice in ['SPRING', 'SUMMER', 'FALL', 'WINTER']:
                if term_choice in session_name:
                    # Extract year from session name
                    year_match = re.search(r'\b(20\d{2})\b', session_name)
                    if year_match:
                        year = int(year_match.group(1))
                        term_name = f"{term_choice} {year}"
                        
                        parsed_term, created = AcademicTerm.objects.get_or_create(
                            name=term_name,
                            defaults={
                                'term': term_choice,
                                'year': year
                            }
                        )
                        break
            
            # If no term parsed from name, use current term
            if not parsed_term:
                parsed_term = current_term
            
            session.academic_term = parsed_term
            session.save()
            
            messages.success(request, f'Session "{session.name}" created for {parsed_term.name}!')
            return redirect('inventory:conduct_inventory', session_id=session.id)
    else:
        # Pre-populate form with current semester
        initial_data = {
            'name': f'{current_term.name} Count',
            'date': timezone.now().date()
        }
        form = InventorySessionForm(initial=initial_data)
    
    context = {
        'form': form,
        'current_term': current_term,
        'suggested_sessions': [
            f'{current_term.name} Count',
            f'{current_term.name} Mid-Semester Check',
            f'{current_term.name} Final Inventory'
        ]
    }
    
    return render(request, 'inventory/smart_create_session.html', context)

@login_required
def semester_sessions_view(request):
    """View sessions organized by academic terms"""
    # Group sessions by academic term
    sessions_by_term = {}
    
    # Get all sessions with academic terms
    sessions = InventorySession.objects.select_related('academic_term', 'conducted_by').all()
    
    for session in sessions:
        if session.academic_term:
            term_name = session.academic_term.name
            if term_name not in sessions_by_term:
                sessions_by_term[term_name] = {
                    'term': session.academic_term,
                    'sessions': []
                }
            sessions_by_term[term_name]['sessions'].append(session)
        else:
            # Handle sessions without academic terms
            if 'Unassigned' not in sessions_by_term:
                sessions_by_term['Unassigned'] = {
                    'term': None,
                    'sessions': []
                }
            sessions_by_term['Unassigned']['sessions'].append(session)
    
    context = {
        'sessions_by_term': sessions_by_term,
        'current_term': get_current_academic_term()
    }
    
    return render(request, 'inventory/semester_sessions.html', context)

# Enhanced import function
def enhanced_import_excel_with_auto_sessions(excel_file):
    """
    Enhanced import that automatically creates sessions for each semester
    """
    # Use existing import function
    result = import_excel_data(excel_file)
    
    # Create sessions for each imported academic term
    sessions_created = []
    
    for term_name in result.get('academic_terms', []):
        try:
            academic_term = AcademicTerm.objects.get(name=term_name)
            
            # Check if session already exists for this term
            existing_session = InventorySession.objects.filter(
                academic_term=academic_term
            ).first()
            
            if not existing_session:
                # Create session for this term
                session = InventorySession.objects.create(
                    name=f"{term_name} Import Session",
                    academic_term=academic_term,
                    date=timezone.now().date(),
                    is_complete=True,  # Mark as complete since data is imported
                    notes=f"Auto-created from Excel import with historical data"
                )
                
                # Create inventory counts for this session based on historical data
                historical_counts = HistoricalCount.objects.filter(academic_term=academic_term)
                for hist_count in historical_counts:
                    InventoryCount.objects.get_or_create(
                        item=hist_count.item,
                        session=session,
                        defaults={
                            'counted_quantity': hist_count.counted_quantity,
                            'notes': f'Imported from {term_name} historical data'
                        }
                    )
                
                sessions_created.append(session.name)
                
        except AcademicTerm.DoesNotExist:
            continue
    
    result['sessions_created'] = sessions_created
    return result

@login_required
def dashboard(request):
    """Main dashboard view"""
    # Get search and filter parameters
    search = request.GET.get('search', '')
    category_filter = request.GET.get('category', '')
    
    # Base queryset
    items = Item.objects.select_related('category').all()
    
    # Apply filters
    if search:
        items = items.filter(
            Q(name__icontains=search) |
            Q(location__icontains=search) |
            Q(serial_frequency__icontains=search)
        )
    
    if category_filter:
        items = items.filter(category_id=category_filter)
    
    # Group items by category
    items_by_category = {}
    for item in items:
        cat_name = item.category.name
        if cat_name not in items_by_category:
            items_by_category[cat_name] = []
        items_by_category[cat_name].append(item)
    
    context = {
        'items_by_category': items_by_category,
        'categories': Category.objects.all(),
        'search': search,
        'category_filter': category_filter,
        'total_items': Item.objects.count(),
        'total_categories': Category.objects.count(),
        'latest_session': InventorySession.objects.first(),
    }
    
    return render(request, 'inventory/dashboard.html', context)

@login_required
def add_item(request):
    """Add new inventory item"""
    if request.method == 'POST':
        form = ItemForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, f'Item "{form.cleaned_data["name"]}" added successfully!')
            return redirect('inventory:dashboard')
    else:
        form = ItemForm()
    
    return render(request, 'inventory/add_item.html', {'form': form})

@login_required
def edit_item(request, item_id):
    """Edit existing inventory item"""
    item = get_object_or_404(Item, id=item_id)
    
    if request.method == 'POST':
        form = ItemForm(request.POST, instance=item)
        if form.is_valid():
            form.save()
            messages.success(request, f'Item "{item.name}" updated successfully!')
            return redirect('inventory:dashboard')
    else:
        form = ItemForm(instance=item)
    
    return render(request, 'inventory/edit_item.html', {'form': form, 'item': item})

@login_required
def delete_item(request, item_id):
    """Delete inventory item"""
    item = get_object_or_404(Item, id=item_id)
    
    if request.method == 'POST':
        item_name = item.name
        item.delete()
        messages.success(request, f'Item "{item_name}" deleted successfully!')
    
    return redirect('inventory:dashboard')

@login_required
def add_category_ajax(request):
    """AJAX endpoint to add new categories"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            name = data.get('name', '').strip().upper()
            
            if not name:
                return JsonResponse({'success': False, 'error': 'Category name is required'})
            
            if Category.objects.filter(name=name).exists():
                return JsonResponse({'success': False, 'error': 'Category already exists'})
            
            category = Category.objects.create(name=name)
            return JsonResponse({
                'success': True,
                'category': {
                    'id': category.id,
                    'name': category.name
                }
            })
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'})

@login_required
def inventory_sessions(request):
    """List all inventory sessions"""
    sessions = InventorySession.objects.all()
    return render(request, 'inventory/sessions.html', {'sessions': sessions})

@login_required
def create_session(request):
    """Create new inventory session"""
    if request.method == 'POST':
        form = InventorySessionForm(request.POST)
        if form.is_valid():
            session = form.save(commit=False)
            session.conducted_by = request.user
            session.save()
            messages.success(request, f'Session "{session.name}" created successfully!')
            return redirect('inventory:conduct_inventory', session_id=session.id)
    else:
        form = InventorySessionForm()
    
    return render(request, 'inventory/create_session.html', {'form': form})

@login_required
def conduct_inventory(request, session_id):
    """Conduct inventory counting session"""
    session = get_object_or_404(InventorySession, id=session_id)
    categories = Category.objects.prefetch_related('items').all()
    
    # Get existing counts for this session
    existing_counts = {}
    for count in InventoryCount.objects.filter(session=session):
        existing_counts[count.item_id] = count.counted_quantity
    
    if request.method == 'POST':
        # Process form data
        for key, value in request.POST.items():
            if key.startswith('count_'):
                item_id = int(key.replace('count_', ''))
                counted_quantity = int(value) if value.isdigit() else 0
                
                try:
                    item = Item.objects.get(id=item_id)
                    count, created = InventoryCount.objects.get_or_create(
                        item=item,
                        session=session,
                        defaults={
                            'counted_quantity': counted_quantity,
                            'counted_by': request.user
                        }
                    )
                    if not created:
                        count.counted_quantity = counted_quantity
                        count.counted_by = request.user
                        count.save()
                except Item.DoesNotExist:
                    continue
        
        # Check if marking as complete
        if 'mark_complete' in request.POST:
            session.is_complete = True
            session.save()
            messages.success(request, f'Session "{session.name}" marked as complete!')
            return redirect('inventory:inventory_sessions')
        else:
            messages.success(request, 'Counts saved successfully!')
            return redirect('inventory:conduct_inventory', session_id=session.id)
    
    context = {
        'session': session,
        'categories': categories,
        'existing_counts': existing_counts
    }
    
    return render(request, 'inventory/conduct_inventory.html', context)

@login_required
def reports(request):
    """Generate inventory reports"""
    # Get the latest completed session
    current_session = InventorySession.objects.filter(is_complete=True).first()
    previous_session = InventorySession.objects.filter(is_complete=True).exclude(id=current_session.id).first() if current_session else None
    
    context = {
        'current_session': current_session,
        'previous_session': previous_session,
        'total_items': Item.objects.count(),
        'shortages': [],
        'new_items': []
    }
    
    if current_session:
        # Calculate shortages
        shortages = []
        for count in current_session.counts.select_related('item'):
            expected = count.item.get_expected_quantity()
            if count.counted_quantity < expected:
                shortages.append({
                    'item': count.item,
                    'expected': expected,
                    'current_count': count.counted_quantity,
                    'shortage': expected - count.counted_quantity
                })
        context['shortages'] = shortages
        
        # Calculate new items
        if previous_session:
            previous_item_ids = set(previous_session.counts.values_list('item_id', flat=True))
            current_item_ids = set(current_session.counts.values_list('item_id', flat=True))
            new_item_ids = current_item_ids - previous_item_ids
            
            new_items = []
            for count in current_session.counts.filter(item_id__in=new_item_ids):
                new_items.append({
                    'item': count.item,
                    'count': count.counted_quantity
                })
            context['new_items'] = new_items
    
    return render(request, 'inventory/reports.html', context)

@login_required
def export_reports(request):
    """Export current reports to Excel"""
    current_session = InventorySession.objects.filter(is_complete=True).first()
    
    if not current_session:
        messages.error(request, 'No completed sessions found to export.')
        return redirect('inventory:reports')
    
    # Create Excel file
    output = BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Current inventory sheet
        current_data = []
        for count in current_session.counts.select_related('item', 'item__category'):
            current_data.append({
                'Category': count.item.category.name,
                'Item': count.item.name,
                'Location': count.item.location or '',
                'Current Count': count.counted_quantity,
                'Expected': count.item.get_expected_quantity(),
                'Condition': count.item.condition or '',
                'Serial/Frequency': count.item.serial_frequency or ''
            })
        
        if current_data:
            df_current = pd.DataFrame(current_data)
            df_current.to_excel(writer, sheet_name='Current Inventory', index=False)
        
        # Shortages sheet
        shortages_data = []
        for count in current_session.counts.select_related('item'):
            expected = count.item.get_expected_quantity()
            if count.counted_quantity < expected:
                shortages_data.append({
                    'Category': count.item.category.name,
                    'Item': count.item.name,
                    'Expected': expected,
                    'Current': count.counted_quantity,
                    'Shortage': expected - count.counted_quantity,
                    'Location': count.item.location or ''
                })
        
        if shortages_data:
            df_shortages = pd.DataFrame(shortages_data)
            df_shortages.to_excel(writer, sheet_name='Shortages', index=False)
    
    output.seek(0)
    
    response = HttpResponse(
        output.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="inventory_report_{timezone.now().strftime("%Y%m%d_%H%M")}.xlsx"'
    
    return response

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
def quick_start_current_session(request):
    """Quick start a session for current semester"""
    current_term = get_current_academic_term()
    session, created = get_or_create_semester_session(current_term)
    
    if created:
        messages.success(request, f'Started new inventory session for {current_term.name}!')
    else:
        messages.info(request, f'Continuing existing session for {current_term.name}')
    
    return redirect('inventory:conduct_inventory', session_id=session.id)

@login_required
def item_trend_analysis(request, item_id):
    """Show historical trends for a specific item"""
    item = get_object_or_404(Item, id=item_id)
    
    # Get historical data
    historical_counts = item.get_count_history()
    trend_data = get_trend_analysis(item)
    
    # Prepare chart data
    chart_data = {
        'labels': json.dumps([count.academic_term.name for count in historical_counts]),
        'data': json.dumps([count.counted_quantity for count in historical_counts])
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
    
    return render(request, 'inventory/import_excel.html')

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
        columns = ['Item'] + [term.name for term in terms] + ['LOCATION', 'CONDITION', 'S/N-FREQUENCY']
        
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
                    'S/N-FREQUENCY': item.serial_frequency or ''
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