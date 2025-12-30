from django.shortcuts import render, redirect
from django.contrib import messages
from django.urls import reverse
from django.utils import timezone
from .forms import WaitlistForm
from .models import PageVisit

def landing_page(request):
    """Landing page view with waitlist signup"""
    # Track visit
    today = timezone.now().date()
    visit, created = PageVisit.objects.get_or_create(visit_date=today)
    visit.visit_count += 1
    visit.save()
    
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
