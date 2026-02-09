from models1 import ApplicationCatalog
from services.graphsubtree_service import GraphSubtreeService


class ApplicationCatalogService:

    @staticmethod
    def get_subtree_by_id(app_catalog_id: int, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='ApplicationCatalog',
            match_property="uid",
            match_value=app_catalog_id,
            depth=depth,
            direction=direction
        )

    @staticmethod
    def get_subtree_by_name(app_catalog_name: str, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='ApplicationCatalog',
            match_property="name",
            match_value=app_catalog_name,
            depth=depth,
            direction=direction
        )

    @staticmethod
    def get_all_application_catalogs():
        app_catalogs = ApplicationCatalog.nodes.all()
        return [{"uid": ac.uid, "name": ac.name} for ac in app_catalogs]