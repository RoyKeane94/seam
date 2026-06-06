from django.urls import path

from .views import ClientErrorReportView

urlpatterns = [
    path('report/', ClientErrorReportView.as_view(), name='error-report'),
]
