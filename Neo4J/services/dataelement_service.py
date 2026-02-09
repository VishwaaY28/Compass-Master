from neomodel import db, get_config
from models1 import DataElements
from services.graphsubtree_service import GraphSubtreeService
from dotenv import load_dotenv
import os

load_dotenv()

config = get_config()
config.database_url = os.getenv("NEO4J_DATABASE_URL1")


class DataElementService:

    @staticmethod
    def get_subtree_by_id(data_element_id: int, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='DataElements',
            match_property='uid',
            match_value=data_element_id,
            depth=depth,
            direction=direction
        )

    @staticmethod
    def get_subtree_by_name(data_element_name: str, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='DataElements',
            match_property='name',
            match_value=data_element_name,
            depth=depth,
            direction=direction
        )

    @staticmethod
    def get_all_data_elements():
        data_elements = DataElements.nodes.all()
        return [{"uid": de.uid, "name": de.name} for de in data_elements]