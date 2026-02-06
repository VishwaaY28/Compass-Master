from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from neomodel import db
from thefuzz import process as fuzzy_process
import re

router = APIRouter(prefix="/intent", tags=["Intent NLU"])

INTENT_KEYWORDS = {
    "strategic": ["strategy", "goal", "objective", "plan", "vision"],
    "operational": ["process", "steps", "workflow", "procedure", "operation"],
    "informational": ["what", "how", "describe", "information", "details", "differences"],
    "impact": ["impact", "effect", "influence", "consequence"],
    "technical": ["api", "data entity", "technical", "attribute", "lineage", "id"],
}

PERSONA_KEYWORDS = {
    "executive": ["executive", "ceo", "cfo", "director", "vp", "leader"],
    "manager": ["manager", "supervisor", "team lead", "head"],
    "specialist": ["specialist", "analyst", "engineer", "developer", "architect"],
}


class QueryRequest(BaseModel):
    query: str
    role: Optional[str] = "Specialist"
    vertical: Optional[str] = "Investment Management"


class QueryPlan(BaseModel):
    primary_anchors: List[str]
    intent: str
    persona_tone: str
    depth_scope: int
    is_comparison: bool = False


def get_official_catalog() -> List[str]:
    query = """
    MATCH (n)
    WHERE n:Capability OR n:Process OR n:Subprocess
    RETURN DISTINCT n.name as name
    ORDER BY n.name
    """
    try:
        results, _ = db.cypher_query(query)
        return [r[0] for r in results if r[0]]
    except Exception as e:
        print(f"Error fetching catalog from Neo4j: {e}")
        return []


def extract_intent(user_query: str) -> str:
    query_lower = user_query.lower()
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(keyword in query_lower for keyword in keywords):
            return intent.capitalize()
    return "Informational"


def determine_persona(role: str) -> tuple:
    role_lower = role.lower()
    if "specialist" in role_lower or "architect" in role_lower:
        return "Specialist", 4
    elif "executive" in role_lower or "ceo" in role_lower or "cfo" in role_lower:
        return "Executive", 1
    elif "manager" in role_lower:
        return "Manager", 2
    else:
        return "Manager", 3


def extract_all_anchors(user_query: str, catalog: List[str]) -> List[str]:
    found_anchors = []
    sorted_catalog = sorted(catalog, key=len, reverse=True)
    query_copy = user_query

    for term in sorted_catalog:
        pattern = rf"\b{re.escape(term)}\b"
        if re.search(pattern, query_copy, re.IGNORECASE):
            found_anchors.append(term)
            query_copy = re.sub(pattern, "", query_copy, flags=re.IGNORECASE)

    if not found_anchors:
        matches = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", user_query)
        if matches:
            best_match = max(matches, key=len)
            resolved = fuzzy_process.extractOne(best_match, catalog)
            if resolved and resolved[1] > 85:
                found_anchors.append(resolved[0])

    return list(set(found_anchors))


def fetch_graph_data(anchor: str, depth: int, intent: str) -> Dict[str, Any]:
    depth = min(depth, 5)

    if intent == "Strategic":
        rel_pattern = "ENABLED_BY|ACCOUNTABLE_FOR|REALIZED_BY"
    elif intent == "Operational":
        rel_pattern = "DECOMPOSES|SUPPORTS|REALIZED_BY"
    else:
        rel_pattern = "REALIZED_BY|USES_DATA|DECOMPOSES|HAS_ELEMENT"

    query = f"""
    MATCH (root {{name: $name}})
    OPTIONAL MATCH path = (root)-[:{rel_pattern}*1..{depth}]-(related)
    WITH root, collect(DISTINCT related) as related_nodes, collect(DISTINCT path) as paths
    UNWIND paths as p
    UNWIND relationships(p) as rel
    WITH root, related_nodes, collect(DISTINCT {{
        type: type(rel),
        from_node: startNode(rel).name,
        to_node: endNode(rel).name
    }}) as rels
    RETURN root,
           labels(root) as root_labels,
           related_nodes,
           rels as relationships
    """

    try:
        results, _ = db.cypher_query(query, {'name': anchor})

        if not results or not results[0][0]:
            return {"anchor": anchor, "found": False, "nodes": [], "relationships": []}

        record = results[0]
        root_node = record[0]
        root_labels = record[1]
        related_nodes = record[2] or []
        relationships = record[3] or []

        def format_node(node, labels) -> Dict[str, Any]:
            node_data = {
                "uid": node.get("uid"),
                "name": node.get("name"),
                "labels": labels
            }
            if "Capability" in labels:
                node_data["description"] = node.get("description", "")
                node_data["vertical"] = node.get("vertical", "")
                node_data["subvertical"] = node.get("subvertical", "")
            elif "Process" in labels:
                node_data["description"] = node.get("description", "")
                node_data["level"] = node.get("level")
                node_data["category"] = node.get("category", "")
            elif "Subprocess" in labels:
                node_data["description"] = node.get("description", "")
                node_data["category"] = node.get("category", "")
            elif "DataEntity" in labels:
                node_data["data_entity_description"] = node.get("data_entity_description", "")
            elif "DataElements" in labels:
                node_data["data_element_description"] = node.get("data_element_description", "")
            return node_data

        root_formatted = format_node(root_node, root_labels)

        nodes_formatted = []
        for node in related_nodes:
            node_labels_query = """
            MATCH (n {name: $name})
            RETURN labels(n) as labels
            """
            label_result, _ = db.cypher_query(node_labels_query, {'name': node.get("name")})
            node_labels = label_result[0][0] if label_result else []
            nodes_formatted.append(format_node(node, node_labels))

        return {
            "anchor": anchor,
            "found": True,
            "root": root_formatted,
            "nodes": nodes_formatted,
            "relationships": relationships
        }
    except Exception as e:
        print(f"Error fetching graph data for '{anchor}': {e}")
        return {"anchor": anchor, "found": False, "nodes": [], "relationships": [], "error": str(e)}


