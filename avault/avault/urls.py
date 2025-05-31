from django.contrib import admin
from django.urls import path, include
from django.contrib.auth import views as auth_views
from django.shortcuts import redirect
from django.conf import settings
from django.conf.urls.static import static

def home_redirect(request):
    """Redirect to appropriate page based on authentication"""
    if request.user.is_authenticated:
        return redirect('inventory:dashboard')
    else:
        return redirect('login')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home_redirect, name='home'),
    path('inventory/', include('inventory.urls')),
    
    path('login/', auth_views.LoginView.as_view(template_name='registration/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(template_name='registration/logged_out.html'), name='logout'),
]

# Serve static files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Custom error handlers - Import the views from the new views.py file
from .views import custom_404_view, custom_500_view, custom_403_view, custom_400_view

handler404 = custom_404_view
handler500 = custom_500_view
handler403 = custom_403_view
handler400 = custom_400_view