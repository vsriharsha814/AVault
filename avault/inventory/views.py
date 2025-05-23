# inventory/views.py
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from django.http import HttpResponse
from django.db.models import Q
from django.utils import timezone
import pandas as pd
from io import BytesIO

from .models import Category, Item, InventorySession, InventoryCount
from .forms import ItemForm, InventorySessionForm
from .utils import import_excel_data

import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods



@login_required
def dashboard(request):
    """Main dashboard showing inventory overview"""
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
    
    # Get categories for filter dropdown
    categories = Category.objects.all()
    
    # Get latest session info
    latest_session = InventorySession.objects.first()
    
    # Group items by category for display
    items_by_category = {}
    for item in items:
        cat_name = item.category.name
        if cat_name not in items_by_category:
            items_by_category[cat_name] = []
        items_by_category[cat_name].append(item)
    
    context = {
        'items_by_category': items_by_category,
        'categories': categories,
        'search': search,
        'category_filter': category_filter,
        'latest_session': latest_session,
        'total_items': Item.objects.count(),
        'total_categories': Category.objects.count(),
    }
    
    return render(request, 'inventory/dashboard.html', context)

@login_required
def add_item(request):
    """Add a new inventory item"""
    if request.method == 'POST':
        form = ItemForm(request.POST)
        if form.is_valid():
            item = form.save()
            messages.success(request, f'Item "{item.name}" added successfully!')
            return redirect('inventory:dashboard')
    else:
        form = ItemForm()
    
    return render(request, 'inventory/add_item.html', {'form': form})

@login_required
def edit_item(request, item_id):
    """Edit an existing inventory item"""
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
def inventory_sessions(request):
    """List all inventory sessions"""
    sessions = InventorySession.objects.all()
    return render(request, 'inventory/sessions.html', {'sessions': sessions})

@login_required
def create_session(request):
    """Create a new inventory session"""
    if request.method == 'POST':
        form = InventorySessionForm(request.POST)
        if form.is_valid():
            session = form.save(commit=False)
            session.conducted_by = request.user
            session.save()
            messages.success(request, f'Session "{session.name}" created!')
            return redirect('inventory:conduct_inventory', session_id=session.id)
    else:
        form = InventorySessionForm()
    
    return render(request, 'inventory/create_session.html', {'form': form})

@login_required
def conduct_inventory(request, session_id):
    """Conduct inventory counting for a session"""
    session = get_object_or_404(InventorySession, id=session_id)
    
    # Group items by category
    categories = Category.objects.prefetch_related('items').all()
    
    # Get existing counts for this session
    existing_counts = {
        count.item_id: count.counted_quantity 
        for count in InventoryCount.objects.filter(session=session)
    }
    
    if request.method == 'POST':
        # Process the count form
        counts_saved = 0
        for key, value in request.POST.items():
            if key.startswith('count_'):
                item_id = int(key.split('_')[1])
                try:
                    quantity = int(value) if value else 0
                    count, created = InventoryCount.objects.update_or_create(
                        item_id=item_id,
                        session=session,
                        defaults={
                            'counted_quantity': quantity,
                            'counted_by': request.user
                        }
                    )
                    counts_saved += 1
                except (ValueError, Item.DoesNotExist):
                    continue
        
        messages.success(request, f'Saved {counts_saved} inventory counts!')
        
        # Mark session as complete if requested
        if 'mark_complete' in request.POST:
            session.is_complete = True
            session.save()
            messages.success(request, f'Session "{session.name}" marked as complete!')
            return redirect('inventory:inventory_sessions')
    
    context = {
        'session': session,
        'categories': categories,
        'existing_counts': existing_counts,
    }
    
    return render(request, 'inventory/conduct_inventory.html', context)