def serialize_graph_results(graph_data: List[Dict], plan: QueryPlan) -> str:
    persona = plan.persona_tone
    context_lines = []

    for data in graph_data:
        if not data.get("found"):
            context_lines.append(f"- {data['anchor']}: No data found in graph")
            continue

        root = data.get("root", {})
        context_lines.append(f"\n### {root.get('name', 'Unknown')} ({', '.join(root.get('labels', []))})")

        for node in data.get("nodes", []):
            if persona == "Executive":
                line = f"  - {node.get('name')} ({', '.join(node.get('labels', []))})"
            elif persona == "Manager":
                desc = node.get('description', '')[:100]
                line = f"  - {node.get('name')}: {desc}" if desc else f"  - {node.get('name')}"
            else:
                desc = node.get('description', '')
                labels = ', '.join(node.get('labels', []))
                line = f"  - [{labels}] {node.get('name')}: {desc}"
            context_lines.append(line)

        if persona != "Executive" and data.get("relationships"):
            context_lines.append("\n  Relationships:")
            for rel in data.get("relationships", [])[:10]:
                context_lines.append(f"    - {rel.get('from')} --[{rel.get('type')}]--> {rel.get('to')}")

    return "\n".join(context_lines)


def generate_vmo_response(user_query: str, plan: QueryPlan, graph_context: str, vertical: str) -> str:
    display_anchor = ", ".join(plan.primary_anchors)

    system_message = f"""
### ROLE
You are an expert Enterprise Architecture Consultant for the {vertical} domain. You are the engine of the Virtual Model Office, specialized in synthesizing complex graph data into actionable insights.

### INPUT DATA
The following data has been retrieved from the Enterprise Knowledge Graph:
- USER QUERY: {user_query}
- TARGET PERSONA: {plan.persona_tone} (Executive | Manager | Specialist)
- PRIMARY ANCHOR(S): {display_anchor}
- INTENT CATEGORY: {plan.intent} (Strategic | Operational | Informational | Impact | Technical)
- RETRIEVED GRAPH CONTEXT: 
{graph_context}

### RESPONSE GUIDELINES BY PERSONA
- EXECUTIVE: Focus on "Bottom Line Up Front" (BLUF). Emphasize business value, goals, and high-level capabilities. Avoid technical IDs or deep process nesting.
- MANAGER: Focus on the "How." Detail the relationship between processes and applications. Highlight workflow dependencies and ownership.
- SPECIALIST: Provide maximum fidelity. Cite specific Data Entities, API names, and technical attributes. Be exhaustive in mapping the lineage.

### OPERATIONAL RULES
1. GROUNDING: Use ONLY the provided "RETRIEVED GRAPH CONTEXT". If information is missing, explicitly state: "This information is not available in the current enterprise model."
2. NO FABRICATION: Do not invent processes, applications, or data links that are not present in the context.
3. CITATION: Cite specific entities (e.g., "per the Process-Catalog...") to maintain model integrity.

### STRUCTURE OF RESPONSE
1. TARGET ENTITY: Display "[Target Entity: {display_anchor}]" at the very top.
2. THINKING BLOCK: Provide a <thinking> tag containing your step-by-step reasoning.
3. FINAL ANALYSIS: Provide the response tailored to the Persona.

### SYNTHESIS INSTRUCTION:
1. If RETRIEVED GRAPH CONTEXT contains multiple anchors, perform a side-by-side comparison. 
2. If the TARGET PERSONA is Specialist, incorporate specific Data Element definitions into your narrative.
"""
    return system_message


@router.post("/query")
async def process_intent_query(request: QueryRequest):
    catalog = get_official_catalog()

    if not catalog:
        raise HTTPException(status_code=500, detail="Could not fetch entity catalog from database")

    anchors = extract_all_anchors(request.query, catalog)

    if not anchors:
        suggestions = fuzzy_process.extract(request.query, catalog, limit=3)
        valid_suggestions = [s[0] for s in suggestions if s[1] > 50]
        return {
            "status": "no_match",
            "message": "Could not identify any entities in your query",
            "suggestions": valid_suggestions,
            "catalog_sample": catalog[:10]
        }

    persona, depth = determine_persona(request.role or "Specialist")
    intent = extract_intent(request.query)
    is_comparison = len(anchors) > 1

    plan = QueryPlan(
        primary_anchors=anchors,
        intent=intent,
        persona_tone=persona,
        depth_scope=depth,
        is_comparison=is_comparison
    )

    graph_data = []
    for anchor in anchors:
        data = fetch_graph_data(anchor, depth, intent)
        graph_data.append(data)

    graph_context = serialize_graph_results(graph_data, plan)
    vmo_prompt = generate_vmo_response(request.query, plan, graph_context, request.vertical)

    return {
        "status": "success",
        "query_plan": plan.model_dump(),
        "graph_data": graph_data,
        "graph_context": graph_context,
        "vmo_prompt": vmo_prompt
    }


@router.get("/catalog")
async def get_entity_catalog():
    catalog = get_official_catalog()
    return {
        "count": len(catalog),
        "entities": catalog
    }


@router.post("/resolve")
async def resolve_entity_name(name: str):
    catalog = get_official_catalog()
    matches = fuzzy_process.extract(name, catalog, limit=5)
    return {
        "input": name,
        "matches": [{"name": m[0], "score": m[1]} for m in matches]
    }
