from django.contrib import admin
from django.urls import include, path, re_path

from apps.notes.views import TagListView

from .views import api_root, landing, serve_frontend_asset, serve_public_file, spa

urlpatterns = [
    path('', landing, name='landing'),
    path('favicon.svg', serve_public_file, {'path': 'favicon.svg'}),
    path('admin/', admin.site.urls),
    path('api/', api_root, name='api-root'),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/tags/', TagListView.as_view(), name='tags-list'),
    path('api/notes/', include('apps.notes.urls')),
    path('api/retrieve/', include('apps.retrieval.urls')),
    path('assets/<path:path>', serve_frontend_asset),
    re_path(r'^(?!api/|admin/|assets/|favicon\.svg).*$', spa, name='spa'),
]
