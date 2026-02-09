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

router = APIRouter(prefix="/subtree", tags=["Subtree"])

# Map entity_type string to service class with required methods
SERVICE_MAP = {
    "capability": CapabilityService,
    "process": ProcessService,
    "subprocess": SubprocessService,
    "dataentity": DataEntityService,
    "dataelement": DataElementService,
    "orgunits":OrganizationUnitService,
    "applicationcatalog":ApplicationCatalogService
}

def get_service(entity_type: str):
    service = SERVICE_MAP.get(entity_type.lower())
    if not service:
        raise HTTPException(status_code=400, detail=f"Unknown entity type '{entity_type}'")
    return service


@router.get("/{entity_type}/id/{entity_id}")
def get_subtree_by_id(
    entity_type: str = Path(..., description="Entity type, e.g., capability, process, subprocess"),
    entity_id: int = Path(..., description="Entity UID"),
    depth: Optional[int] = Query(None, description="Max traversal depth"),
    direction: Optional[str] = Query('outgoing', description="Traversal direction: outgoing, incoming, both"),
    save_md: Optional[bool] = Query(False, description="Save subtree as markdown file")
):
    service = get_service(entity_type)
    # Use the generic method with depth and direction support
    result = service.get_subtree_by_id(entity_id, depth=depth, direction=direction)
    if not result:
        raise HTTPException(status_code=404, detail=f"{entity_type.title()} or subtree not found")

    # Result assumed to be a dict with nodes, relationships, etc.
    # You may adapt this depending on your service implementation
    if save_md:
        try:
            markdown_str = MarkdownService.generate_markdown_with_template(result)
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=str(e))

        filename = f"{entity_type}_{entity_id}_tree.md"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(markdown_str)

        return {
            "tree_markdown": markdown_str,
            "message": f"{entity_type.title()} tree saved to {filename}"
        }

    return result


@router.get("/{entity_type}/name/")
def get_subtree_by_name(
    entity_type: str = Path(..., description="Entity type, e.g., capability, process, subprocess"),
    name: str = Query(..., description="Entity name"),
    depth: Optional[int] = Query(None, description="Max traversal depth"),
    direction: Optional[str] = Query('outgoing', description="Traversal direction: outgoing, incoming, both"),
    save_md: Optional[bool] = Query(False, description="Save subtree as markdown file")
):
    service = get_service(entity_type)
    result = service.get_subtree_by_name(name, depth=depth, direction=direction)
    if not result:
        raise HTTPException(status_code=404, detail=f"{entity_type.title()} or subtree not found")

    if save_md:
        try:
            markdown_str = MarkdownService.generate_markdown_with_template(result)
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=str(e))

        safe_name = name.replace(" ", "_")
        filename = f"{entity_type}_{safe_name}_tree.md"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(markdown_str)

        return {
            "tree_markdown": markdown_str,
            "message": f"{entity_type.title()} tree saved to {filename}"
        }

    return result


@router.get("/{entity_type}/all")
def get_all_entities(entity_type: str = Path(..., description="Entity type, e.g., capability, process, subprocess")):
    service = get_service(entity_type)
    # Assumes each service has get_all_* method standardized as get_all_entities()
    # If your services have different method names, you may need to adapt this
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
    elif hasattr(service, "get_all_orgunits") and entity_type.lower() == "orgunits":
        return service.get_all_organization_units()
    elif hasattr(service, "get_all_application_catalogs") and entity_type.lower() == "applicationcatalog":
        return service.get_all_application_catalogs()
    else:
        raise HTTPException(status_code=400, detail=f"Service for {entity_type} does not support listing all entities")