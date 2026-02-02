import os
from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()  # loads variables from .env into environment variables

class Neo4jService:
    def __init__(self):
        uri = os.getenv("NEO4J_URI")
        user = os.getenv("NEO4J_USERNAME")
        password = os.getenv("NEO4J_PASSWORD")
        if not uri or not user or not password:
            raise ValueError("Neo4j connection details are not set in environment variables.")
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def execute_cypher(self, query: str):
        with self.driver.session() as session:
            result = session.run(query)
            return [record.data() for record in result]