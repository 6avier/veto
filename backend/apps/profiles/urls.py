from django.urls import path
from .views import VehicleProfileListCreateView, VehicleProfileDetailView

urlpatterns = [
    path('vehicle-profiles', VehicleProfileListCreateView.as_view(), name='profile_list_create'),
    path('vehicle-profiles/<uuid:profile_id>', VehicleProfileDetailView.as_view(), name='profile_detail'),
]
