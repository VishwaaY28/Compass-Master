from neomodel import db, get_config
from models1 import Subprocess
from services.graphsubtree_service import GraphSubtreeService
from dotenv import load_dotenv
import os

load_dotenv()

config = get_config()
config.database_url = os.getenv("NEO4J_DATABASE_URL1")


class SubprocessService:

    @staticmethod
    def get_subtree_by_id(subprocess_id: int, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='Subprocess',
            match_property='uid',
            match_value=subprocess_id,
            depth=depth,
            direction=direction
        )

    @staticmethod
    def get_subtree_by_name(subprocess_name: str, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='Subprocess',
            match_property='name',
            match_value=subprocess_name,
            depth=depth,
            direction=direction
        )



    @staticmethod
    def get_all_subprocesses():
        subprocesses = Subprocess.nodes.all()
        return [{"uid": sp.uid, "name": sp.name} for sp in subprocesses]