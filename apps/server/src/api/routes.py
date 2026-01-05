import logging
import re
logging.basicConfig(level=logging.INFO)
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from tortoise.contrib.pydantic import pydantic_model_creator

from database.repositories import capability_repository, process_repository, domain_repository, prompt_template_repository
from database.models import Capability as CapabilityModel, Process as ProcessModel, Domain as DomainModel, SubProcess as SubProcessModel
from utils.llm import azure_openai_client
from utils.llm2 import gemini_client
from utils.csv_export import get_csv_exporter
from config.llm_settings import llm_settings_manager
import io
import csv
from fastapi.responses import StreamingResponse

router = APIRouter()
logger = logging.getLogger(__name__)

class LLMProviderRequest(BaseModel):
    provider: str  # "azure", "gemini", or "secure"

class LLMConfigRequest(BaseModel):
    provider: str
    vaultName: str
    temperature: float
    topP: float

class ResearchRequest(BaseModel):
    query: str

@router.post("/capabilities/research")
async def research_capabilities(payload: ResearchRequest):
    """
    Analyze user query using LLM and return relevant capabilities.
    """
    query = payload.query
    # Fetch all capabilities
    capabilities = await capability_repository.fetch_all_capabilities()
    capability_names = [c.name for c in capabilities]

    logger.info(f"[Research] User query: {query}")
    logger.info(f"[Research] Capability names: {capability_names}")
    
    provider = await llm_settings_manager.get_setting("provider", "secure")
    logger.info(f"[Research] Using LLM provider: {provider}")

    # Select LLM client based on current provider
    if provider == "gemini":
        llm_client = gemini_client
    else:
        llm_client = azure_openai_client

    # Use LLM to analyze query and match capabilities
    llm_result = await llm_client.generate_content(
        prompt=f"Given the following capabilities: {capability_names}. Which are most relevant to the user query: '{query}'? Return a JSON object with a 'capabilities' key containing a list of relevant capability names."
    )
    logger.info(f"[Research] LLM raw result: {llm_result}")

    # Extract relevant names from llm_result['data']['capabilities']
    relevant_names = []
    if isinstance(llm_result, dict):
        data = llm_result.get("data", {})
        if isinstance(data, dict):
            relevant_names = data.get("capabilities", [])
        elif isinstance(data, list):
            relevant_names = data
    logger.info(f"[Research] Relevant capability names from LLM: {relevant_names}")

    relevant_caps = [c for c in capabilities if c.name in relevant_names]
    logger.info(f"[Research] Matched capabilities: {[c.name for c in relevant_caps]}")

    result = [
        {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "domain": c.domain.name if getattr(c, 'domain', None) else None,
        }
        for c in relevant_caps
    ]
    logger.info(f"[Research] Response payload: {result}")
    return JSONResponse(result)


Domain_Pydantic = pydantic_model_creator(DomainModel, name="Domain")
Capability_Pydantic = pydantic_model_creator(CapabilityModel, name="Capability")
Process_Pydantic = pydantic_model_creator(ProcessModel, name="Process")


class DomainCreateRequest(BaseModel):
    name: str

class CapabilityCreateRequest(BaseModel):
    name: str
    description: str
    process_id: Optional[int] = None
    domain_id: Optional[int] = None


class SubProcessCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None

class SubProcessCreateRequestWithParent(BaseModel):
    name: str
    description: str
    category: Optional[str] = None
    parent_process_id: int

class ProcessCreateRequest(BaseModel):
    name: str
    level: str
    description: str
    capability_id: Optional[int] = None
    category: Optional[str] = None
    subprocesses: Optional[List[SubProcessCreateRequest]] = None


@router.get("/health")
async def health_check():
    return JSONResponse(content={"status": "ok"}, status_code=200)


# LLM Provider Management
@router.get("/settings/llm-provider")
async def get_llm_provider():
    """Get current LLM provider and configuration"""
    settings = await llm_settings_manager.get_all_settings()
    return JSONResponse(settings)


@router.post("/settings/llm-provider")
async def set_llm_provider(payload: LLMProviderRequest):
    """Set the LLM provider (azure, gemini, or secure)"""
    if payload.provider not in ["azure", "gemini", "secure"]:
        raise HTTPException(status_code=400, detail="Invalid provider. Must be 'azure', 'gemini', or 'secure'")
    settings = await llm_settings_manager.update_settings({"provider": payload.provider})
    logger.info(f"LLM provider changed to: {payload.provider}")
    return JSONResponse({"provider": payload.provider, "message": f"Switched to {payload.provider} LLM"})


