from django.urls import path
from . import views

app_name = 'pages'

urlpatterns = [
    path('', views.landing_page, name='landing_page'),
    path('privacy/', views.privacy_policy, name='privacy_policy'),
]


