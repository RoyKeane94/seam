from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import search_notes


class SearchView(APIView):
    def post(self, request):
        query = request.data.get('query', '').strip()
        if not query:
            return Response(
                {'detail': 'Query is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            results = search_notes(request.user.id, query)
        except Exception:
            return Response(
                {'detail': 'Search failed.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({'results': results})