@router.post("/settings/llm-config")
async def set_llm_config(payload: LLMConfigRequest):
    """Set the LLM configuration"""
    if payload.provider not in ["azure", "gemini", "secure"]:
        raise HTTPException(status_code=400, detail="Invalid provider. Must be 'azure', 'gemini', or 'secure'")
    
    if not (0 <= payload.temperature <= 1):
        raise HTTPException(status_code=400, detail="Temperature must be between 0 and 1")
    
    if not (0 <= payload.topP <= 1):
        raise HTTPException(status_code=400, detail="Top P must be between 0 and 1")
    
    new_settings = {
        "provider": payload.provider,
        "vaultName": payload.vaultName,
        "temperature": payload.temperature,
        "topP": payload.topP,
    }
    settings = await llm_settings_manager.update_settings(new_settings)
    logger.info(f"LLM configuration updated: {new_settings}")
    
    return JSONResponse({
        "status": "success",
        "message": "LLM configuration updated successfully",
        **settings
    })


@router.get("/settings/prompt-template/{process_level}")
async def get_prompt_template(process_level: str):
    """Get the prompt template for a given process level"""
    # Seed if not exists
    await prompt_template_repository.seed_default_prompts()
    
    prompt_obj = await prompt_template_repository.get_prompt_by_level(process_level)
    if not prompt_obj:
        raise HTTPException(status_code=404, detail=f"No prompt template found for level: {process_level}")
    
    return JSONResponse({"process_level": process_level, "prompt": prompt_obj.prompt})


# CRUD for Domains
@router.post("/domains", response_model=Domain_Pydantic)
async def create_domain(payload: DomainCreateRequest):
    obj = await domain_repository.create_domain(payload.name)
    return await Domain_Pydantic.from_tortoise_orm(obj)


@router.get("/domains", response_model=List[Domain_Pydantic])
async def list_domains():
    # Seed default domains if none exist
    await domain_repository.seed_default_domains()
    
    domains = await domain_repository.fetch_all_domains()
    return await Domain_Pydantic.from_queryset(DomainModel.all())


