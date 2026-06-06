from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ErrorLog
from .serializers import ClientErrorReportSerializer
from .services import log_error


class ClientErrorReportView(APIView):
    """Accept error reports from the React app (ErrorBoundary)."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = ClientErrorReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        log_error(
            request=request,
            kind=ErrorLog.Kind.CLIENT,
            status_code=500,
            message=data['message'],
            extra={
                'stack': data.get('stack', ''),
                'component': data.get('component', ''),
                'client_path': data.get('path', ''),
            },
        )
        return Response({'ok': True}, status=status.HTTP_204_NO_CONTENT)
