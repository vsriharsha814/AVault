from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Category(models.Model):
    """Major equipment categories like 'WIRED MICS', 'MIXERS', etc."""
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['name']
    
    def __str__(self):
        return self.name

class Item(models.Model):
    """Individual inventory items with their details"""
    name = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='items')
    location = models.CharField(max_length=200, blank=True)
    condition = models.CharField(max_length=100, blank=True)
    serial_frequency = models.CharField(max_length=100, blank=True, verbose_name="Serial/Frequency")
    expected_quantity = models.PositiveIntegerField(default=0, help_text="Expected count based on last inventory")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['category__name', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.category.name})"
    
    def get_latest_count(self):
        """Get the most recent inventory count for this item"""
        latest = self.counts.order_by('-session__date').first()
        return latest.counted_quantity if latest else 0
    
    def has_shortage(self):
        """Check if current count is less than expected"""
        return self.get_latest_count() < self.expected_quantity

class InventorySession(models.Model):
    """Represents one inventory counting session (e.g., 'Summer 2025')"""
    name = models.CharField(max_length=50)  # e.g., "Summer 2025"
    date = models.DateField(default=timezone.now)
    conducted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    is_complete = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-date']
    
    def __str__(self):
        return self.name
    
    def get_completion_percentage(self):
        """Calculate what percentage of items have been counted"""
        total_items = Item.objects.count()
        counted_items = self.counts.count()
        return int((counted_items / total_items * 100)) if total_items > 0 else 0

class InventoryCount(models.Model):
    """Individual item counts for a specific inventory session"""
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='counts')
    session = models.ForeignKey(InventorySession, on_delete=models.CASCADE, related_name='counts')
    counted_quantity = models.PositiveIntegerField(default=0)
    counted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    counted_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['item', 'session']
        ordering = ['item__category__name', 'item__name']
    
    def __str__(self):
        return f"{self.item.name} - {self.session.name}: {self.counted_quantity}"
    
    def has_discrepancy(self):
        """Check if counted quantity differs from expected"""
        return self.counted_quantity != self.item.expected_quantity