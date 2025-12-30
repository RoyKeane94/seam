from django.shortcuts import render, redirect
from django.contrib import messages
from django.urls import reverse
from .forms import WaitlistForm

def landing_page(request):
    """Landing page view with waitlist signup"""
    if request.method == 'POST':
        form = WaitlistForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Thanks! You\'ve been added to the waitlist.')
            return redirect(reverse('pages:landing_page') + '#waitlist')
    else:
        form = WaitlistForm()
    
    return render(request, 'pages/landing.html', {'form': form})

def privacy_policy(request):
    """Privacy policy page"""
    return render(request, 'pages/privacy_policy.html')
