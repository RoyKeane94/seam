from django import forms
from .models import Waitlist

class WaitlistForm(forms.ModelForm):
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            'class': 'form-input',
            'placeholder': 'Enter your email',
            'required': True
        }),
        label='Email Address'
    )
    
    class Meta:
        model = Waitlist
        fields = ['email']


