from database.models import Vertical, SubVertical


async def fetch_all_verticals():
    """Fetch all verticals from the database"""
    return await Vertical.all()


async def fetch_vertical_by_id(vertical_id: int):
    """Fetch a vertical by ID"""
    return await Vertical.get_or_none(id=vertical_id)


async def create_vertical(name: str):
    """Create a new vertical"""
    return await Vertical.create(name=name)


async def update_vertical(vertical_id: int, name: str):
    """Update a vertical"""
    vertical = await Vertical.get_or_none(id=vertical_id)
    if vertical:
        vertical.name = name
        await vertical.save()
    return vertical


async def delete_vertical(vertical_id: int):
    """Delete a vertical"""
    deleted_count = await Vertical.filter(id=vertical_id).delete()
    return deleted_count > 0


async def fetch_all_subverticals():
    """Fetch all subverticals from the database"""
    return await SubVertical.filter(deleted_at=None).prefetch_related('vertical').all()


async def fetch_subvertical_by_id(subvertical_id: int):
    """Fetch a subvertical by ID"""
    return await SubVertical.filter(id=subvertical_id, deleted_at=None).prefetch_related('vertical').first()


async def fetch_subverticals_by_vertical(vertical_id: int):
    """Fetch all subverticals under a specific vertical"""
    return await SubVertical.filter(vertical_id=vertical_id, deleted_at=None).all()


async def create_subvertical(name: str, vertical_id: int):
    """Create a new subvertical under a vertical"""
    vertical = await Vertical.get_or_none(id=vertical_id)
    if not vertical:
        return None
    return await SubVertical.create(name=name, vertical=vertical)


async def update_subvertical(subvertical_id: int, name: str = None, vertical_id: int = None):
    """Update a subvertical"""
    subvertical = await SubVertical.get_or_none(id=subvertical_id)
    if not subvertical:
        return None
    if name is not None:
        subvertical.name = name
    if vertical_id is not None:
        vertical = await Vertical.get_or_none(id=vertical_id)
        if vertical:
            subvertical.vertical = vertical
    await subvertical.save()
    return subvertical


async def delete_subvertical(subvertical_id: int):
    """Delete a subvertical"""
    deleted_count = await SubVertical.filter(id=subvertical_id).delete()
    return deleted_count > 0


async def seed_default_verticals():
    """Seed default verticals if none exist"""
    existing = await fetch_all_verticals()
    if existing:
        return  # Already seeded

    default_verticals = [
        "Capital Markets",
        "International Financial Institution (IFI)",
        "US Federal Government",
        "Banking"
    ]

    for vertical_name in default_verticals:
        await Vertical.create(name=vertical_name)
