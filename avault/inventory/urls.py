from django.urls import path
from . import views

app_name = 'inventory'

urlpatterns = [
    # Main pages - Enhanced
    path('', views.enhanced_dashboard, name='dashboard'),  # Use enhanced dashboard
    path('add-item/', views.add_item, name='add_item'),
    path('edit-item/<int:item_id>/', views.edit_item, name='edit_item'),
    path('delete-item/<int:item_id>/', views.delete_item, name='delete_item'),
    
    # AJAX endpoints
    path('add-category-ajax/', views.add_category_ajax, name='add_category_ajax'),
    path('ajax/term-data/', views.ajax_get_term_data, name='ajax_get_term_data'),
    
    # Enhanced Inventory sessions
    path('sessions/', views.semester_sessions_view, name='inventory_sessions'),  # Enhanced view
    path('sessions/create/', views.smart_create_session, name='create_session'),  # Smart creation
    path('sessions/<int:session_id>/conduct/', views.conduct_inventory, name='conduct_inventory'),
    
    # Quick session actions
    path('quick-start-session/', views.quick_start_current_session, name='quick_start_session'),
    
    # Reports and existing paths...
    path('reports/', views.reports, name='reports'),
    path('reports/enhanced/', views.enhanced_reports, name='enhanced_reports'),
    path('reports/export/', views.export_reports, name='export_reports'),
    
    # Semester-specific views
    path('semester-history/', views.semester_history, name='semester_history'),
    path('semester-comparison/', views.semester_comparison, name='semester_comparison'),
    path('item/<int:item_id>/trends/', views.item_trend_analysis, name='item_trend_analysis'),
    
    # Enhanced import and export
    path('import/', views.enhanced_import_excel, name='import_excel'),
    path('export-semester-data/', views.export_semester_data, name='export_semester_data'),
]
