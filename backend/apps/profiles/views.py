import json
from django.views import View
from django.http import JsonResponse
from .models import VehicleProfile

class VehicleProfileListCreateView(View):
    def get(self, request):
        queryset = VehicleProfile.objects.all()
        
        # Pagination
        try:
            limit = int(request.GET.get('limit', 50))
            if limit > 100: limit = 100
            elif limit < 1: limit = 50
        except ValueError:
            limit = 50
            
        try:
            offset = int(request.GET.get('offset', 0))
            if offset < 0: offset = 0
        except ValueError:
            offset = 0
            
        total = queryset.count()
        results = queryset[offset:offset+limit]
        
        data = []
        for p in results:
            data.append({
                "profile_id": str(p.profile_id),
                "name": p.name,
                "axle_config": p.axle_config,
                "axle_count": p.axle_count,
                "tare_weight_kg": p.tare_weight_kg,
                "max_dimensions_mm": {
                    "length": p.max_length_mm,
                    "width": p.max_width_mm,
                    "height": p.max_height_mm
                }
            })
            
        return JsonResponse({
            "results": data,
            "total": total
        })
        
    def post(self, request):
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": {"code": "VALIDATION_ERROR", "message": "Invalid JSON body"}}, status=400)
            
        # Basic validation
        required_fields = ["name", "axle_config", "tare_weight_kg", "max_dimensions_mm"]
        for field in required_fields:
            if field not in body:
                return JsonResponse({"error": {"code": "VALIDATION_ERROR", "message": f"{field} is required", "field": field}}, status=400)
                
        dims = body["max_dimensions_mm"]
        if not isinstance(dims, dict):
            return JsonResponse({"error": {"code": "VALIDATION_ERROR", "message": "max_dimensions_mm must be an object", "field": "max_dimensions_mm"}}, status=400)
            
        p = VehicleProfile.objects.create(
            name=body["name"],
            axle_config=body["axle_config"],
            tare_weight_kg=body["tare_weight_kg"],
            max_length_mm=dims.get("length", 0),
            max_width_mm=dims.get("width", 0),
            max_height_mm=dims.get("height", 0)
        )
        
        return JsonResponse({
            "profile_id": str(p.profile_id),
            "name": p.name,
            "axle_config": p.axle_config,
            "axle_count": p.axle_count,
            "tare_weight_kg": p.tare_weight_kg,
            "max_dimensions_mm": {
                "length": p.max_length_mm,
                "width": p.max_width_mm,
                "height": p.max_height_mm
            }
        }, status=201)


class VehicleProfileDetailView(View):
    def patch(self, request, profile_id):
        try:
            p = VehicleProfile.objects.get(profile_id=profile_id)
        except VehicleProfile.DoesNotExist:
            return JsonResponse({"error": {"code": "NOT_FOUND", "message": "Vehicle profile not found"}}, status=404)
            
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": {"code": "VALIDATION_ERROR", "message": "Invalid JSON body"}}, status=400)
            
        if "name" in body: p.name = body["name"]
        if "axle_config" in body: p.axle_config = body["axle_config"]
        if "tare_weight_kg" in body: p.tare_weight_kg = body["tare_weight_kg"]
        if "max_dimensions_mm" in body:
            dims = body["max_dimensions_mm"]
            if isinstance(dims, dict):
                if "length" in dims: p.max_length_mm = dims["length"]
                if "width" in dims: p.max_width_mm = dims["width"]
                if "height" in dims: p.max_height_mm = dims["height"]
                
        p.save()
        
        return JsonResponse({
            "profile_id": str(p.profile_id),
            "name": p.name,
            "axle_config": p.axle_config,
            "axle_count": p.axle_count,
            "tare_weight_kg": p.tare_weight_kg,
            "max_dimensions_mm": {
                "length": p.max_length_mm,
                "width": p.max_width_mm,
                "height": p.max_height_mm
            }
        })
        
    def delete(self, request, profile_id):
        try:
            p = VehicleProfile.objects.get(profile_id=profile_id)
            p.delete()
            # Django JsonResponse doesn't support 204 well, use HttpResponse
            from django.http import HttpResponse
            return HttpResponse(status=204)
        except VehicleProfile.DoesNotExist:
            return JsonResponse({"error": {"code": "NOT_FOUND", "message": "Vehicle profile not found"}}, status=404)
