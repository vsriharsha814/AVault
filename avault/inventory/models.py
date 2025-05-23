from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import re

class Category(models.Model):
    """Major equipment categories like 'WIRED MICS', 'MIXERS', etc."""
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['name']
    
    def __str__(self):
        return self.name

class AcademicTerm(models.Model):
    """Represents academic terms like 'SPRING 2024', 'SUMMER 2025', etc."""
    TERM_CHOICES = [
        ('SPRING', 'Spring'),
        ('SUMMER', 'Summer'),
        ('FALL', 'Fall'),
        ('WINTER', 'Winter'),
    ]
    
    name = models.CharField(max_length=50, unique=True)  # e.g., "SPRING 2024"
    term = models.CharField(max_length=10, choices=TERM_CHOICES)
    year = models.IntegerField()
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-year', '-term']
        unique_together = ['term', 'year']
    
    def __str__(self):
        return self.name
    
    @classmethod
    def parse_from_excel_header(cls, header_text):
        """Parse Excel headers like 'SPRING 2024', 'Summer 2018' into term and year"""
        header_text = str(header_text).strip().upper()
        
        # Extract year (4 digits)
        year_match = re.search(r'\b(20\d{2}|19\d{2})\b', header_text)
        if not year_match:
            return None, None
            
        year = int(year_match.group(1))
        
        # Extract term
        term = None
        if 'SPRING' in header_text:
            term = 'SPRING'
        elif 'SUMMER' in header_text:
            term = 'SUMMER'
        elif 'FALL' in header_text:
            term = 'FALL'
        elif 'WINTER' in header_text:
            term = 'WINTER'
        
        return term, year
    
    @classmethod
    def get_or_create_from_excel_header(cls, header_text):
        """Create AcademicTerm from Excel header"""
        term, year = cls.parse_from_excel_header(header_text)
        if not term or not year:
            return None
            
        name = f"{term} {year}"
        obj, created = cls.objects.get_or_create(
            name=name,
            defaults={
                'term': term,
                'year': year
            }
        )
        return obj

class Item(models.Model):
    """Individual inventory items with their details"""
    name = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='items')
    location = models.CharField(max_length=200, blank=True)
    condition = models.CharField(max_length=100, blank=True)
    serial_frequency = models.CharField(max_length=100, blank=True, verbose_name="Serial/Frequency")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['category__name', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.category.name})"
    
    def get_latest_count(self):
        """Get the most recent inventory count for this item"""
        latest = self.historical_counts.order_by('-academic_term__year', '-academic_term__term').first()
        return latest.counted_quantity if latest else 0
    
    def get_expected_quantity(self):
        """Get expected quantity based on most recent count"""
        return self.get_latest_count()
    
    def has_shortage(self, session=None):
        """Check if current count is less than expected for a given session"""
        if session:
            current_count = self.get_count_for_session(session)
        else:
            current_count = self.get_latest_count()
        return current_count < self.get_expected_quantity()
    
    def get_count_for_session(self, session):
        """Get count for a specific inventory session"""
        count = self.counts.filter(session=session).first()
        return count.counted_quantity if count else 0
    
    def get_count_for_term(self, academic_term):
        """Get historical count for a specific academic term"""
        count = self.historical_counts.filter(academic_term=academic_term).first()
        return count.counted_quantity if count else 0
    
    def get_count_history(self):
        """Get all historical counts ordered by term"""
        return self.historical_counts.select_related('academic_term').order_by(
            'academic_term__year', 'academic_term__term'
        )

class HistoricalCount(models.Model):
    """Historical inventory counts from Excel imports, tied to academic terms"""
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='historical_counts')
    academic_term = models.ForeignKey(AcademicTerm, on_delete=models.CASCADE, related_name='historical_counts')
    counted_quantity = models.PositiveIntegerField(default=0)
    imported_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['item', 'academic_term']
        ordering = ['academic_term__year', 'academic_term__term']
    
    def __str__(self):
        return f"{self.item.name} - {self.academic_term.name}: {self.counted_quantity}"

class InventorySession(models.Model):
    """Represents one inventory counting session (e.g., 'Summer 2025 Count')"""
    name = models.CharField(max_length=50)  # e.g., "Summer 2025 Count"
    academic_term = models.ForeignKey(AcademicTerm, on_delete=models.SET_NULL, null=True, blank=True)
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
        return self.counted_quantity != self.item.get_expected_quantity()