@login_required
def reports(request):
    """Generate reports"""
    # Get the latest two sessions for comparison
    sessions = InventorySession.objects.filter(is_complete=True)[:2]
    
    if len(sessions) < 1:
        messages.warning(request, 'Need at least 1 completed session to generate reports.')
        return render(request, 'inventory/reports.html', {'sessions': sessions})
    
    current_session = sessions[0]
    previous_session = sessions[1] if len(sessions) > 1 else None
    
    # Get shortages and new items
    shortages = []
    new_items = []
    
    current_counts = {
        c.item_id: c.counted_quantity 
        for c in InventoryCount.objects.filter(session=current_session)
    }
    
    previous_counts = {}
    if previous_session:
        previous_counts = {
            c.item_id: c.counted_quantity 
            for c in InventoryCount.objects.filter(session=previous_session)
        }
    
    # Find shortages and new items
    for item in Item.objects.select_related('category').all():
        current_count = current_counts.get(item.id, 0)
        previous_count = previous_counts.get(item.id, 0) if previous_session else 0
        
        # Shortage if current count is less than expected
        if current_count < item.expected_quantity:
            shortages.append({
                'item': item,
                'current_count': current_count,
                'expected': item.expected_quantity,
                'shortage': item.expected_quantity - current_count
            })
        
        # New item if it wasn't in previous session (or no previous session)
        if not previous_session or (item.id not in previous_counts and current_count > 0):
            new_items.append({
                'item': item,
                'count': current_count
            })
    
    context = {
        'current_session': current_session,
        'previous_session': previous_session,
        'shortages': shortages,
        'new_items': new_items,
        'sessions': sessions,
    }
    
    return render(request, 'inventory/reports.html', context)

@user_passes_test(lambda u: u.is_staff)
def import_excel(request):
    """Import data from Excel file (admin only)"""
    if request.method == 'POST' and request.FILES.get('excel_file'):
        try:
            excel_file = request.FILES['excel_file']
            result = import_excel_data(excel_file)
            messages.success(request, f'Successfully imported: {result["categories"]} categories, {result["items"]} items, {result["counts"]} counts')
            return redirect('inventory:dashboard')
        except Exception as e:
            messages.error(request, f'Import failed: {str(e)}')
    
    return render(request, 'inventory/import_excel.html')

