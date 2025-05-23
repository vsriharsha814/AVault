from django.shortcuts import render
from django.http import HttpResponseNotFound, HttpResponseServerError, HttpResponseForbidden, HttpResponseBadRequest

def custom_404_view(request, exception=None):
    """Custom 404 error page"""
    return HttpResponseNotFound(
        render(request, '404.html', {
            'request_path': request.get_full_path()
        }).content
    )

def custom_500_view(request):
    """Custom 500 error page"""
    return HttpResponseServerError(
        render(request, '500.html', {
            'request_path': request.get_full_path()
        }).content
    )

def custom_403_view(request, exception=None):
    """Custom 403 error page"""
    return HttpResponseForbidden(
        render(request, '403.html', {
            'request_path': request.get_full_path()
        }).content
    )

def custom_400_view(request, exception=None):
    """Custom 400 error page"""
    return HttpResponseBadRequest(
        render(request, '400.html', {
            'request_path': request.get_full_path()
        }).content
    )