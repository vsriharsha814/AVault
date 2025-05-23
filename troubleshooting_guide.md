# AVault Troubleshooting Guide

## Common Setup Issues

### 1. Template Not Found Error
**Error**: `TemplateDoesNotExist at /login/`
**Solution**: 
```bash
# Create the registration directory
mkdir -p avault/inventory/templates/registration
# Move login.html to the correct location
```

### 2. Import Error for Template Tags
**Error**: `'inventory_extras' is not a registered tag library`
**Solution**: Add to your template:
```html
{% load inventory_extras %}
```

### 3. Database Migration Issues
**Error**: `no such table: inventory_category`
**Solution**:
```bash
cd avault
python manage.py makemigrations inventory
python manage.py migrate
```

### 4. Excel Import Fails
**Error**: `No module named 'openpyxl'`
**Solution**:
```bash
pip install openpyxl pandas
```

### 5. Permission Denied on Import
**Error**: Only staff users can import
**Solution**: 
- Login as admin (admin/admin123)
- Or make user staff: `python manage.py shell` then:
```python
from django.contrib.auth.models import User
user = User.objects.get(username='avuser')
user.is_staff = True
user.save()
```

## Testing the Application

### 1. Basic Flow Test
1. Start server: `python manage.py runserver`
2. Visit: http://127.0.0.1:8000
3. Login with: avuser / avpass123
4. Add a new item
5. Create inventory session
6. Conduct inventory count
7. View reports

### 2. Excel Import Test
1. Login as admin
2. Go to Import page
3. Upload Excel file following the sample format
4. Check dashboard for imported items

### 3. Multi-user Test
1. Create additional users in Django admin
2. Test different permission levels
3. Verify session tracking works correctly

## Production Deployment Notes

### Security Checklist
- [ ] Change SECRET_KEY in settings.py
- [ ] Set DEBUG = False
- [ ] Update ALLOWED_HOSTS
- [ ] Use PostgreSQL instead of SQLite
- [ ] Set up HTTPS
- [ ] Configure proper backup strategy

### Performance Optimization
- [ ] Add database indexes
- [ ] Configure static file serving
- [ ] Set up caching if needed
- [ ] Monitor database query performance

## Feature Extensions

Possible enhancements you could add:
1. **Barcode scanning** for faster inventory counts
2. **Photo uploads** for items
3. **Email notifications** for low stock
4. **Advanced search** with filters
5. **Audit trails** for all changes
6. **Mobile-responsive** improvements
7. **Data visualization** charts and graphs
8. **Equipment check-out** system
9. **Maintenance scheduling**
10. **Integration** with procurement systems