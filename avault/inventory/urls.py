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

# inventory/admin.py
from django.contrib import admin
from .models import Category, Item, InventorySession, InventoryCount

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name']
    ordering = ['name']

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'location', 'condition', 'expected_quantity', 'created_at']
    list_filter = ['category', 'condition', 'location']
    search_fields = ['name', 'location', 'serial_frequency']
    ordering = ['category__name', 'name']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('category')

@admin.register(InventorySession)
class InventorySessionAdmin(admin.ModelAdmin):
    list_display = ['name', 'date', 'conducted_by', 'is_complete', 'created_at']
    list_filter = ['is_complete', 'date']
    search_fields = ['name']
    ordering = ['-date']

@admin.register(InventoryCount)
class InventoryCountAdmin(admin.ModelAdmin):
    list_display = ['item', 'session', 'counted_quantity', 'counted_by', 'counted_at']
    list_filter = ['session', 'counted_at']
    search_fields = ['item__name', 'session__name']
    ordering = ['-counted_at']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('item', 'session', 'counted_by')