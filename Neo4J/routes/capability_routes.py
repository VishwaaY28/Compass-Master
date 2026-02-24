from fastapi import APIRouter, HTTPException, Query, Path
from typing import Optional
from services.capability_service import CapabilityService
from services.process_service import ProcessService
from services.subprocess_service import SubprocessService
from services.dataentity_service import DataEntityService
from services.dataelement_service import DataElementService
from services.markdown_service import MarkdownService
from services.orgunits_service import OrganizationUnitService
from services.applicationcatalog_service import ApplicationCatalogService

router = APIRouter(prefix="/capability_compass", tags=["CapabilityCompass"])

# Map entity_type string to service class with required methods
SERVICE_MAP = {
    "capability": CapabilityService,
    "process": ProcessService,
    "subprocess": SubprocessService,
    "dataentity": DataEntityService,
    "dataelement": DataElementService,
    "orgunits": OrganizationUnitService,
    "applicationcatalog": ApplicationCatalogService
}

def get_service(entity_type: str):
    service = SERVICE_MAP.get(entity_type.lower())
    if not service:
        raise HTTPException(status_code=400, detail=f"Unknown entity type '{entity_type}'")
    return service


@router.get("/{entity_type}/id/{entity_id}")
def get_subtree_by_id(
    entity_type: str = Path(..., description="Entity type, e.g., capability, process, subprocess"),
    entity_id: int = Path(..., description="Entity UID")
):
    service = get_service(entity_type)
    # Hardcoded direction and depth
    result = service.get_subtree_by_id(entity_id, depth=4, direction='outgoing')
    if not result:
        raise HTTPException(status_code=404, detail=f"{entity_type.title()} or subtree not found")

    return result


@router.get("/{entity_type}/name/")
def get_subtree_by_name(
    entity_type: str = Path(..., description="Entity type, e.g., capability, process, subprocess"),
    name: str = Query(..., description="Entity name")
):
    service = get_service(entity_type)
    # Hardcoded direction and depth
    result = service.get_subtree_by_name(name, depth=4, direction='outgoing')
    if not result:
        raise HTTPException(status_code=404, detail=f"{entity_type.title()} or subtree not found")

    return result


@router.get("/{entity_type}/all")
def get_all_entities(entity_type: str = Path(..., description="Entity type, e.g., capability, process, subprocess")):
    service = get_service(entity_type)
    # Assumes each service has get_all_* method standardized as get_all_entities()
    if hasattr(service, "get_all_entities"):
        return service.get_all_entities()
    elif hasattr(service, "get_all_capabilities") and entity_type.lower() == "capability":
        return service.get_all_capabilities()
    elif hasattr(service, "get_all_subprocesses") and entity_type.lower() == "subprocess":
        return service.get_all_subprocesses()
    elif hasattr(service, "get_all_data_entities") and entity_type.lower() == "dataentity":
        return service.get_all_data_entities()
    elif hasattr(service, "get_all_data_elements") and entity_type.lower() == "dataelement":
        return service.get_all_data_elements()
    elif hasattr(service, "get_all_processes") and entity_type.lower() == "process":
        return service.get_all_processes()
    elif hasattr(service, "get_all_organization_units") and entity_type.lower() == "orgunits":
        return service.get_all_organization_units()
    elif hasattr(service, "get_all_application_catalogs") and entity_type.lower() == "applicationcatalog":
        return service.get_all_application_catalogs()
    else:
        raise HTTPException(status_code=400, detail=f"Service for {entity_type} does not support listing all entities")


@router.delete("/id/{capability_id}")
def delete_capability_by_id(capability_id: int = Path(..., description="Capability UID")):
    """
    Delete a capability by its ID along with all its related subprocesses,
    data entities, and data elements.
    """
    try:
        result = CapabilityService.delete_by_id(capability_id)
        if not result:
            raise HTTPException(status_code=404, detail=f"Capability with ID {capability_id} not found")
        
        return {
            "status": "success",
            "message": f"Capability with ID {capability_id} deleted successfully",
            "capability_id": capability_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete capability: {str(e)}")


@router.delete("/name/{capability_name}")
def delete_capability_by_name(capability_name: str = Path(..., description="Capability name")):
    """
    Delete a capability by its name along with all its related subprocesses,
    data entities, and data elements.
    """
    try:
        result = CapabilityService.delete_by_name(capability_name)
        if not result:
            raise HTTPException(status_code=404, detail=f"Capability with name '{capability_name}' not found")
        
        return {
            "status": "success",
            "message": f"Capability '{capability_name}' deleted successfully",
            "capability_name": capability_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete capability: {str(e)}")