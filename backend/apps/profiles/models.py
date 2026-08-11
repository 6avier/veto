import uuid
from django.db import models

class VehicleProfile(models.Model):
    profile_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    axle_config = models.CharField(max_length=20, help_text="e.g. 1.2 or 1.22")
    tare_weight_kg = models.IntegerField()
    max_length_mm = models.IntegerField()
    max_width_mm = models.IntegerField()
    max_height_mm = models.IntegerField()

    def __str__(self):
        return self.name

    @property
    def axle_count(self):
        # Calculate axle count from config string e.g., '1.22' -> 3
        return len([c for c in self.axle_config if c.isdigit()])
