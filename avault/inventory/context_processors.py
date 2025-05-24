from django.contrib.auth.models import User
from .models import Item, Category, InventorySession, AcademicTerm, HistoricalCount
from django.contrib.admin.models import LogEntry
from django.conf import settings

def admin_stats(request):
    """Provide statistics for admin templates"""
    if not request.path.startswith('/admin/'):
        return {}
    
    try:
        stats = {
            'total_items': Item.objects.count(),
            'total_categories': Category.objects.count(),
            'total_sessions': InventorySession.objects.count(),
            'total_terms': AcademicTerm.objects.count(),
            'total_users': User.objects.count(),
            'total_historical': HistoricalCount.objects.count(),
            'recent_activities': LogEntry.objects.select_related('user')[:10],
            'recent_items': Item.objects.select_related('category')[:5],
            'active_sessions': InventorySession.objects.filter(is_complete=False)[:5],
            'debug': settings.DEBUG,
        }
        return stats
    except:
        return {}