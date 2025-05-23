from django import forms
from django.core.exceptions import ValidationError
from .models import Item, Category, InventorySession

class ItemForm(forms.ModelForm):
    """Form for adding/editing inventory items"""
    
    class Meta:
        model = Item
        fields = ['name', 'category', 'location', 'condition', 'serial_frequency', 'notes']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g., Shure SM-57'}),
            'category': forms.Select(attrs={'class': 'form-control'}),
            'location': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g., GMB AV Closet'}),
            'condition': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g., Good, Fair, Needs Repair'}),
            'serial_frequency': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Serial number or frequency'}),
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