from neomodel import db

class GraphSubtreeService:

    @staticmethod
    def get_subtree_by_property(
        label: str,
        match_property: str,
        match_value,
        depth: int = None,
        direction: str = 'outgoing',
        rel_types: list = None
    ):
        # Normalize direction input
        direction_map = {
            'out': 'outgoing',
            'in': 'incoming',
            'both': 'both',
            'outgoing': 'outgoing',
            'incoming': 'incoming'
        }
        direction_norm = direction_map.get(direction.lower())
        if direction_norm is None:
            raise ValueError("Direction must be one of 'outgoing', 'incoming', 'both' or 'out', 'in', 'both'")

        # Build depth range for Cypher
        depth_str = f'*1..{depth}' if depth is not None else '*'

        # Build relationship types filter
        if rel_types:
            rel_types_str = '|'.join(rel_types)
            rel_filter = f":{rel_types_str}"
        else:
            rel_filter = ''

        # Relationship pattern based on normalized direction
        if direction_norm == 'outgoing':
            rel_pattern = f'-[{rel_filter}{depth_str}]->'
        elif direction_norm == 'incoming':
            rel_pattern = f'<-[{rel_filter}{depth_str}]-'
        else:  # both
            rel_pattern = f'-[{rel_filter}{depth_str}]-'

        query = f"""
MATCH (root:{label} {{{match_property}: $value}})
OPTIONAL MATCH path = (root){rel_pattern}(x)
WITH collect(path) AS paths
UNWIND paths AS p
UNWIND nodes(p) AS nd
UNWIND relationships(p) AS rel
RETURN DISTINCT nd, rel, length(p) AS depth;
        """
        print(query)
        results, _ = db.cypher_query(query, {'value': match_value})

        # First get the root node - it must exist even if there are no paths
        root_query = f"""
        MATCH (root:{label} {{{match_property}: $value}})
        RETURN root
        """
        root_results, _ = db.cypher_query(root_query, {'value': match_value})
        if not root_results:
            return None
        root_node = root_results[0][0]
        root_id = root_node.id

        nodes_map = {
            root_id: {
                "internal_id": root_id,
                "uid": root_node.get("uid"),
                "labels": list(root_node.labels),
                "properties": dict(root_node)
            }
        }
        node_depths = {root_id: 0}
        max_depth = 0

        relationships_map = {}

        for record in results:
            node = record[0]
            rel = record[1]
            depth_val = record[2]

            if depth_val > max_depth:
                max_depth = depth_val

            node_id = node.id
            if node_id not in nodes_map:
                nodes_map[node_id] = {
                    "internal_id": node_id,
                    "uid": node.get("uid"),
                    "labels": list(node.labels),
                    "properties": dict(node)
                }
                node_depths[node_id] = depth_val
            else:
                if depth_val < node_depths[node_id]:
                    node_depths[node_id] = depth_val

            if rel is not None:
                rel_id = rel.id
                if rel_id not in relationships_map:
                    relationships_map[rel_id] = {
                        "id": rel_id,
                        "type": rel.type,
                        "start_node_id": rel.start_node.id,
                        "end_node_id": rel.end_node.id,
                        "properties": dict(rel)
                    }
            print("NODE FOUND:", node.id, node.get('uid'))

        # Build nested structure here
        children_map = {}
        for rel in relationships_map.values():
            start_id = rel['start_node_id']
            end_id = rel['end_node_id']
            rel_type = rel['type']

            if direction_norm == 'incoming':
                # Reverse parent-child for incoming direction
                parent_id, child_id = end_id, start_id
            else:
                parent_id, child_id = start_id, end_id

            if parent_id not in children_map:
                children_map[parent_id] = {}
            if rel_type not in children_map[parent_id]:
                children_map[parent_id][rel_type] = []
            children_map[parent_id][rel_type].append(child_id)

        def build_node(node_id):
            node = nodes_map.get(node_id)
            if not node:
                return None

            node_data = {
                "internal_id": node["internal_id"],
                "labels": node["labels"],
                "properties": node["properties"],
            }

            rels = children_map.get(node_id)
            if rels:
                node_data["relationships"] = {}
                for rel_type, child_ids in rels.items():
                    node_data["relationships"][rel_type] = []
                    for child_id in child_ids:
                        child_node = build_node(child_id)
                        if child_node:
                            node_data["relationships"][rel_type].append(child_node)

            return node_data

        nested_tree = build_node(root_id)

        return {
            "root": nested_tree,
            "node_depths": node_depths,
            "max_depth": max_depth
        }