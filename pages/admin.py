from django.contrib import admin
from .models import Waitlist

@admin.register(Waitlist)
class WaitlistAdmin(admin.ModelAdmin):
    list_display = ('email', 'what_mostly_share', 'date_signed_up')
    list_filter = ('date_signed_up', 'what_mostly_share')
    search_fields = ('email',)
    readonly_fields = ('date_signed_up',)
    ordering = ('-date_signed_up',)
