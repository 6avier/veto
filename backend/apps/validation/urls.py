"""Validation engine routes — api-contract.md §1."""

from django.urls import path

from . import views

urlpatterns = [
    path("validate", views.validate, name="validate"),
    path("vision/detect", views.vision_detect, name="vision_detect"),
]
