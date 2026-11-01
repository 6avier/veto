from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from config.throttling import IdentifiedAnonRateThrottle, WriteScopedRateThrottle
from .models import VehicleProfile

MAX_KG = 1_000_000
MAX_MM = 100_000
DIMENSION_KEYS = ("length", "width", "height")


def _invalid(message, field):
    return Response({"error": {"code": "VALIDATION_ERROR", "message": message, "field": field}}, status=status.HTTP_400_BAD_REQUEST)


def _is_int(value, maximum):
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= maximum


def _field_error(body):
    """The first field in body that would not fit its column, as a response.

    Types were never checked, so "abc" for a weight reached IntegerField and
    came back as a 500, and a long name or config was a database error on
    Postgres that SQLite silently accepted.
    """
    if "name" in body and (not isinstance(body["name"], str) or not body["name"].strip() or len(body["name"]) > 255):
        return _invalid("name must be a non-empty string of at most 255 characters", "name")
    if "axle_config" in body and (not isinstance(body["axle_config"], str) or not body["axle_config"].strip() or len(body["axle_config"]) > 20):
        return _invalid("axle_config must be a non-empty string of at most 20 characters", "axle_config")
    if "tare_weight_kg" in body and not _is_int(body["tare_weight_kg"], MAX_KG):
        return _invalid("tare_weight_kg must be a non-negative integer in kilograms", "tare_weight_kg")
    if "max_dimensions_mm" in body:
        dims = body["max_dimensions_mm"]
        if not isinstance(dims, dict):
            return _invalid("max_dimensions_mm must be an object", "max_dimensions_mm")
        for key in DIMENSION_KEYS:
            if key in dims and not _is_int(dims[key], MAX_MM):
                return _invalid(f"max_dimensions_mm.{key} must be a non-negative integer in millimetres", "max_dimensions_mm")
    return None

class VehicleProfileListCreateView(APIView):
    # The list is read on every render of the profiling screen; the create is a
    # deliberate act. They share a URL, not a ceiling.
    throttle_classes = [IdentifiedAnonRateThrottle, WriteScopedRateThrottle]
    throttle_scope = "write"

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
            
        return Response({
            "results": data,
            "total": total
        })
        
    def post(self, request):
        body = request.data
        if not body or not isinstance(body, dict):
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Invalid or empty JSON body"}}, status=status.HTTP_400_BAD_REQUEST)
            
        # Basic validation
        required_fields = ["name", "axle_config", "tare_weight_kg", "max_dimensions_mm"]
        for field in required_fields:
            if field not in body:
                return Response({"error": {"code": "VALIDATION_ERROR", "message": f"{field} is required", "field": field}}, status=status.HTTP_400_BAD_REQUEST)
                
        error = _field_error(body)
        if error:
            return error
        dims = body["max_dimensions_mm"]

        p = VehicleProfile.objects.create(
            name=body["name"].strip(),
            axle_config=body["axle_config"].strip(),
            tare_weight_kg=body["tare_weight_kg"],
            max_length_mm=dims.get("length", 0),
            max_width_mm=dims.get("width", 0),
            max_height_mm=dims.get("height", 0)
        )
        
        return Response({
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
        }, status=status.HTTP_201_CREATED)


class VehicleProfileDetailView(APIView):
    # Every method here changes or removes a profile.
    throttle_scope = "write"

    def patch(self, request, profile_id):
        try:
            p = VehicleProfile.objects.get(profile_id=profile_id)
        except VehicleProfile.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Vehicle profile not found"}}, status=status.HTTP_404_NOT_FOUND)
            
        body = request.data
        if not body or not isinstance(body, dict):
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Invalid or empty JSON body"}}, status=status.HTTP_400_BAD_REQUEST)

        error = _field_error(body)
        if error:
            return error

        if "name" in body: p.name = body["name"].strip()
        if "axle_config" in body: p.axle_config = body["axle_config"].strip()
        if "tare_weight_kg" in body: p.tare_weight_kg = body["tare_weight_kg"]
        if "max_dimensions_mm" in body:
            dims = body["max_dimensions_mm"]
            if "length" in dims: p.max_length_mm = dims["length"]
            if "width" in dims: p.max_width_mm = dims["width"]
            if "height" in dims: p.max_height_mm = dims["height"]
                
        p.save()
        
        return Response({
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
            return Response(status=status.HTTP_204_NO_CONTENT)
        except VehicleProfile.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Vehicle profile not found"}}, status=status.HTTP_404_NOT_FOUND)
