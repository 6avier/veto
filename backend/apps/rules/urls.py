from django.urls import path
from .views import (
    RuleListView, 
    DocumentUploadView, 
    DocumentExtractView, 
    RuleCandidateListView, 
    RuleCandidateApproveView, 
    RuleCandidateRejectView
)

urlpatterns = [
    path('rules', RuleListView.as_view(), name='rule_list'),
    path('documents', DocumentUploadView.as_view(), name='document_upload'),
    path('documents/<uuid:document_id>/extract', DocumentExtractView.as_view(), name='document_extract'),
    path('rule-candidates', RuleCandidateListView.as_view(), name='candidate_list'),
    path('rule-candidates/<uuid:candidate_id>/approve', RuleCandidateApproveView.as_view(), name='candidate_approve'),
    path('rule-candidates/<uuid:candidate_id>/reject', RuleCandidateRejectView.as_view(), name='candidate_reject'),
]
