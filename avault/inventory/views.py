# Add these missing functions to avault/inventory/views.py

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