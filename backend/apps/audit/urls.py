from django.urls import path
from .views import DecisionListView, DecisionDetailView, DecisionOverrideView

urlpatterns = [
    path('decisions', DecisionListView.as_view(), name='decision_list'),
    path('decisions/<uuid:decision_id>', DecisionDetailView.as_view(), name='decision_detail'),
    path('decisions/<uuid:decision_id>/override', DecisionOverrideView.as_view(), name='decision_override'),
]
