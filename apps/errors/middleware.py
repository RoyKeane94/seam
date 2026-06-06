from .models import ErrorLog
from .services import log_error


class ErrorLoggingMiddleware:
    """Log unhandled exceptions before Django renders the 500 page."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        log_error(
            request=request,
            kind=ErrorLog.Kind.SERVER,
            status_code=500,
            exception=exception,
        )
        return None
