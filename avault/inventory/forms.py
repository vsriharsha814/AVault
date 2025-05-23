# inventory/forms.py
from django import forms
from django.core.exceptions import ValidationError
from .models import Item, Category, InventorySession

class ItemForm(forms.ModelForm):
    """Form for adding/editing inventory items"""
    
    class Meta:
        model = Item
        fields = ['name', 'category', 'location', 'condition', 'serial_frequency', 'expected_quantity', 'notes']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g., Shure SM-57'}),
            'category': forms.Select(attrs={'class': 'form-control'}),
            'location': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g., GMB AV Closet'}),
            'condition': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g., Good, Fair, Needs Repair'}),
            'serial_frequency': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Serial number or frequency'}),
            'expected_quantity': forms.NumberInput(attrs={'class': 'form-control', 'min': '0'}),
            'notes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Additional notes...'})
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['category'].empty_label = "Select a category..."
        self.fields['category'].required = True

class CategoryForm(forms.ModelForm):
    """Form for adding new categories"""
    
    class Meta:
        model = Category
        fields = ['name']
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'form-control', 
                'placeholder': 'e.g., WIRED MICS'
            })
        }
    
    def clean_name(self):
        name = self.cleaned_data['name'].strip().upper()
        if Category.objects.filter(name=name).exists():
            raise ValidationError("A category with this name already exists.")
        return name

class InventorySessionForm(forms.ModelForm):
    """Form for creating new inventory sessions"""
    
    class Meta:
        model = InventorySession
        fields = ['name', 'date', 'notes']
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'form-control', 
                'placeholder': 'e.g., Summer 2025'
            }),
            'date': forms.DateInput(attrs={
                'class': 'form-control', 
                'type': 'date'
            }),
            'notes': forms.Textarea(attrs={
                'class': 'form-control', 
                'rows': 3, 
                'placeholder': 'Session notes (optional)...'
            })
        }
    
    def clean_name(self):
        name = self.cleaned_data['name'].strip()
        if InventorySession.objects.filter(name=name).exists():
            raise ValidationError("A session with this name already exists.")
        return name

# inventory/utils.py
import pandas as pd
from django.utils import timezone
from .models import Category, Item, InventorySession, InventoryCount

def import_excel_data(excel_file):
    """
    Import data from the Excel file maintaining the exact structure
    """
    # Read the Excel file
    df = pd.read_excel(excel_file, sheet_name=0)
    
    # Initialize counters
    categories_created = 0
    items_created = 0
    counts_created = 0
    
    # Create a session for the import (use the latest semester column)
    semester_columns = [col for col in df.columns if col not in ['Item', 'LOCATION', 'CONDITION', 'S/N - FREQUENCY']]
    latest_semester = semester_columns[-1] if semester_columns else 'Import Session'
    
    session, created = InventorySession.objects.get_or_create(
        name=latest_semester,
        defaults={
            'date': timezone.now().date(),
            'is_complete': True
        }
    )
    
    current_category = None
    
    # Process each row
    for index, row in df.iterrows():
        item_name = str(row['Item']).strip() if pd.notna(row['Item']) else ''
        
        if not item_name:
            continue
            
        # Check if this is a category header (no count data in semester columns)
        has_count_data = any(pd.notna(row.get(col)) and isinstance(row.get(col), (int, float)) 
                           for col in semester_columns)
        
        if not has_count_data and len(item_name) > 3:
            # This is a category header
            category, created = Category.objects.get_or_create(name=item_name)
            current_category = category
            if created:
                categories_created += 1
        
        elif has_count_data and current_category:
            # This is an item with inventory data
            location = str(row.get('LOCATION', '')).strip() if pd.notna(row.get('LOCATION')) else ''
            condition = str(row.get('CONDITION', '')).strip() if pd.notna(row.get('CONDITION')) else ''
            serial_freq = str(row.get('S/N - FREQUENCY', '')).strip() if pd.notna(row.get('S/N - FREQUENCY')) else ''
            
            # Get the latest count (most recent semester with data)
            latest_count = 0
            for col in reversed(semester_columns):
                if pd.notna(row.get(col)) and isinstance(row.get(col), (int, float)):
                    latest_count = int(row.get(col))
                    break
            
            # Create or update the item
            item, created = Item.objects.get_or_create(
                name=item_name,
                category=current_category,
                defaults={
                    'location': location,
                    'condition': condition,
                    'serial_frequency': serial_freq,
                    'expected_quantity': latest_count
                }
            )
            
            if created:
                items_created += 1
            else:
                # Update existing item
                item.location = location
                item.condition = condition
                item.serial_frequency = serial_freq
                item.expected_quantity = latest_count
                item.save()
            
            # Create inventory count for the latest session
            count, count_created = InventoryCount.objects.get_or_create(
                item=item,
                session=session,
                defaults={'counted_quantity': latest_count}
            )
            
            if count_created:
                counts_created += 1
    
    return {
        'categories': categories_created,
        'items': items_created,
        'counts': counts_created,
        'session': session.name
    }