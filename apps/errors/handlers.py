from django.shortcuts import render

from .models import ErrorLog
from .services import log_error


def page_not_found(request, exception):
    log_error(
        request=request,
        kind=ErrorLog.Kind.SERVER,
        status_code=404,
        message=str(exception),
    )
    return render(
        request,
        'errors/404.html',
        {'path': request.path},
        status=404,
    )


def server_error(request):
    if not getattr(request, '_error_logged', False):
        log_error(
            request=request,
            kind=ErrorLog.Kind.SERVER,
            status_code=500,
            message='Unhandled server error',
        )
    return render(request, 'errors/500.html', status=500)


def permission_denied(request, exception):
    log_error(
        request=request,
        kind=ErrorLog.Kind.SERVER,
        status_code=403,
        message=str(exception),
    )
    return render(request, 'errors/403.html', status=403)