@router.get("/domains/{domain_id}", response_model=Domain_Pydantic)
async def get_domain(domain_id: int):
    obj = await domain_repository.fetch_domain_by_id(domain_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Domain not found")
    return await Domain_Pydantic.from_tortoise_orm(obj)


@router.put("/domains/{domain_id}", response_model=Domain_Pydantic)
async def update_domain(domain_id: int, payload: DomainCreateRequest):
    obj = await domain_repository.update_domain(domain_id, payload.name)
    if not obj:
        raise HTTPException(status_code=404, detail="Domain not found")
    return await Domain_Pydantic.from_tortoise_orm(obj)


@router.delete("/domains/{domain_id}")
async def delete_domain(domain_id: int):
    ok = await domain_repository.delete_domain(domain_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Domain not found")
    return {"deleted": True}


@router.post("/capabilities", response_model=Capability_Pydantic)
async def create_capability(payload: CapabilityCreateRequest):
    obj = await capability_repository.create_capability(payload.name, payload.description, payload.domain_id)
    return await Capability_Pydantic.from_tortoise_orm(obj)


@router.get("/export/capability/{capability_id}/csv")
async def export_capability_csv(capability_id: int):
    """Export all processes and subprocesses for a capability as CSV."""
    cap = await capability_repository.fetch_by_id(capability_id)
    if not cap:
        raise HTTPException(status_code=404, detail="Capability not found")

    # Fetch processes for this capability
    processes = await ProcessModel.filter(deleted_at=None, capability_id=capability_id).all()

    output = io.StringIO()
    fieldnames = [
        "capability_name",
        "domain",
        "process_type",
        "process_name",
        "process_description",
        "process_category",
        "subprocess_name",
        "subprocess_description",
        "subprocess_category",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    domain_name = cap.domain.name if getattr(cap, 'domain', None) else ""

    for p in processes:
        try:
            subs = await p.subprocesses.all()
        except Exception:
            subs = []

        if not subs:
            writer.writerow({
                "capability_name": cap.name,
                "domain": domain_name,
                "process_type": getattr(p.level, 'value', p.level),
                "process_name": p.name,
                "process_description": p.description or "",
                "process_category": p.category or "",
                "subprocess_name": "",
                "subprocess_description": "",
                "subprocess_category": "",
            })
        else:
            for s in subs:
                writer.writerow({
                    "capability_name": cap.name,
                    "domain": domain_name,
                    "process_type": getattr(p.level, 'value', p.level),
                    "process_name": p.name,
                    "process_description": p.description or "",
                    "process_category": p.category or "",
                    "subprocess_name": s.name,
                    "subprocess_description": s.description or "",
                    "subprocess_category": s.category or "",
                })

    csv_bytes = output.getvalue().encode("utf-8")
    output.close()

    filename = f"capability_{capability_id}_export.csv"
    return StreamingResponse(io.BytesIO(csv_bytes), media_type="text/csv", headers={
        "Content-Disposition": f"attachment; filename=\"{filename}\""
    })


@router.get("/capabilities")
async def list_capabilities():
    caps = await capability_repository.fetch_all_capabilities()
    result = []
    for c in caps:

        try:
            procs = await c.processes.all()
        except Exception:
            procs = []

        proc_list = []
        for p in procs:

            level = getattr(p.level, 'value', p.level)
            
            # Fetch subprocesses for this process
            try:
                subprocs = await p.subprocesses.all()
            except Exception:
                subprocs = []
            
            subprocess_list = [
                {
                    "id": sp.id,
                    "name": sp.name,
                    "description": sp.description,
                    "category": sp.category,
                }
                for sp in subprocs
            ]
            
            proc_list.append({
                "id": p.id,
                "name": p.name,
                "level": level,
                "description": p.description,
                "category": p.category,
                "subprocesses": subprocess_list,
            })

        result.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "domain": c.domain.name if getattr(c, 'domain', None) else None,
            "processes": proc_list,
        })

    return JSONResponse(result)


@router.get("/capabilities/{capability_id}", response_model=Capability_Pydantic)
async def get_capability(capability_id: int):
    obj = await capability_repository.fetch_by_id(capability_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Capability not found")
    return await Capability_Pydantic.from_tortoise_orm(obj)


@router.put("/capabilities/{capability_id}", response_model=Capability_Pydantic)
async def update_capability(capability_id: int, payload: CapabilityCreateRequest):
    obj = await capability_repository.update_capability(capability_id, name=payload.name, description=payload.description, domain_id=payload.domain_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Capability not found")
    return await Capability_Pydantic.from_tortoise_orm(obj)


@router.delete("/capabilities/{capability_id}")
async def delete_capability(capability_id: int):
    ok = await capability_repository.delete_capability(capability_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Capability not found")
    return {"deleted": True}


@router.post("/processes")
async def create_process(payload: ProcessCreateRequest):
    subprocesses_data = []
    if payload.subprocesses:
        subprocesses_data = [
            {"name": sp.name, "description": sp.description or "", "category": sp.category} 
            for sp in payload.subprocesses
        ]
    proc = await process_repository.create_process(
        payload.name,
        payload.level,
        payload.description,
        payload.capability_id,
        subprocesses=subprocesses_data,
        category=payload.category,
    )

    # Load subprocesses to return them immediately so frontend can display
    try:
        subs = await proc.subprocesses.all()
    except Exception:
        subs = []

    subprocess_list = [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "category": getattr(s, "category", None),
        }
        for s in subs
    ]

    level = getattr(proc.level, "value", proc.level)

    result = {
        "id": proc.id,
        "name": proc.name,
        "level": level,
        "description": proc.description,
        "category": getattr(proc, "category", None),
        "subprocesses": subprocess_list,
    }

    return JSONResponse(result)


@router.get("/processes", response_model=List[Process_Pydantic])
async def list_processes(capability_id: Optional[int] = Query(None, alias="capability_id")):

    prots = await process_repository.list_processes(capability_id)

    try:
        return await Process_Pydantic.from_queryset(ProcessModel.filter(deleted_at=None) if capability_id is None else ProcessModel.filter(deleted_at=None, capability_id=capability_id))
    except Exception:
        return [await Process_Pydantic.from_tortoise_orm(p) for p in prots]


@router.get("/processes/{process_id}", response_model=Process_Pydantic)
async def get_process(process_id: int):
    obj = await process_repository.fetch_process_by_id(process_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Process not found")
    return await Process_Pydantic.from_tortoise_orm(obj)


@router.put("/processes/{process_id}", response_model=Process_Pydantic)
async def update_process(process_id: int, payload: ProcessCreateRequest):
    obj = await process_repository.update_process(process_id, name=payload.name, level=payload.level, description=payload.description)
    if not obj:
        raise HTTPException(status_code=404, detail="Process not found")
    return await Process_Pydantic.from_tortoise_orm(obj)


@router.delete("/processes/{process_id}")
async def delete_process(process_id: int):
    ok = await process_repository.delete_process(process_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Process not found")
    return {"deleted": True}


@router.post("/subprocesses")
async def create_subprocess(payload: SubProcessCreateRequestWithParent):
    """Create a new subprocess for a given parent process"""
    from database.models import Process as ProcessModel, SubProcess as SubProcessModel
    
    # Get the parent process
    try:
        parent_process = await ProcessModel.get(id=payload.parent_process_id, deleted_at=None)
    except Exception:
        raise HTTPException(status_code=404, detail="Parent process not found")
    
    # Create the subprocess
    subproc = await SubProcessModel.create(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        process=parent_process
    )
    
    result = {
        "id": subproc.id,
        "name": subproc.name,
        "level": "subprocess",
        "description": subproc.description,
        "category": getattr(subproc, "category", None),
        "parent_process_id": payload.parent_process_id,
    }
    
    return JSONResponse(result)


class GenerateProcessRequest(BaseModel):
    capability_name: str
    capability_id: int
    capability_description: Optional[str] = None
    domain: str
    process_type: str
    prompt: str


@router.post("/processes/generate")
async def generate_processes(payload: GenerateProcessRequest):
    """Generate processes using LLM and save them to the database"""
    try:
        logger.info(f"/processes/generate called with payload: capability_name={payload.capability_name}, capability_id={payload.capability_id}, domain={payload.domain}, process_type={payload.process_type}")
        
        provider = await llm_settings_manager.get_setting("provider", "secure")
        logger.info(f"Using LLM provider: {provider}")
        
        
        if provider == "gemini":
            llm_client = gemini_client
        else:
            llm_client = azure_openai_client
        
        
        logger.info(f"Calling {provider} LLM client.generate_processes...")
        print(f"[DEBUG] /processes/generate payload: capability_name={payload.capability_name}, capability_id={payload.capability_id}, domain={payload.domain}, process_type={payload.process_type}, capability_description={payload.capability_description}")
        try:
            llm_result = await llm_client.generate_processes(
                payload.capability_name, 
                payload.capability_description or "", 
                payload.domain, 
                payload.process_type,
                payload.prompt
            )
            logger.info(f"LLM returned: {llm_result}")
            print(f"[DEBUG] LLM returned: {llm_result}")
        except Exception as e:

            logger.exception("LLM call failed")
            print(f"[DEBUG] LLM call failed: {e}")
            raise HTTPException(status_code=500, detail=f"LLM call failed: {str(e)}")
        
        if llm_result.get("status") != "success":
            raise HTTPException(status_code=500, detail="Failed to generate processes from LLM")
        
        generated_data = llm_result.get("data", {})
        
        logger.info(f"[DEBUG] generated_data type: {type(generated_data)}")
        logger.info(f"[DEBUG] generated_data keys: {list(generated_data.keys()) if isinstance(generated_data, dict) else 'not a dict'}")
        logger.info(f"[DEBUG] generated_data content: {str(generated_data)[:500]}")

        # Verify capability exists (just for validation; we don't persist yet)
        capability = await capability_repository.fetch_by_id(payload.capability_id)
        if not capability:
            raise HTTPException(status_code=404, detail="Capability not found")
        
        # Save LLM response to CSV file
        try:
            csv_exporter = get_csv_exporter()
            csv_filepath = csv_exporter.export_process_generation(
                capability_name=payload.capability_name,
                domain=payload.domain,
                process_type=payload.process_type,
                generated_data=generated_data,
                provider=provider,
            )
            logger.info(f"LLM response saved to CSV: {csv_filepath}")
        except Exception as e:
            logger.error(f"Failed to save LLM response to CSV: {str(e)}")
            # Don't fail the entire request if CSV export fails, just log it
        
        # Return the LLM-generated data directly without restrictive parsing
        # The LLM is already given process_type constraint, so let it generate freely
        
        return {
            "status": "success",
            "message": f"Generated processes for {payload.capability_name}",
            "processes": [],
            "data": generated_data,
            "process_type": payload.process_type or 'core',
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating processes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate processes: {str(e)}")


