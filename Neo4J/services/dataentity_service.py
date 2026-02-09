from neomodel import db, get_config
from models1 import Process,DataEntity
from services.graphsubtree_service import GraphSubtreeService
from dotenv import load_dotenv
import os

load_dotenv()

config = get_config()
config.database_url = os.getenv("NEO4J_DATABASE_URL1")

class DataEntityService:

    @staticmethod
    def get_subtree_by_id(data_entity_id: int, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='DataEntity',
            match_property='uid',
            match_value=data_entity_id,
            depth=depth,
            direction=direction
        )

    @staticmethod
    def get_subtree_by_name(data_entity_name: str, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='DataEntity',
            match_property='name',
            match_value=data_entity_name,
            depth=depth,
            direction=direction
        )

    @staticmethod
    def get_all_data_entities():
        data_entities = DataEntity.nodes.all()
        return [{"uid": de.uid, "name": de.name} for de in data_entities]