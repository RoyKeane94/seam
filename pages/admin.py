from django.contrib import admin
from .models import Waitlist, PageVisit

@admin.register(PageVisit)
class PageVisitAdmin(admin.ModelAdmin):
    list_display = ('visit_date', 'visit_count', 'last_visit')
    list_filter = ('visit_date',)
    readonly_fields = ('visit_date', 'visit_count', 'last_visit')
    ordering = ('-visit_date',)
    date_hierarchy = 'visit_date'

@admin.register(Waitlist)
class WaitlistAdmin(admin.ModelAdmin):
    list_display = ('email', 'what_mostly_share', 'date_signed_up')
    list_filter = ('date_signed_up', 'what_mostly_share')
    search_fields = ('email',)
    readonly_fields = ('date_signed_up',)
    ordering = ('-date_signed_up',)
