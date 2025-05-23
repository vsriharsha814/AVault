# inventory/urls.py
from django.urls import path
from . import views

app_name = 'inventory'

urlpatterns = [
    # Main pages
    path('', views.dashboard, name='dashboard'),
    path('add-item/', views.add_item, name='add_item'),
    path('edit-item/<int:item_id>/', views.edit_item, name='edit_item'),
    
    # Inventory sessions
    path('sessions/', views.inventory_sessions, name='inventory_sessions'),
    path('sessions/create/', views.create_session, name='create_session'),
    path('sessions/<int:session_id>/conduct/', views.conduct_inventory, name='conduct_inventory'),
    
    # Reports
    path('reports/', views.reports, name='reports'),
    path('reports/export/', views.export_reports, name='export_reports'),
    
    # Admin functions
    path('import/', views.import_excel, name='import_excel'),
]