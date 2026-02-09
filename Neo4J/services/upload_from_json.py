import json
from typing import List, Dict
from services.upload_service import import_capabilities


def import_capabilities_from_file(json_path: str) -> None:
    with open(json_path, 'r') as f:
        data: List[Dict] = json.load(f)
    import_capabilities(data)
    print(f"Import from {json_path} completed successfully.")
