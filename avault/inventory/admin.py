from django.contrib import admin
from .models import Category, Item, InventorySession, InventoryCount, AcademicTerm, HistoricalCount

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at', 'item_count']
    search_fields = ['name']
    ordering = ['name']
    
    def item_count(self, obj):
        return obj.items.count()
    item_count.short_description = 'Items'

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'location', 'condition', 'latest_count', 'created_at']
    list_filter = ['category', 'condition', 'location', 'created_at']
    search_fields = ['name', 'location', 'serial_frequency']
    ordering = ['category__name', 'name']
    list_select_related = ['category']
    
    def latest_count(self, obj):
        return obj.get_latest_count()
    latest_count.short_description = 'Latest Count'

@admin.register(AcademicTerm)
class AcademicTermAdmin(admin.ModelAdmin):
    list_display = ['name', 'term', 'year', 'created_at']
    list_filter = ['term', 'year']
    search_fields = ['name']
    ordering = ['-year', '-term']

@admin.register(HistoricalCount)
class HistoricalCountAdmin(admin.ModelAdmin):
    list_display = ['item', 'academic_term', 'counted_quantity', 'imported_at']
    list_filter = ['academic_term', 'imported_at']
    search_fields = ['item__name', 'academic_term__name']
    ordering = ['-academic_term__year', '-academic_term__term', 'item__name']
    list_select_related = ['item', 'academic_term']

@admin.register(InventorySession)
class InventorySessionAdmin(admin.ModelAdmin):
    list_display = ['name', 'date', 'conducted_by', 'academic_term', 'is_complete', 'completion_percentage', 'created_at']
    list_filter = ['is_complete', 'date', 'conducted_by', 'academic_term']
    search_fields = ['name']
    ordering = ['-date']
    
    def completion_percentage(self, obj):
        return f"{obj.get_completion_percentage()}%"
    completion_percentage.short_description = 'Completion'

@admin.register(InventoryCount)
class InventoryCountAdmin(admin.ModelAdmin):
    list_display = ['item', 'session', 'counted_quantity', 'discrepancy', 'counted_by', 'counted_at']
    list_filter = ['session', 'counted_at', 'counted_by']
    search_fields = ['item__name', 'session__name']
    ordering = ['-counted_at']
    list_select_related = ['item', 'session', 'counted_by']
    
    def discrepancy(self, obj):
        return obj.has_discrepancy()
    discrepancy.boolean = True
    discrepancy.short_description = 'Has Discrepancy'