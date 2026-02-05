import csv
import os
import logging
from pathlib import Path
from tortoise import Tortoise
from database.models import Vertical, SubVertical, Capability, Process, ProcessLevel, SubProcess, DataEntity, DataElement

logger = logging.getLogger(__name__)

async def seed_database():
    """Seed the database with PE capability data from CSV
    
    Automatically detects and handles these optional columns:
    - Vertical / Domain
    - Sub-Vertical / SubVertical / Sub Vertical
    - Capability / Capability Name
    - Capability Description / Capability Desc
    - Organization Units / Org Units / org_units
    - Process / Process Name
    - Process Description / Process Desc
    - Process Level / Level
    - Process Category / Category / Office Type
    - Sub-Process / Subprocess / Sub Process
    - Sub-Process Description / Subprocess Description / Sub Process Desc
    - Data Entity / Data / Entities / Data Entities
    - Data Element / Data Elements / Element
    - Application / App / System
    - API / APIs / Endpoints
    
    If a field is missing, it will be skipped gracefully.
    """
    
    #Try multiple possible locations for the CSV
    possible_paths = [
         Path(__file__).parent.parent.parent / 'elements_fixed.csv',
         Path(__file__).parent.parent.parent.parent / 'elements_fixed.csv',
         Path('elements_fixed.csv'),
     ]
    # possible_paths = [
    #     Path(__file__).parent.parent.parent / 'fund_mandate.csv',
    #     Path(__file__).parent.parent.parent.parent / 'fund_mandate.csv',
    #     Path('fund_mandate.csv'),
    # ]
    
    csv_path = None
    for path in possible_paths:
        if path.exists():
            csv_path = path
            break
    
    if csv_path is None:
        logger.warning("CSV file not found. Skipping seed.")
        return
    
    logger.info(f"Seeding database from {csv_path}")
    
    # Track created records to avoid duplicates
    verticals = {}
    subverticals = {}
    capabilities = {}
    processes = {}
    
    def get_column_value(row, *possible_names):
        """Get value from row using multiple possible column names (case-insensitive)"""
        for col_name in possible_names:
            if col_name in row:
                value = row.get(col_name, '').strip()
                if value:
                    return value
        return ''
    
    # Try multiple encodings to handle different CSV file formats
    encodings = ['utf-8', 'utf-8-sig', 'windows-1252', 'latin-1', 'cp1252']
    file_handle = None
    reader = None
    
    for encoding in encodings:
        try:
            file_handle = open(csv_path, 'r', encoding=encoding)
            reader = csv.DictReader(file_handle)
            # Try to read the first row to verify encoding works
            fieldnames = reader.fieldnames
            logger.info(f"✓ Successfully opened CSV with encoding: {encoding}")
            logger.info(f"CSV Columns found: {fieldnames}")
            break
        except (UnicodeDecodeError, UnicodeError) as e:
            if file_handle:
                file_handle.close()
            logger.debug(f"Failed to open with {encoding}: {e}")
            continue
    
    if reader is None:
        logger.error(f"✗ Could not open CSV file with any supported encoding")
        return
    
    try:
        
        for row in reader:
            # Dynamically extract fields using multiple possible column names
            vertical = get_column_value(row, 'Vertical', 'Domain', 'vertical', 'domain') or 'Capital Markets'
            sub_vertical = get_column_value(row, 'Sub-Vertical', 'SubVertical', 'Sub Vertical', 'sub_vertical', 'sub-vertical') or 'Asset Management'
            capability_name = get_column_value(row, 'Capability', 'Capability Name', 'capability', 'capability_name')
            capability_desc = get_column_value(row, 'Capability Description', 'Capability Desc', 'capability_description', 'capability_desc')
            org_units = get_column_value(row, 'Organization Units', 'Org Units', 'org_units', 'organization_units')
            process_name = get_column_value(row, 'Process', 'Process Name', 'process', 'process_name')
            process_desc = get_column_value(row, 'Process Description', 'Process Desc', 'process_description', 'process_desc')
            process_level = get_column_value(row, 'Process Level', 'Level', 'process_level', 'level') or 'core'
            process_category = get_column_value(row, 'Process Category', 'Category', 'Office Type', 'process_category', 'category', 'office_type') or 'Back Office'
            subprocess_name = get_column_value(row, 'Sub-Process', 'Subprocess', 'Sub Process', 'sub_process', 'sub-process')
            subprocess_desc = get_column_value(row, 'Sub-Process Description', 'Subprocess Description', 'Sub Process Desc', 'subprocess_description', 'subprocess_desc')
            data_entity_name = get_column_value(row, 'Data Entity', 'Data Entities', 'data_entity', 'data_entities')
            data_entity_description = get_column_value(row, 'Data Entity Description', 'Data Entities', 'data_entity', 'data_entities')
            data_element_name = get_column_value(row, 'Data Element', 'Data Elements', 'Element', 'data_element', 'element')
            data_element_description = get_column_value(row, 'Data Element Description', 'Data Elements', 'Element', 'data_element', 'element')
            application = get_column_value(row, 'Applications', 'App', 'System', 'application', 'app', 'system')
            api = get_column_value(row, 'API', 'APIs', 'Endpoints', 'api', 'apis', 'endpoints')
            
            try:
                # Skip rows without capability name
                if not capability_name:
                    continue
                
                # Create or get Vertical
                vertical_key = vertical
                if vertical_key not in verticals:
                    vert, _ = await Vertical.get_or_create(name=vertical_key)
                    verticals[vertical_key] = vert
                    logger.info(f"✓ Created Vertical: {vertical_key}")
                
                vert = verticals.get(vertical_key)
                
                # Create or get SubVertical
                subvertical_key = f"{vertical_key}_{sub_vertical}"
                subvert = None
                if subvertical_key not in subverticals:
                    subvert, _ = await SubVertical.get_or_create(name=sub_vertical, defaults={'vertical': vert})
                    subverticals[subvertical_key] = subvert
                    logger.info(f"✓ Created SubVertical: {sub_vertical} under {vertical_key}")
                else:
                    subvert = subverticals.get(subvertical_key)
                
                # Create or get Capability
                if capability_name and subvert:
                    cap_key = f"{subvert.id}_{capability_name}"
                    if cap_key not in capabilities:
                        capability, _ = await Capability.get_or_create(
                            name=capability_name,
                            description=capability_desc,
                            subvertical=subvert,
                            defaults={'org_units': org_units if org_units else None}
                        )
                        capabilities[cap_key] = capability
                        logger.info(f"✓ Created Capability: {capability_name}")
                
                capability = capabilities.get(cap_key) if capability_name else None
                
                # Create or get Process
                proc_key = None
                process = None
                if process_name and capability:
                    # Map process level string to enum
                    level_map = {
                        'Process level 1': ProcessLevel.ENTERPRISE,
                        'Process level 2': ProcessLevel.CORE,
                        'Process level 3': ProcessLevel.PROCESS,
                        'enterprise': ProcessLevel.ENTERPRISE,
                        'core': ProcessLevel.CORE,
                        'process': ProcessLevel.PROCESS,
                    }
                    level = level_map.get(process_level.lower(), ProcessLevel.PROCESS)
                    
                    proc_key = f"{capability.id}_{process_name}"
                    if proc_key not in processes:
                        process, _ = await Process.get_or_create(
                            name=process_name,
                            description=process_desc,
                            level=level,
                            category=process_category,
                            capability=capability
                        )
                        processes[proc_key] = process
                        logger.info(f"✓ Created Process: {process_name}")
                    else:
                        process = processes.get(proc_key)
                
                # Create SubProcess
                if subprocess_name and process:
                    subprocess, created = await SubProcess.get_or_create(
                        name=subprocess_name,
                        process=process,
                        defaults={
                            'description': subprocess_desc,
                            'category': process_category,
                            'application': application if application else None,
                            'api': api if api else None,
                        }
                    )
                    if created:
                        logger.info(f"✓ Created SubProcess: {subprocess_name}")
                    else:
                        logger.debug(f"↻ SubProcess already exists: {subprocess_name}")
                    
                    # Create DataEntity under SubProcess
                    if data_entity_name and subprocess:
                        data_entity, de_created = await DataEntity.get_or_create(
                            name=data_entity_name,
                            description=data_entity_description,
                            subprocess=subprocess
                        )
                        if de_created:
                            logger.info(f"✓ Created DataEntity: {data_entity_name} (ID: {data_entity.id})")
                        else:
                            logger.debug(f"↻ DataEntity already exists: {data_entity_name}")
                        
                        # Create DataElement under DataEntity
                        if data_element_name and data_entity:
                            data_element, del_created = await DataElement.get_or_create(
                                name=data_element_name,
                                description=data_element_description,
                                data_entity=data_entity
                            )
                            if del_created:
                                logger.info(f"✓ Created DataElement: {data_element_name} under {data_entity_name}")
                            else:
                                logger.debug(f"↻ DataElement already exists: {data_element_name}")
                    elif not data_entity_name:
                        logger.debug(f"Skipping DataEntity creation - no data_entity_name for subprocess: {subprocess_name}")
                
            except Exception as e:
                logger.error(f"✗ Error processing row: {e}")
                logger.debug(f"  Row: {row}")
                continue
    finally:
        if file_handle:
            file_handle.close()
    
    print("\n✓ Database seeding completed!")

async def init_db_and_seed():
    """Initialize Tortoise ORM and run seeding - FOR STANDALONE USE ONLY"""
    from database.config import TORTOISE_ORM
    
    await Tortoise.init(
        config=TORTOISE_ORM
    )
    await Tortoise.generate_schemas()
    await seed_database()
    await Tortoise.close()

async def run_seed():
    """Run seeding with already-initialized Tortoise connection"""
    try:
        await seed_database()
        logger.info("✓ Database seeding completed successfully!")
    except Exception as e:
        logger.error(f"✗ Database seeding failed: {e}", exc_info=True)

if __name__ == '__main__':
    import asyncio
    asyncio.run(init_db_and_seed())
