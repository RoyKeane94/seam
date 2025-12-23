from django import forms
from .models import Waitlist

SHARE_TYPE_CHOICES = [
    ('ideas', 'Ideas'),
    ('research', 'Research'),
    ('summaries', 'Summaries'),
    ('notes', 'Notes'),
]

class WaitlistForm(forms.ModelForm):
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            'class': 'form-input',
            'placeholder': 'Enter your email',
            'required': True
        }),
        label='Email Address'
    )
    
    what_mostly_share = forms.ChoiceField(
        choices=[('', 'Select...')] + SHARE_TYPE_CHOICES,
        required=False,
        widget=forms.Select(attrs={
            'class': 'form-select',
        }),
        label='What do you mostly share?'
    )
    
    class Meta:
        model = Waitlist
        fields = ['email', 'what_mostly_share']


