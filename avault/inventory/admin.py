from django.contrib.admin import AdminSite
from django.urls import reverse
from django.utils.html import format_html
from .models import Category, Item, InventorySession, InventoryCount, AcademicTerm, HistoricalCount

# Custom Admin Site
class AVaultAdminSite(AdminSite):
    site_header = 'AVault Administration'
    site_title = 'AVault Admin'
    index_title = 'AVault System Management'
    
    def get_app_list(self, request):
        """
        Return a sorted list of all the installed apps that have been
        registered in this site.
        """
        app_dict = self._build_app_dict(request)
        
        # Custom ordering for apps
        app_order = ['inventory', 'auth']
        ordered_apps = []
        
        for app_name in app_order:
            if app_name in app_dict:
                ordered_apps.append(app_dict[app_name])
        
        # Add remaining apps
        for app_name, app in app_dict.items():
            if app_name not in app_order:
                ordered_apps.append(app)
        
        return ordered_apps

# Enhanced Model Admins
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at', 'item_count', 'actions']
    search_fields = ['name']
    ordering = ['name']
    list_per_page = 25
    
    def item_count(self, obj):
        count = obj.items.count()
        url = reverse('admin:inventory_item_changelist') + f'?category__id__exact={obj.id}'
        return format_html('<a href="{}">{} items</a>', url, count)
    item_count.short_description = 'Items'
    
    def actions(self, obj):
        return format_html(
            '<a class="btn btn-sm btn-outline-primary" href="{}">Edit</a>',
            reverse('admin:inventory_category_change', args=[obj.pk])
        )
    actions.short_description = 'Actions'

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'location', 'condition', 'latest_count', 'created_at', 'actions']
    list_filter = ['category', 'condition', 'location', 'created_at']
    search_fields = ['name', 'location', 'serial_frequency']
    ordering = ['category__name', 'name']
    list_select_related = ['category']
    list_per_page = 25
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'category', 'location')
        }),
        ('Details', {
            'fields': ('condition', 'serial_frequency', 'notes'),
            'classes': ('collapse',)
        }),
    )
    
    def latest_count(self, obj):
        count = obj.get_latest_count()
        return format_html('<span class="badge bg-primary">{}</span>', count)
    latest_count.short_description = 'Latest Count'
    
    def actions(self, obj):
        return format_html(
            '<a class="btn btn-sm btn-outline-primary" href="{}">Edit</a>',
            reverse('admin:inventory_item_change', args=[obj.pk])
        )
    actions.short_description = 'Actions'

@admin.register(InventorySession)  
class InventorySessionAdmin(admin.ModelAdmin):
    list_display = ['name', 'date', 'conducted_by', 'academic_term', 'is_complete', 'completion_percentage']
    list_filter = ['is_complete', 'date', 'conducted_by', 'academic_term']
    search_fields = ['name']
    ordering = ['-date']
    
    def completion_percentage(self, obj):
        percentage = obj.get_completion_percentage()
        color = 'success' if percentage == 100 else 'warning'
        return format_html('<span class="badge bg-{}">{}</span>', color, f'{percentage}%')
    completion_percentage.short_description = 'Completion'

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