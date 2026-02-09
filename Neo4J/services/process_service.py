from neomodel import db, get_config
from models1 import Process
from services.graphsubtree_service import GraphSubtreeService
from dotenv import load_dotenv
import os

load_dotenv()

config = get_config()
config.database_url = os.getenv("NEO4J_DATABASE_URL1")


class ProcessService:

    @staticmethod
    def get_subtree_by_id(process_id: int, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='Process',
            match_property='uid',
            match_value=process_id,
            depth=depth,
            direction=direction
        )

    @staticmethod
    def get_subtree_by_name(process_name: str, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='Process',
            match_property='name',
            match_value=process_name,
            depth=depth,
            direction=direction
        )


    @staticmethod
    def get_all_processes():
        processes = Process.nodes.all()
        return [{"uid": p.uid, "name": p.name} for p in processes]