from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from tortoise.contrib.pydantic import pydantic_model_creator
from database.models import Domain, CapabilityName, Process

router = APIRouter()

# Pydantic schemas
Domain_Pydantic = pydantic_model_creator(Domain, name="Domain")
DomainIn_Pydantic = pydantic_model_creator(Domain, name="DomainIn", exclude_readonly=True)

CapabilityName_Pydantic = pydantic_model_creator(CapabilityName, name="CapabilityName")
CapabilityNameIn_Pydantic = pydantic_model_creator(CapabilityName, name="CapabilityNameIn", exclude_readonly=True)

Process_Pydantic = pydantic_model_creator(Process, name="Process")
ProcessIn_Pydantic = pydantic_model_creator(Process, name="ProcessIn", exclude_readonly=True)

# Health check
@router.get("/health")
async def health_check():
    return JSONResponse(
        content={"status": "ok"},
        status_code=200
    )

# CRUD for Domain
@router.post("/domains", response_model=Domain_Pydantic)
async def create_domain(domain: DomainIn_Pydantic):
    obj = await Domain.create(**domain.dict())
    return await Domain_Pydantic.from_tortoise_orm(obj)

@router.get("/domains", response_model=list[Domain_Pydantic])
async def list_domains():
    return await Domain_Pydantic.from_queryset(Domain.all())

@router.get("/domains/{domain_id}", response_model=Domain_Pydantic)
async def get_domain(domain_id: int):
    obj = await Domain.get_or_none(id=domain_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Domain not found")
    return await Domain_Pydantic.from_tortoise_orm(obj)

@router.put("/domains/{domain_id}", response_model=Domain_Pydantic)
async def update_domain(domain_id: int, domain: DomainIn_Pydantic):
    obj = await Domain.get_or_none(id=domain_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Domain not found")
    await obj.update_from_dict(domain.dict())
    await obj.save()
    return await Domain_Pydantic.from_tortoise_orm(obj)

@router.delete("/domains/{domain_id}")
async def delete_domain(domain_id: int):
    deleted = await Domain.filter(id=domain_id).delete()
    if not deleted:
        raise HTTPException(status_code=404, detail="Domain not found")
    return {"deleted": True}

# CRUD for CapabilityName
@router.post("/capabilities", response_model=CapabilityName_Pydantic)
async def create_capability(capability: CapabilityNameIn_Pydantic):
    obj = await CapabilityName.create(**capability.dict())
    return await CapabilityName_Pydantic.from_tortoise_orm(obj)

@router.get("/capabilities", response_model=list[CapabilityName_Pydantic])
async def list_capabilities():
    return await CapabilityName_Pydantic.from_queryset(CapabilityName.all())

@router.get("/capabilities/{capability_id}", response_model=CapabilityName_Pydantic)
async def get_capability(capability_id: int):
    obj = await CapabilityName.get_or_none(id=capability_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Capability not found")
    return await CapabilityName_Pydantic.from_tortoise_orm(obj)

@router.put("/capabilities/{capability_id}", response_model=CapabilityName_Pydantic)
async def update_capability(capability_id: int, capability: CapabilityNameIn_Pydantic):
    obj = await CapabilityName.get_or_none(id=capability_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Capability not found")
    await obj.update_from_dict(capability.dict())
    await obj.save()
    return await CapabilityName_Pydantic.from_tortoise_orm(obj)

@router.delete("/capabilities/{capability_id}")
async def delete_capability(capability_id: int):
    deleted = await CapabilityName.filter(id=capability_id).delete()
    if not deleted:
        raise HTTPException(status_code=404, detail="Capability not found")
    return {"deleted": True}

# CRUD for Process
@router.post("/processes", response_model=Process_Pydantic)
async def create_process(process: ProcessIn_Pydantic):
    obj = await Process.create(**process.dict())
    return await Process_Pydantic.from_tortoise_orm(obj)

@router.get("/processes", response_model=list[Process_Pydantic])
async def list_processes():
    return await Process_Pydantic.from_queryset(Process.all())

@router.get("/processes/{process_id}", response_model=Process_Pydantic)
async def get_process(process_id: int):
    obj = await Process.get_or_none(id=process_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Process not found")
    return await Process_Pydantic.from_tortoise_orm(obj)

@router.put("/processes/{process_id}", response_model=Process_Pydantic)
async def update_process(process_id: int, process: ProcessIn_Pydantic):
    obj = await Process.get_or_none(id=process_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Process not found")
    await obj.update_from_dict(process.dict())
    await obj.save()
    return await Process_Pydantic.from_tortoise_orm(obj)

@router.delete("/processes/{process_id}")
async def delete_process(process_id: int):
    deleted = await Process.filter(id=process_id).delete()
    if not deleted:
        raise HTTPException(status_code=404, detail="Process not found")
    return {"deleted": True}

# Catch-all route
@router.get("/{full_path:path}")
async def catch_all(full_path: str):
    raise HTTPException(
        status_code=404,
        detail=f"Route '{full_path}' not found."
    )