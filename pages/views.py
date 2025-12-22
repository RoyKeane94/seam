from django.shortcuts import render, redirect
from django.contrib import messages
from .forms import WaitlistForm

def landing_page(request):
    """Landing page view with waitlist signup"""
    if request.method == 'POST':
        form = WaitlistForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Thanks! You\'ve been added to the waitlist.')
            return redirect('landing_page')
    else:
        form = WaitlistForm()
    
    return render(request, 'pages/landing.html', {'form': form})