@login_required
def export_reports(request):
    """Export reports to Excel"""
    # Create Excel file with multiple sheets
    output = BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # All items sheet
        items_data = []
        for item in Item.objects.select_related('category').all():
            items_data.append({
                'Category': item.category.name,
                'Item': item.name,
                'Location': item.location,
                'Condition': item.condition,
                'Serial/Frequency': item.serial_frequency,
                'Expected Quantity': item.expected_quantity,
                'Latest Count': item.get_latest_count(),
            })
        
        if items_data:
            df_items = pd.DataFrame(items_data)
            df_items.to_excel(writer, sheet_name='All Items', index=False)
        
        # Shortages sheet
        shortages_data = []
        for item in Item.objects.select_related('category').all():
            if item.has_shortage():
                shortages_data.append({
                    'Category': item.category.name,
                    'Item': item.name,
                    'Location': item.location,
                    'Expected': item.expected_quantity,
                    'Current Count': item.get_latest_count(),
                    'Shortage': item.expected_quantity - item.get_latest_count(),
                })
        
        if shortages_data:
            df_shortages = pd.DataFrame(shortages_data)
            df_shortages.to_excel(writer, sheet_name='Shortages', index=False)
    
    output.seek(0)
    
    response = HttpResponse(
        output.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="avault_report_{timezone.now().strftime("%Y%m%d")}.xlsx"'
    
    return response

@login_required
def delete_item(request, item_id):
    """Delete an inventory item"""
    item = get_object_or_404(Item, id=item_id)
    
    if request.method == 'POST':
        item_name = item.name
        item.delete()
        messages.success(request, f'Item "{item_name}" has been deleted.')
        return redirect('inventory:dashboard')
    
    # If not POST, redirect to edit page (shouldn't happen with proper form)
    return redirect('inventory:edit_item', item_id=item_id)

@login_required
def reports(request):
    """Generate reports with proper context"""
    # Get the latest two sessions for comparison
    sessions = list(InventorySession.objects.filter(is_complete=True).order_by('-date')[:2])
    
    if len(sessions) < 1:
        context = {
            'current_session': None,
            'previous_session': None,
            'shortages': [],
            'new_items': [],
            'total_items': Item.objects.count(),
        }
        return render(request, 'inventory/reports.html', context)
    
    current_session = sessions[0]
    previous_session = sessions[1] if len(sessions) > 1 else None
    
    # Get all items with their current counts
    all_items = Item.objects.select_related('category').all()
    
    # Get counts for current session
    current_counts = {
        c.item_id: c.counted_quantity 
        for c in InventoryCount.objects.filter(session=current_session)
    }
    
    # Get counts for previous session if it exists
    previous_counts = {}
    if previous_session:
        previous_counts = {
            c.item_id: c.counted_quantity 
            for c in InventoryCount.objects.filter(session=previous_session)
        }
    
    # Calculate shortages and new items
    shortages = []
    new_items = []
    
    for item in all_items:
        current_count = current_counts.get(item.id, 0)
        previous_count = previous_counts.get(item.id, 0) if previous_session else 0
        
        # Check for shortages (current count less than expected)
        if current_count < item.expected_quantity:
            shortages.append({
                'item': item,
                'current_count': current_count,
                'expected': item.expected_quantity,
                'shortage': item.expected_quantity - current_count
            })
        
        # Check for new items (not in previous session or added after previous session)
        if previous_session:
            # Item is new if it wasn't counted in previous session but has a current count
            if item.id not in previous_counts and current_count > 0:
                new_items.append({
                    'item': item,
                    'count': current_count
                })
            # Or if the item was created after the previous session
            elif item.created_at.date() > previous_session.date and current_count > 0:
                new_items.append({
                    'item': item,
                    'count': current_count
                })
        else:
            # If no previous session, all items with counts are "new"
            if current_count > 0:
                new_items.append({
                    'item': item,
                    'count': current_count
                })
    
    context = {
        'current_session': current_session,
        'previous_session': previous_session,
        'shortages': shortages,
        'new_items': new_items,
        'total_items': all_items.count(),
    }
    
    return render(request, 'inventory/reports.html', context)

# Update the existing export_reports function to handle edge cases better
@login_required
def export_reports(request):
    """Export reports to Excel with improved error handling"""
    try:
        # Create Excel file with multiple sheets
        output = BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # All items sheet
            items_data = []
            for item in Item.objects.select_related('category').all():
                items_data.append({
                    'Category': item.category.name,
                    'Item': item.name,
                    'Location': item.location or '',
                    'Condition': item.condition or '',
                    'Serial/Frequency': item.serial_frequency or '',
                    'Expected Quantity': item.expected_quantity,
                    'Latest Count': item.get_latest_count(),
                    'Has Shortage': 'Yes' if item.has_shortage() else 'No',
                })
            
            if items_data:
                df_items = pd.DataFrame(items_data)
                df_items.to_excel(writer, sheet_name='All Items', index=False)
            
            # Shortages sheet
            shortages_data = []
            for item in Item.objects.select_related('category').all():
                if item.has_shortage():
                    shortages_data.append({
                        'Category': item.category.name,
                        'Item': item.name,
                        'Location': item.location or '',
                        'Expected': item.expected_quantity,
                        'Current Count': item.get_latest_count(),
                        'Shortage Amount': item.expected_quantity - item.get_latest_count(),
                    })
            
            if shortages_data:
                df_shortages = pd.DataFrame(shortages_data)
                df_shortages.to_excel(writer, sheet_name='Shortages', index=False)
            else:
                # Create empty sheet with headers
                df_empty = pd.DataFrame(columns=['Category', 'Item', 'Location', 'Expected', 'Current Count', 'Shortage Amount'])
                df_empty.to_excel(writer, sheet_name='Shortages', index=False)
            
            # Sessions sheet
            sessions_data = []
            for session in InventorySession.objects.all():
                sessions_data.append({
                    'Session Name': session.name,
                    'Date': session.date,
                    'Conducted By': session.conducted_by.username if session.conducted_by else '',
                    'Complete': 'Yes' if session.is_complete else 'No',
                    'Completion %': session.get_completion_percentage(),
                    'Items Counted': session.counts.count(),
                })
            
            if sessions_data:
                df_sessions = pd.DataFrame(sessions_data)
                df_sessions.to_excel(writer, sheet_name='Sessions', index=False)
        
        output.seek(0)
        
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="avault_report_{timezone.now().strftime("%Y%m%d_%H%M")}.xlsx"'
        
        return response
        
    except Exception as e:
        messages.error(request, f'Export failed: {str(e)}')
        return redirect('inventory:reports')