from django.urls import path
from . import views

app_name = 'inventory'

urlpatterns = [
    # Main pages - Enhanced
    path('', enhanced_dashboard, name='dashboard'),  # Use enhanced dashboard
    path('add-item/', add_item, name='add_item'),
    path('edit-item/<int:item_id>/', edit_item, name='edit_item'),
    path('delete-item/<int:item_id>/', delete_item, name='delete_item'),
    
    # AJAX endpoints
    path('add-category-ajax/', add_category_ajax, name='add_category_ajax'),
    path('ajax/term-data/', ajax_get_term_data, name='ajax_get_term_data'),
    
    # Enhanced Inventory sessions
    path('sessions/', semester_sessions_view, name='inventory_sessions'),  # Enhanced view
    path('sessions/create/', smart_create_session, name='create_session'),  # Smart creation
    path('sessions/<int:session_id>/conduct/', conduct_inventory, name='conduct_inventory'),
    
    # Quick session actions
    path('quick-start-session/', quick_start_current_session, name='quick_start_session'),
    
    # Reports and existing paths...
    path('reports/', reports, name='reports'),
    path('reports/enhanced/', enhanced_reports, name='enhanced_reports'),
    path('reports/export/', export_reports, name='export_reports'),
    
    # Semester-specific views
    path('semester-history/', semester_history, name='semester_history'),
    path('semester-comparison/', semester_comparison, name='semester_comparison'),
    path('item/<int:item_id>/trends/', item_trend_analysis, name='item_trend_analysis'),
    
    # Enhanced import and export
    path('import/', enhanced_import_excel, name='import_excel'),
    path('export-semester-data/', export_semester_data, name='export_semester_data'),
]
