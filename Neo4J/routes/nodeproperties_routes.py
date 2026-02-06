from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional
from models1 import Capability, Process, Subprocess, DataEntity, DataElements

router = APIRouter(prefix="/properties", tags=["Properties"])

# Mapping node names to classes
NODE_CLASSES = {
    'Capability': Capability,
    'Process': Process,
    'Subprocess': Subprocess,
    'DataEntity': DataEntity,
    'DataElements': DataElements,
}

@router.get("/node-properties/{node_name}")
async def get_node_properties(
    node_name: str,
    uid: Optional[int] = Query(None, description="UID of the node instance"),
    name: Optional[str] = Query(None, description="Name of the node instance")
) -> Dict[str, Any]:
    """
    Returns the property values of a node instance identified by uid or name.
    """
    node_class = NODE_CLASSES.get(node_name)
    if not node_class:
        raise HTTPException(status_code=404, detail=f"Node '{node_name}' not found")

    if uid is not None:
        node_instance = node_class.nodes.get_or_none(uid=uid)
    elif name is not None:
        node_instance = node_class.nodes.get_or_none(name=name)
    else:
        raise HTTPException(status_code=400, detail="Either 'uid' or 'name' query parameter must be provided")

    if not node_instance:
        raise HTTPException(status_code=404, detail=f"No instance found for node '{node_name}' with given identifier")

    # Extract property values (exclude relationships)
    properties = {}
    for attr_name, attr_value in node_class.__dict__.items():
        if hasattr(attr_value, "__class__") and attr_value.__class__.__name__.endswith("Property"):
            properties[attr_name] = getattr(node_instance, attr_name)

    return {"node": node_name, "properties": properties}