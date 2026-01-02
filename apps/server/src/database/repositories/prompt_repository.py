from typing import List, Optional
from database.models import PromptTemplate, ProcessLevel

async def create_prompt_template(process_level: ProcessLevel, prompt: str) -> PromptTemplate:
    return await PromptTemplate.create(
        process_level=process_level,
        prompt=prompt
    )

async def get_prompt_template_by_process_level(process_level: ProcessLevel) -> Optional[PromptTemplate]:
    return await PromptTemplate.get_or_none(process_level=process_level)

async def get_prompt_template_by_id(prompt_id: int) -> Optional[PromptTemplate]:
    return await PromptTemplate.get_or_none(id=prompt_id)

async def get_all_prompt_templates() -> List[PromptTemplate]:
    return await PromptTemplate.all()

async def update_prompt_template(prompt_id: int, prompt_text: str) -> Optional[PromptTemplate]:
    prompt_obj = await PromptTemplate.get_or_none(id=prompt_id)
    if prompt_obj:
        prompt_obj.prompt = prompt_text
        await prompt_obj.save()
    return prompt_obj
