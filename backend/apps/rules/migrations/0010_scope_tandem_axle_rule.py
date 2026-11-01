"""Limit the 18,000 kg tandem rule to configurations where axle 1 is a tandem.

The rule was seeded with axle_index=1 and no axle_config, so it bound the second
axle of every vehicle. On a 1.2 truck that axle is a single axle, and a 15,000 kg
rear axle passed against a tandem ceiling. Scoped to the configurations whose
second axle opens a tandem group, a single second axle falls through to the
universal single-axle rule instead.

TODO: verify. This still applies the tandem figure to one axle of the group, not
to the group's sum; modelling axle groups is a larger change.
"""

from django.db import migrations

CENTRAL_PACK_ID = "c0a80101-0000-4000-8000-000000000001"
TANDEM_CONFIGS = ["1.2.2", "1.2.2-2.2", "1.2.2-2.2.2"]


def scope(apps, schema_editor):
    Rule = apps.get_model("rules", "Rule")
    Rule.objects.filter(
        rule_pack_id=CENTRAL_PACK_ID,
        dimension="AXLE_LOAD",
        axle_index=1,
        threshold=18000,
        axle_config__isnull=True,
    ).update(axle_config=TANDEM_CONFIGS)


def unscope(apps, schema_editor):
    Rule = apps.get_model("rules", "Rule")
    for rule in Rule.objects.filter(
        rule_pack_id=CENTRAL_PACK_ID,
        dimension="AXLE_LOAD",
        axle_index=1,
        threshold=18000,
    ):
        if rule.axle_config == TANDEM_CONFIGS:
            rule.axle_config = None
            rule.save(update_fields=["axle_config"])


class Migration(migrations.Migration):
    dependencies = [
        ("rules", "0009_update_asumsi_thresholds"),
    ]

    operations = [
        migrations.RunPython(scope, unscope),
    ]
