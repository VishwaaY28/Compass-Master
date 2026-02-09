from models1 import  Capability
from services.graphsubtree_service import GraphSubtreeService
class CapabilityService:

    @staticmethod
    def get_subtree_by_id(capability_id: int, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='Capability',
            match_property="uid",
            match_value=capability_id,
            depth=depth,
            direction=direction
        )

    @staticmethod
    def get_subtree_by_name(capability_name: str, depth: int = None, direction: str = 'outgoing'):
        return GraphSubtreeService.get_subtree_by_property(
            label='Capability',
            match_property="name",
            match_value=capability_name,
            depth=depth,
            direction=direction
        )

    @staticmethod
    def get_all_capabilities():
        capability = Capability.nodes.all()
        return [{"uid": p.uid, "name": p.name} for p in capability]