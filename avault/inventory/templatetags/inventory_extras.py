from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    """Get item from dictionary by key"""
    return dictionary.get(key, 0)

@register.filter
def add_class(field, css_class):
    """Add CSS class to form field"""
    return field.as_widget(attrs={"class": css_class})