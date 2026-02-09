from typing import List, Dict
from neomodel import db,get_config
from models1 import Capability,Process,Subprocess,DataEntity,DataElements

from dotenv import load_dotenv
import os

load_dotenv()

config = get_config()
config.database_url = os.getenv("NEO4J_DATABASE_URL1")


def get_or_create_node(cls, prop_name, prop_value, **additional_props):
    if not prop_value:
        print(f"Skipping creation: Property '{prop_name}' is empty or missing.")
        return None
    try:
        node = cls.nodes.get(**{prop_name: prop_value})
        print(f"Found existing {cls.__name__} node: {prop_name}={prop_value}")
        return node
    except cls.DoesNotExist:
        props = {prop_name: prop_value}
        props.update(additional_props)
        node = cls(**props).save()
        print(f"Created new {cls.__name__} node: {prop_name}={prop_value}")
        return node
def import_capabilities(data: List[Dict]) -> None:
    for cap_data in data:
        capability = get_or_create_node(Capability, 'uid', cap_data['id'])
        if capability is None:
            continue  # or handle missing uid

        capability.name = cap_data['name']
        capability.description = cap_data.get('description', '')
        capability.vertical = cap_data.get('vertical', '')
        capability.subvertical = cap_data.get('subvertical', '')
        capability.save()

        for proc_data in cap_data.get('processes', []):
            process = get_or_create_node(Process, 'uid', proc_data['id'])
            if process is None:
                continue

            process.name = proc_data['name']
            level_mapping = {'core': 1, 'support': 2, 'management': 3}
            level_val = proc_data.get('level')
            process.level = level_mapping.get(level_val, None) if isinstance(level_val, str) else level_val
            process.description = proc_data.get('description', '')
            process.category = proc_data.get('category', '')
            process.save()

            if not capability.realized_by.is_connected(process):
                capability.realized_by.connect(process)

            for subproc_data in proc_data.get('subprocesses', []):
                subprocess = get_or_create_node(Subprocess, 'uid', subproc_data['id'])
                if subprocess is None:
                    continue

                subprocess.name = subproc_data['name']
                subprocess.description = subproc_data.get('description', '')
                subprocess.category = subproc_data.get('category', '')
                subprocess.save()

                if not process.decomposes.is_connected(subprocess):
                    process.decomposes.connect(subprocess)

                for data_entity_data in subproc_data.get('data_entities', []):
                    data_entity = get_or_create_node(DataEntity, 'uid', data_entity_data['data_entity_id'])
                    if data_entity is None:
                        continue

                    data_entity.name = data_entity_data['data_entity_name']
                    data_entity.data_entity_description = data_entity_data.get('data_entity_description', '')
                    data_entity.save()

                    if not subprocess.uses_data.is_connected(data_entity):
                        subprocess.uses_data.connect(data_entity)

                    for data_element_data in data_entity_data.get('data_elements', []):
                        data_element = get_or_create_node(DataElements, 'uid', data_element_data['data_element_id'])
                        if data_element is None:
                            continue

                        data_element.name = data_element_data['data_element_name']
                        data_element.data_element_description = data_element_data.get('data_element_description', '')
                        data_element.save()

                        if not data_entity.has_element.is_connected(data_element):
                            data_entity.has_element.connect(data_element)

    print("Import completed successfully.")