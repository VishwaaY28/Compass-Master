from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.upload_routes import router as upload_router
from routes.subtree_routes import router as subtree_router
from routes.intent_routes import router as intent_router
from routes.query_execution_routes import router as query_execution_router
app = FastAPI(title="Neo4J Capability API", description="API for managing capabilities, processes, and subprocesses in Neo4j")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Neo4J Capability API",
        "docs": "/docs",
        "endpoints": {
            "subtree": "/subtree/{entity_type}/id/{entity_id}",
            "upload_from_endpoint": "/upload",
            "upload_from_json": "/upload/import_from_file",
            "upload_from_csv": "/upload/import_from_csv",
            "intent_query": "/intent/query",
            "intent_catalog": "/intent/catalog"
        }
    }


app.include_router(upload_router)
app.include_router(subtree_router)
app.include_router(intent_router)
app.include_router(query_execution_router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host='0.0.0.0',
        port=8000,
        reload=True,
    )
