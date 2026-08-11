import uuid
from django.db import models

class RuleOrigin(models.TextChoices):
    CENTRAL = "CENTRAL", "Central"
    CLIENT = "CLIENT", "Client"

class RuleDimension(models.TextChoices):
    GROSS_WEIGHT = "GROSS_WEIGHT", "Gross Weight"
    AXLE_LOAD = "AXLE_LOAD", "Axle Load"
    DIMENSION_LENGTH = "DIMENSION_LENGTH", "Length"
    DIMENSION_WIDTH = "DIMENSION_WIDTH", "Width"
    DIMENSION_HEIGHT = "DIMENSION_HEIGHT", "Height"
    AXLE_CONFIG = "AXLE_CONFIG", "Axle Config"

class RuleOperator(models.TextChoices):
    LTE = "LTE", "<="
    GTE = "GTE", ">="
    EQ = "EQ", "=="

class RuleStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"
    ARCHIVED = "ARCHIVED", "Archived"

class RulePack(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    domain = models.CharField(max_length=50, default="ODOL")
    version = models.IntegerField()
    origin = models.CharField(max_length=20, choices=RuleOrigin.choices)
    effective_from = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['domain', 'origin', 'version'], name='unique_rule_pack_version')
        ]

    def __str__(self):
        return f"{self.origin} - {self.domain} v{self.version}"

class Rule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rule_pack = models.ForeignKey(RulePack, on_delete=models.CASCADE, related_name="rules")
    dimension = models.CharField(max_length=50, choices=RuleDimension.choices)
    operator = models.CharField(max_length=10, choices=RuleOperator.choices)
    threshold = models.IntegerField()
    unit = models.CharField(max_length=10) # e.g. "kg", "mm"
    
    # Optional constraints
    axle_config = models.JSONField(null=True, blank=True) # e.g. ["1.2", "1.22"]
    axle_index = models.IntegerField(null=True, blank=True) # 0-based
    
    legal_citation = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=RuleStatus.choices, default=RuleStatus.ACTIVE)

    def __str__(self):
        return f"{self.dimension} {self.operator} {self.threshold} {self.unit}"
