from models1 import OrganizationUnit
from services.graphsubtree_service import GraphSubtreeService

class OrganizationUnitService:

    @staticmethod
    def get_subtree_by_id(org_unit_id: int, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='OrganizationUnit',
            match_property="uid",
            match_value=org_unit_id,
            depth=depth,
            direction=direction
        )

    @staticmethod
    def get_subtree_by_name(org_unit_name: str, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='OrganizationUnit',
            match_property="name",
            match_value=org_unit_name,
            depth=depth,
            direction=direction
        )

    @staticmethod
    def get_all_organization_units():
        org_units = OrganizationUnit.nodes.all()
        return [{"uid": ou.uid, "name": ou.name} for ou in org_units]


