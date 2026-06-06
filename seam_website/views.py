from django.conf import settings
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.static import serve

FRONTEND_DIR = settings.BASE_DIR / 'frontend' / 'dist'
PUBLIC_DIR = settings.BASE_DIR / 'frontend' / 'public'


def health(request):
    return HttpResponse('ok', content_type='text/plain')


def landing(request):
    return render(request, 'landing.html')


def serve_public_file(request, path):
    for root in (FRONTEND_DIR, PUBLIC_DIR):
        file_path = root / path
        if file_path.is_file():
            content_type = 'image/svg+xml' if path.endswith('.svg') else None
            return FileResponse(file_path.open('rb'), content_type=content_type)
    return HttpResponse(status=404)


def serve_frontend_asset(request, path):
    return serve(request, path, document_root=FRONTEND_DIR / 'assets')


def spa(request):
    index = FRONTEND_DIR / 'index.html'
    if not index.exists():
        return HttpResponse(
            '<h1>Seam API is running</h1>'
            '<p>Frontend not built yet. Run:</p>'
            '<pre>cd frontend && npm install && npm run build</pre>'
            '<p>Then refresh this page.</p>',
            status=503,
            content_type='text/html',
        )
    response = FileResponse(index.open('rb'), content_type='text/html; charset=utf-8')
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response


def api_root(request):
    return JsonResponse({
        'name': 'Seam API',
        'endpoints': {
            'auth': '/api/auth/',
            'notes': '/api/notes/',
            'search': '/api/retrieve/search/',
        },
    })
