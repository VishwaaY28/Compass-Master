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

    @staticmethod
    def delete_by_id(capability_id: int):
        """
        Delete a capability by its ID along with all related nodes and relationships.
        """
        try:
            capability = Capability.nodes.get(uid=capability_id)
            # Delete the capability node and all its relationships (cascade delete)
            capability.delete()
            return True
        except Capability.DoesNotExist:
            return False
        except Exception as e:
            raise Exception(f"Error deleting capability: {str(e)}")

    @staticmethod
    def delete_by_name(capability_name: str):
        """
        Delete a capability by its name along with all related nodes and relationships.
        """
        try:
            capability = Capability.nodes.get(name=capability_name)
            # Delete the capability node and all its relationships (cascade delete)
            capability.delete()
            return True
        except Capability.DoesNotExist:
            return False
        except Exception as e:
            raise Exception(f"Error deleting capability: {str(e)}")