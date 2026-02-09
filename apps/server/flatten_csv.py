#!/usr/bin/env python3
"""
Script to flatten the original CSV into a proper row-per-data-element format.
Handles the case where data entities and elements are listed across multiple rows.
"""

import csv
import sys
from typing import Dict, List, Tuple

def flatten_csv(input_file: str, output_file: str) -> None:
    """
    Flatten the original CSV file so each row contains complete hierarchy.
    
    The original file has a structure where:
    - Row 1: Capability, Process with empty Data Entity/Element
    - Row 2: Subprocess, Data Entity with first Data Element
    - Row 3+: Empty Subprocess/Entity, additional Data Elements
    
    This function consolidates them so each row has all the context.
    """
    
    rows_in = []
    # Try multiple encodings for robust reading
    encodings = ['utf-8', 'utf-8-sig', 'cp1252', 'latin-1']
    read_success = False
    for enc in encodings:
        try:
            with open(input_file, 'r', encoding=enc) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    rows_in.append(row)
            read_success = True
            break
        except UnicodeDecodeError:
            rows_in = []
            continue
    if not read_success:
        raise Exception(f"Could not read {input_file} with any supported encoding: {encodings}")
    
    rows_out: List[Dict] = []
    
    # State tracking
    current_capability = ""
    current_process = ""
    current_process_desc = ""
    current_subprocess = ""
    current_subprocess_desc = ""
    current_data_entity = ""
    current_data_entity_desc = ""
    
    for row in rows_in:
        # Update hierarchy level based on what's populated in this row
        cap = row.get('Capability Name', '').strip()
        proc = row.get('Process', '').strip()
        proc_desc = row.get('Process Description', '').strip()
        subprocess = row.get('Sub Process', '').strip()
        subprocess_desc = row.get('Sub-Process Description', '').strip()
        data_entity = row.get('Data Entities', '').strip()
        data_entity_desc = row.get('Data Entity Description', '').strip()
        data_element = row.get('Data Elements', '').strip()
        data_element_desc = row.get('Data Element Description', '').strip()
        
        # Update current context if new values provided
        if cap:
            current_capability = cap
        if proc:
            current_process = proc
        if proc_desc:
            current_process_desc = proc_desc
        if subprocess:
            current_subprocess = subprocess
        if subprocess_desc:
            current_subprocess_desc = subprocess_desc
        if data_entity:
            current_data_entity = data_entity
        if data_entity_desc:
            current_data_entity_desc = data_entity_desc
        
        # If we have a data element (with or without entity), output a row
        if data_element:
            out_row = {
                'Capability Name': current_capability,
                'Process': current_process,
                'Process Description': current_process_desc,
                'Sub Process': current_subprocess,
                'Sub-Process Description': current_subprocess_desc,
                'Data Entity': current_data_entity,
                'Data Entity Description': current_data_entity_desc,
                'Data Element': data_element,
                'Data Element Description': data_element_desc,
            }
            rows_out.append(out_row)
    
    # Write the output CSV
    if rows_out:
        fieldnames = [
            'Capability Name',
            'Process',
            'Process Description',
            'Sub Process',
            'Sub-Process Description',
            'Data Entity',
            'Data Entity Description',
            'Data Element',
            'Data Element Description',
        ]
        
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows_out)
        
        print(f"✓ Flattened CSV created: {output_file}")
        print(f"  Input rows: {len(rows_in)}")
        print(f"  Output rows: {len(rows_out)}")
    else:
        print("✗ No data elements found in input CSV")

if __name__ == '__main__':
    input_path = 'elements.csv'
    output_path = 'elements_fixed.csv'
    
    try:
        flatten_csv(input_path, output_path)
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)
