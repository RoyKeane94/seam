import logging
import traceback as tb_module

from django.db import DatabaseError

from .models import ErrorLog

logger = logging.getLogger(__name__)

MAX_MESSAGE = 4000
MAX_TRACEBACK = 16000
MAX_PATH = 2048
MAX_UA = 512


def _client_ip(request) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()[:45]
    return request.META.get('REMOTE_ADDR')


def _clip(value: str, limit: int) -> str:
    if not value:
        return ''
    return value if len(value) <= limit else value[: limit - 3] + '...'


def log_error(
    *,
    request=None,
    kind: str = ErrorLog.Kind.SERVER,
    status_code: int | None = None,
    exception: BaseException | None = None,
    message: str = '',
    extra: dict | None = None,
) -> ErrorLog | None:
    """Persist an error for admin review. Never raises."""
    if request is not None and getattr(request, '_error_logged', False):
        return None

    if exception is not None:
        message = message or str(exception)
        exception_type = type(exception).__name__
        traceback = _clip(''.join(tb_module.format_exception(exception)), MAX_TRACEBACK)
    else:
        exception_type = ''
        traceback = ''

    path = ''
    method = ''
    user = None
    user_agent = ''
    if request is not None:
        path = _clip(getattr(request, 'path', '') or '', MAX_PATH)
        method = (getattr(request, 'method', '') or '')[:10]
        user = getattr(request, 'user', None)
        if user is not None and not getattr(user, 'is_authenticated', False):
            user = None
        user_agent = _clip(request.META.get('HTTP_USER_AGENT', ''), MAX_UA)
        request._error_logged = True

    try:
        entry = ErrorLog.objects.create(
            kind=kind,
            status_code=status_code,
            path=path,
            method=method,
            exception_type=exception_type,
            message=_clip(message, MAX_MESSAGE),
            traceback=traceback,
            user=user,
            user_agent=user_agent,
            ip_address=_client_ip(request),
            extra=extra or {},
        )
        logger.warning(
            'Logged %s error %s %s %s',
            kind,
            status_code or '—',
            path,
            entry.id,
        )
        return entry
    except DatabaseError:
        logger.exception('Failed to persist ErrorLog')
        return None
    except Exception:
        logger.exception('Failed to persist ErrorLog')
        return None
