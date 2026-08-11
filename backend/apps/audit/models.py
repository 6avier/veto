import uuid
from django.db import models

class Outcome(models.TextChoices):
    PASS = "PASS", "Pass"
    HOLD = "HOLD", "Hold"

class DispatchDecision(models.Model):
    decision_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    outcome = models.CharField(max_length=10, choices=Outcome.choices)
    dispatch_ref = models.CharField(max_length=100, db_index=True)
    payload = models.JSONField(help_text="Original request payload")
    
    # We store the IDs of applied rule packs for auditing
    rule_packs_applied = models.JSONField(help_text="List of rule packs applied")
    
    latency_ms = models.IntegerField()
    evaluated_at = models.DateTimeField(auto_now_add=True)

    # Override fields (API contract §2)
    override_id = models.UUIDField(null=True, blank=True)
    override_reason = models.TextField(null=True, blank=True)
    overridden_by = models.CharField(max_length=255, null=True, blank=True)
    override_created_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.dispatch_ref} - {self.outcome}"

class ViolationSeverity(models.TextChoices):
    BLOCKING = "BLOCKING", "Blocking"
    WARNING = "WARNING", "Warning"

class Violation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    decision = models.ForeignKey(DispatchDecision, on_delete=models.CASCADE, related_name="violations")
    dimension = models.CharField(max_length=50) # e.g. GROSS_WEIGHT
    axle_index = models.IntegerField(null=True, blank=True)
    actual_value = models.IntegerField()
    limit_value = models.IntegerField()
    excess_value = models.IntegerField()
    unit = models.CharField(max_length=10)
    severity = models.CharField(max_length=20, choices=ViolationSeverity.choices)
    rule_origin = models.CharField(max_length=20)
    legal_citation = models.CharField(max_length=255)
    directive = models.TextField()

    def __str__(self):
        return f"{self.dimension} violation on {self.decision.dispatch_ref}"
