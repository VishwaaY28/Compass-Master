from tortoise import Tortoise
from config.env import env

async def init_db():
    await Tortoise.init(
        db_url=env["DB_URL"],
        modules={"models": ["database.models"]},
        _create_db=True,
    )
    await Tortoise.generate_schemas()

async def close_db():
    await Tortoise.close_connections()
