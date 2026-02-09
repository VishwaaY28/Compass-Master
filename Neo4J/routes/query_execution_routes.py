from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.query_execution_service import Neo4jService
router = APIRouter()

class CypherQueryRequest(BaseModel):
    query: str

neo4j_service = Neo4jService()

@router.post("/execute-cypher")
async def execute_cypher_query(request: CypherQueryRequest):
    try:
        data = neo4j_service.execute_cypher(request.query)
        return {"results": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))