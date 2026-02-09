from typing import Optional, List
from tortoise.transactions import in_transaction
from tortoise.exceptions import DoesNotExist
from database.models import Capability, Process, SubVertical


async def create_capability(name: str, description: str, subvertical_id: Optional[int] = None) -> Capability:
    async with in_transaction():
        subvertical_obj = None
        if subvertical_id is not None:
            try:
                subvertical_obj = await SubVertical.get(id=subvertical_id)
            except DoesNotExist:
                subvertical_obj = None
        cap = await Capability.create(name=name, description=description, subvertical=subvertical_obj)
        return cap


async def fetch_all_capabilities() -> List[Capability]:
    return await Capability.filter(deleted_at=None).prefetch_related('processes', 'processes__subprocesses', 'subvertical', 'subvertical__vertical').all()


async def fetch_by_id(capability_id: int) -> Optional[Capability]:
    try:
        # Ensure subvertical relation is prefetched so `.subvertical` is a model instance
        return await Capability.filter(id=capability_id, deleted_at=None).prefetch_related('subvertical', 'subvertical__vertical').first()
    except DoesNotExist:
        return None


async def update_capability(capability_id: int, name: Optional[str] = None, description: Optional[str] = None, subvertical_id: Optional[int] = None) -> Optional[Capability]:
    obj = await fetch_by_id(capability_id)
    if not obj:
        return None
    if name is not None:
        obj.name = name
    if description is not None:
        obj.description = description
    if subvertical_id is not None:
        try:
            subvert = await SubVertical.get(id=subvertical_id)
            obj.subvertical = subvert
        except DoesNotExist:
            obj.subvertical = None
    await obj.save()
    return obj


async def delete_capability(capability_id: int) -> bool:
    deleted = await Capability.filter(id=capability_id).delete()
    return deleted > 0


async def search_capabilities_by_keywords(keywords: List[str]) -> List[Capability]:
    """
    Search for capabilities that match any of the provided keywords.
    Keywords are matched against capability names and descriptions.
    
    Args:
        keywords: List of search keywords (at least 3 characters each)
    
    Returns:
        List of matching capabilities with prefetched relations
    """
    if not keywords:
        return []
    
    # Build a filter that matches any keyword in name or description
    from tortoise.expressions import Q
    
    query_filter = Q()
    for keyword in keywords:
        query_filter |= Q(name__icontains=keyword) | Q(description__icontains=keyword)
    
    return await Capability.filter(deleted_at=None).filter(query_filter).prefetch_related(
        'processes', 'processes__subprocesses', 'subvertical', 'subvertical__vertical'
    ).all()