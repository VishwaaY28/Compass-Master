from fastapi import APIRouter, HTTPException
import requests
from services.upload_service import import_capabilities
from services.upload_from_json import import_capabilities_from_file
from services.csv_parser_service import import_csv_to_neo4j

router = APIRouter(prefix="/upload", tags=["Upload"])

HARDCODED_ENDPOINT = "http://10.4.16.28:8501/api/capabilities"


@router.get("/")
def import_fixed_endpoint():
    """Import capabilities from hardcoded CSV endpoint"""
    try:
        response = requests.get(HARDCODED_ENDPOINT)
        response.raise_for_status()
        data = response.json()

        import_capabilities(data)

        return {
            "status": "success",
            "message": f"Data imported successfully from {HARDCODED_ENDPOINT}"
        }

    except requests.HTTPError as e:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Failed to fetch data: {response.text}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.post("/import_from_json")
def import_from_file():
    """Import capabilities from JSON file in data folder"""
    try:
        json_path = "data/full_capabilities_tree.json"
        import_capabilities_from_file(json_path)
        return {"status": "success", "message": f"Data imported from {json_path} successfully."}
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"JSON file not found at {json_path}. Please ensure the file exists in the data folder."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import_from_csv")
def import_from_csv():
    """Import capabilities from CSV file - parses flat CSV into nested structure"""
    try:
        csv_path = "Capability_Compass.csv"
        stats = import_csv_to_neo4j(csv_path)
        return {
            "status": "success",
            "message": f"Data imported from {csv_path} successfully.",
            "stats": stats
        }
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"CSV file not found at {csv_path}. Please ensure the file exists."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
