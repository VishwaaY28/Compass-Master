import json
from typing import List, Dict
from models1 import Capability, Process, Subprocess, DataEntity, DataElements, OrganizationUnit

def get_or_create_node(cls, prop_name, prop_value, **additional_props):
    if not prop_value:
        return None
    try:
        node = cls.nodes.get(**{prop_name: prop_value})
        return node
    except cls.DoesNotExist:
        props = {prop_name: prop_value}
        props.update(additional_props)
        node = cls(**props).save()
        return node

def import_capabilities_from_file(json_path: str) -> None:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    capabilities = data.get("capabilities", [])

    for cap_data in capabilities:
        capability = get_or_create_node(Capability, "uid", cap_data["uid"])
        if capability is None:
            continue

        capability.name = cap_data.get("name", "")
        capability.description = cap_data.get("description", "")
        capability.vertical = cap_data.get("vertical", "")
        capability.subvertical = cap_data.get("subvertical", "")
        capability.save()

        # Accountable organization units
        org_units = cap_data.get("accountable_organization_units", [])
        for ou_name in org_units:
            ou = get_or_create_node(OrganizationUnit, "name", ou_name)
            if ou and not capability.accountable_for.is_connected(ou):
                capability.accountable_for.connect(ou)

        for proc_data in cap_data.get("realized_by", []):
            process = get_or_create_node(Process, "uid", proc_data["uid"])
            if process is None:
                continue

            process.name = proc_data.get("name", "")
            process.level = proc_data.get("level")
            process.description = proc_data.get("description", "")
            process.category = proc_data.get("category", "")
            process.save()

            if not capability.realized_by.is_connected(process):
                capability.realized_by.connect(process)

            for subproc_data in proc_data.get("decomposes", []):
                subprocess = get_or_create_node(Subprocess, "uid", subproc_data["uid"])
                if subprocess is None:
                    continue

                subprocess.name = subproc_data.get("name", "")
                subprocess.description = subproc_data.get("description", "")
                subprocess.category = subproc_data.get("category", "")
                subprocess.save()

                if not process.decomposes.is_connected(subprocess):
                    process.decomposes.connect(subprocess)

                for data_entity_data in subproc_data.get("uses_data", []):
                    data_entity = get_or_create_node(DataEntity, "uid", data_entity_data["uid"])
                    if data_entity is None:
                        continue

                    data_entity.name = data_entity_data.get("name", "")
                    data_entity.data_entity_description = data_entity_data.get("data_entity_description", "")
                    data_entity.save()

                    if not subprocess.uses_data.is_connected(data_entity):
                        subprocess.uses_data.connect(data_entity)

                    for data_element_data in data_entity_data.get("has_elements", []):
                        data_element = get_or_create_node(DataElements, "uid", data_element_data["uid"])
                        if data_element is None:
                            continue

                        data_element.name = data_element_data.get("name", "")
                        data_element.data_element_description = data_element_data.get("data_element_description", "")
                        data_element.save()

                        if not data_entity.has_element.is_connected(data_element):
                            data_entity.has_element.connect(data_element)

    print("Import from file completed successfully.")