from django.db import migrations
from django.utils import timezone
from apps.rules.models import RuleDimension, RuleOperator, RuleOrigin, RuleStatus

def forward(apps, schema_editor):
    RulePack = apps.get_model('rules', 'RulePack')
    Rule = apps.get_model('rules', 'Rule')
    
    # 1. Get the central rule pack
    pack, _ = RulePack.objects.get_or_create(
        domain="ODOL",
        origin=RuleOrigin.CENTRAL,
        defaults={
            "version": 1,
            "effective_from": timezone.now()
        }
    )
    
    # 2. Delete the old generic GROSS_WEIGHT rule (25,000 kg without axle config)
    Rule.objects.filter(
        rule_pack=pack, 
        dimension=RuleDimension.GROSS_WEIGHT,
        axle_config__isnull=True
    ).delete()
    
    # 3. Create the new detailed JBI rules based on PP 55/2012
    detailed_rules = [
        {"axle_config": "1.1", "threshold": 12000},
        {"axle_config": "1.2", "threshold": 16000},
        {"axle_config": "1.2.2", "threshold": 24000},  # Assuming Class I/II standard
        {"axle_config": "1.1-2.2", "threshold": 30000},
        {"axle_config": "1.2-2.2", "threshold": 34000},
        {"axle_config": "1.2.2-2.2", "threshold": 40000},
        {"axle_config": "1.2.2-2.2.2", "threshold": 43000},
    ]
    
    for r in detailed_rules:
        Rule.objects.create(
            rule_pack=pack,
            dimension=RuleDimension.GROSS_WEIGHT,
            operator=RuleOperator.LTE,
            threshold=r["threshold"],
            unit="kg",
            axle_config=r["axle_config"],
            axle_index=None,
            legal_citation=f"PP 55/2012 Lampiran II (Konfigurasi {r['axle_config']})",
            status=RuleStatus.ACTIVE
        )

def backward(apps, schema_editor):
    RulePack = apps.get_model('rules', 'RulePack')
    Rule = apps.get_model('rules', 'Rule')
    
    pack = RulePack.objects.filter(domain="ODOL", origin=RuleOrigin.CENTRAL).first()
    if not pack:
        return
        
    # Delete the specific ones
    Rule.objects.filter(
        rule_pack=pack,
        dimension=RuleDimension.GROSS_WEIGHT,
        axle_config__isnull=False
    ).delete()
    
    # Restore the generic one
    Rule.objects.create(
        rule_pack=pack,
        dimension=RuleDimension.GROSS_WEIGHT,
        operator=RuleOperator.LTE,
        threshold=25000,
        unit="kg",
        axle_config=None,
        axle_index=None,
        legal_citation="PP 55/2012 Lampiran JBI (Kelas I)",
        status=RuleStatus.ACTIVE
    )

class Migration(migrations.Migration):
    dependencies = [
        ('rules', '0004_document_file_path'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
