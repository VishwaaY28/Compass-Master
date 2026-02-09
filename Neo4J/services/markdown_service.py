
from services.capability_service import CapabilityService
import os

class MarkdownService:
    @staticmethod
    def _format_tree_as_markdown(capability_dict, node_depths=None, relationships_map=None, level=0):
        indent = '  ' * level
        lines = []

        # Print Capability node with depth info if available
        cap_name = capability_dict.get('name', 'Unnamed Capability')
        cap_id = capability_dict.get('id', 'N/A')
        depth_info = f" (depth: {node_depths.get(cap_id, 0)})" if node_depths else ""
        lines.append(f"{indent}- [Capability] {cap_name}{depth_info}")

        # Helper to recursively format processes and children with depth and direction
        def format_process(process, level):
            indent = '  ' * level
            proc_name = process.get('name', 'Unnamed Process')
            proc_id = process.get('id', None)
            depth_info = f" (depth: {node_depths.get(proc_id, '?')})" if node_depths else ""
            lines.append(f"{indent}- [Process] {proc_name}{depth_info}")

            for subprocess in process.get('subprocesses', []):
                format_subprocess(subprocess, level + 1)

        def format_subprocess(subprocess, level):
            indent = '  ' * level
            sp_name = subprocess.get('name', 'Unnamed Subprocess')
            sp_id = subprocess.get('id', None)
            depth_info = f" (depth: {node_depths.get(sp_id, '?')})" if node_depths else ""
            lines.append(f"{indent}- [Subprocess] {sp_name}{depth_info}")

            for data_entity in subprocess.get('data_entities', []):
                format_data_entity(data_entity, level + 1)

        def format_data_entity(data_entity, level):
            indent = '  ' * level
            de_name = data_entity.get('data_entity_name', 'Unnamed DataEntity')
            de_id = data_entity.get('data_entity_id', None)
            depth_info = f" (depth: {node_depths.get(de_id, '?')})" if node_depths else ""
            lines.append(f"{indent}- [DataEntity] {de_name}{depth_info}")

            for data_element in data_entity.get('data_elements', []):
                format_data_element(data_element, level + 1)

        def format_data_element(data_element, level):
            indent = '  ' * level
            dle_name = data_element.get('data_element_name', 'Unnamed DataElement')
            dle_id = data_element.get('data_element_id', None)
            depth_info = f" (depth: {node_depths.get(dle_id, '?')})" if node_depths else ""
            lines.append(f"{indent}- [DataElement] {dle_name}{depth_info}")

        for process in capability_dict.get('processes', []):
            format_process(process, level + 1)

        return '\n'.join(lines)

    @staticmethod
    def save_capability_tree_markdown(match_property, match_value, filename):
        result = CapabilityService._get_subtree(match_property, match_value)
        if not result:
            print("No capability subtree found.")
            return

        capability_tree, node_depths, max_depth = result

        markdown_content = MarkdownService._format_tree_as_markdown(capability_tree, node_depths=node_depths)

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(markdown_content)

        print(f"Capability tree saved to {filename}")

    @staticmethod
    def generate_markdown_with_template(capability_dict, template_path='template.md', node_depths=None):
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Markdown template file '{template_path}' not found.")

        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()

        max_depth = max(node_depths.values()) if node_depths else 0

        overview = f"**Capability Name:** {capability_dict.get('name', 'Unnamed')}\n"
        overview += f"**ID:** {capability_dict.get('id', 'N/A')}\n"
        overview += f"**Number of Processes:** {len(capability_dict.get('processes', []))}\n"
        overview += f"**Number of SubProcesses:** {len(capability_dict.get('subprocesses', []))}\n"
        overview += f"**Maximum Depth Reached:** {max_depth}\n"

        # Generate tree structure markdown with depth info if provided
        tree_structure = MarkdownService._format_tree_as_markdown(capability_dict)

        output_md = template_content.replace('<!-- CAPABILITY_OVERVIEW -->', overview)
        output_md = output_md.replace('<!-- TREE_STRUCTURE -->', tree_structure)

        return output_md