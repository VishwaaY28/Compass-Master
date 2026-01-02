from typing import Optional, Dict, Any, List
from tortoise.exceptions import DoesNotExist
from database.models import PromptTemplate, ProcessLevel


async def get_prompt_by_level(process_level: str) -> Optional[PromptTemplate]:
    """Fetch the prompt template for a given process level"""
    try:
        return await PromptTemplate.get(process_level=process_level)
    except DoesNotExist:
        return None


async def get_all_prompts() -> List[PromptTemplate]:
    """Fetch all prompt templates"""
    return await PromptTemplate.all()


async def create_or_update_prompt(process_level: str, prompt: str) -> PromptTemplate:
    """Create or update a prompt template"""
    existing = await get_prompt_by_level(process_level)
    if existing:
        existing.prompt = prompt
        await existing.save()
        return existing
    else:
        return await PromptTemplate.create(process_level=process_level, prompt=prompt)


async def seed_default_prompts():
    """Seed default prompts if none exist"""
    existing = await get_all_prompts()
    if existing:
        return  # Already seeded

    defaults = {
        "enterprise": "Generate enterprise-level processes for the capability '{capability_name}' (Description: {capability_description}) in the {domain} domain. Return ONLY valid JSON with a 'processes' array containing process objects with 'name', 'category', and 'description' fields.",
        "core": "Generate core-level processes for the capability '{capability_name}' (Description: {capability_description}) in the {domain} domain. Return ONLY valid JSON with a 'processes' array containing process objects with 'name', 'category', and 'description' fields.",
        "process": "Generate process-level processes for the capability '{capability_name}' (Description: {capability_description}) in the {domain} domain. Return ONLY valid JSON with a 'processes' array containing process objects with 'name', 'category', and 'description' fields."
    }

    for level, prompt in defaults.items():
        await PromptTemplate.create(process_level=level, prompt=prompt)