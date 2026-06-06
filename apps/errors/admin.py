from django.contrib import admin

from .models import ErrorLog


@admin.register(ErrorLog)
class ErrorLogAdmin(admin.ModelAdmin):
    list_display = (
        'created_at',
        'kind',
        'status_code',
        'path',
        'exception_type',
        'user',
    )
    list_filter = ('kind', 'status_code', 'created_at')
    search_fields = ('path', 'message', 'exception_type', 'user__email')
    readonly_fields = (
        'id',
        'kind',
        'status_code',
        'path',
        'method',
        'exception_type',
        'message',
        'traceback',
        'user',
        'user_agent',
        'ip_address',
        'extra',
        'created_at',
    )
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
