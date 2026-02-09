from database.models import Vertical


async def fetch_all_Verticals():
    """Fetch all Verticals from the database"""
    return await Vertical.all()


async def fetch_Vertical_by_id(Vertical_id: int):
    """Fetch a Vertical by ID"""
    return await Vertical.get_or_none(id=Vertical_id)


async def create_Vertical(name: str):
    """Create a new Vertical"""
    return await Vertical.create(name=name)


async def update_Vertical(Vertical_id: int, name: str):
    """Update a Vertical"""
    Vertical = await Vertical.get_or_none(id=Vertical_id)
    if Vertical:
        Vertical.name = name
        await Vertical.save()
    return Vertical


async def delete_Vertical(Vertical_id: int):
    """Delete a Vertical"""
    deleted_count = await Vertical.filter(id=Vertical_id).delete()
    return deleted_count > 0


async def seed_default_Verticals():
    """Seed default Verticals if none exist"""
    existing = await fetch_all_Verticals()
    if existing:
        return  # Already seeded

    default_Verticals = [
        "Capital Markets",
        "International Financial Institution (IFI)",
        "US Federal Government",
        "Banking"
    ]

    for Vertical_name in default_Verticals:
        await Vertical.create(name=Vertical_name)
