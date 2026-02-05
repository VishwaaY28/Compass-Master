import csv
import os
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
def get_llm_log_path():
    """Get the absolute path to LLM_LOG.csv"""
    current_dir = os.path.dirname(os.path.abspath(__file__))  # apps/server/src/utils
    server_dir = os.path.dirname(os.path.dirname(current_dir))  # apps/server
    csv_path = os.path.join(server_dir, 'Capability_Compass_log.csv')
    return csv_path
LLM_LOG_PATH = get_llm_log_path()


def ensure_csv_exists():
    """Ensure the LLM_LOG.csv file exists with headers if it doesn't"""
    try:
        header = ['sno', 'date', 'time', 'vertical', 'request_id', 'LLM request with compass', 'llm thinking', 'llm response', 'LLM request without compass', 'llm thinking', 'llm response']
        if not os.path.exists(LLM_LOG_PATH):
            os.makedirs(os.path.dirname(LLM_LOG_PATH), exist_ok=True)
            with open(LLM_LOG_PATH, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(header)
            logger.info(f"Created new Capability_Compass_LOG.csv at {LLM_LOG_PATH}")
        else:
            # If file exists but header is missing new columns, migrate by prepending a header row if needed
            try:
                with open(LLM_LOG_PATH, 'r', encoding='utf-8') as f:
                    reader = csv.reader(f)
                    existing_rows = list(reader)

                if not existing_rows:
                    # Empty file: write header
                    with open(LLM_LOG_PATH, 'w', newline='', encoding='utf-8') as f:
                        writer = csv.writer(f)
                        writer.writerow(header)
                    logger.info(f"Initialized header in existing Capability_Compass_LOG.csv at {LLM_LOG_PATH}")
                else:
                    existing_header = existing_rows[0]
                    if 'request_id' not in existing_header:
                        # Rebuild file with new header and normalize existing rows to match header length
                        normalized_rows = []
                        for row in existing_rows[1:]:
                            # Ensure row is a list
                            r = list(row)
                            # If row is shorter than header, insert empty request_id at index 4
                            if len(r) < len(header):
                                # insert empty request_id at position 4 (0-based)
                                if len(r) >= 4:
                                    r.insert(4, "")
                                # pad any remaining columns
                                while len(r) < len(header):
                                    r.append("")
                            # If row is longer than header (e.g., old context_data column), trim extras
                            elif len(r) > len(header):
                                r = r[: len(header)]
                            normalized_rows.append(r)

                        with open(LLM_LOG_PATH, 'w', newline='', encoding='utf-8') as f:
                            writer = csv.writer(f)
                            writer.writerow(header)
                            for nr in normalized_rows:
                                writer.writerow(nr)

                        logger.info(f"Migrated and normalized existing Capability_Compass_LOG.csv with updated header at {LLM_LOG_PATH}")
            except Exception as e:
                logger.warning(f"Failed to validate/migrate existing log header: {e}")
    except Exception as e:
        logger.error(f"Error ensuring CSV exists at {LLM_LOG_PATH}: {e}")
    return LLM_LOG_PATH


def get_next_sno():
    """Get the next serial number for the CSV file"""
    ensure_csv_exists()
    try:
        with open(LLM_LOG_PATH, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = list(reader)
            return len(rows)
    except Exception as e:
        logger.error(f"Error reading Capability_Compass_LOG.csv for sno: {e}")
        return 1


def log_llm_call(
    vertical: str,
    user_query: str,
    user_prompt:str,
    llm_thinking_compass: str,
    llm_response_compass: str,
    llm_thinking_independent: str,
    llm_response_independent: str,
    system_prompt_compass: str = "",
    system_prompt_independent: str = "",
    request_id: str = None,
):
    """
    Log LLM calls for both compass and independent responses to the CSV file
    
    Args:
        vertical: The vertical/domain being queried
        user_query: The user's query
        llm_thinking_compass: The LLM's thinking process with compass context
        llm_response_compass: The LLM's final response with compass context
        llm_thinking_independent: The LLM's thinking process without compass context
        llm_response_independent: The LLM's final response without compass context
        system_prompt_compass: The system prompt used for compass LLM call (optional)
    system_prompt_independent: The system prompt used for independent LLM call (optional)
    """
    try:
        ensure_csv_exists()
        
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        sno = get_next_sno()
        
        # Combine request components for compass version
        llm_request_compass = f"System Prompt: {system_prompt_compass}\n\nUser Prompt: {user_prompt}\n" if system_prompt_compass else f"User Prompt: {user_prompt}"
        
        # Combine request components for independent version
        llm_request_independent = f"System Prompt: {system_prompt_independent}\n\nUser Query: {user_query}" if system_prompt_independent else f"User Query: {user_query}"
        
        row = [
            sno,
            date_str,
            time_str,
            vertical or "",
            llm_request_compass or "",
            llm_thinking_compass or "",
            llm_response_compass or "",
            llm_request_independent or "",
            llm_thinking_independent or "",
            llm_response_independent or ""
        ]

    # Row matches header order: request_id then the rest; system_prompt is included in LLM request with compass
        
        # If a request_id is provided, try to update an existing row instead of appending a duplicate
        if request_id:
            try:
                with open(LLM_LOG_PATH, 'r', encoding='utf-8') as f:
                    reader = csv.reader(f)
                    rows = list(reader)

                header = rows[0] if rows else []
                updated = False
                for i, r in enumerate(rows[1:], start=1):
                    # Ensure row has enough columns
                    if len(r) <= 4:
                        continue
                    if r[4] == request_id:
                        # Preserve sno (r[0]) and date/time; replace columns with new values
                        sno_existing = r[0]
                        new_row = [
                            sno_existing,
                            date_str,
                            time_str,
                            vertical or "",
                            llm_request_compass or "",
                            llm_thinking_compass or "",
                            llm_response_compass or "",
                            llm_request_independent or "",
                            llm_thinking_independent or "",
                            llm_response_independent or "",
                        ]
                        # If existing row is longer, preserve any trailing columns by merging
                        if len(r) > len(new_row):
                            new_row.extend(r[len(new_row):])

                        rows[i] = new_row
                        updated = True
                        break

                if updated:
                    # Write back full CSV atomically
                    with open(LLM_LOG_PATH, 'w', newline='', encoding='utf-8') as f:
                        writer = csv.writer(f)
                        for row_item in rows:
                            writer.writerow(row_item)

                    logger.info(f"LLM call updated for request_id={request_id} (sno={sno_existing}) in {LLM_LOG_PATH}")
                    return
            except Exception as e:
                logger.warning(f"Failed to update existing log row for request_id={request_id}: {e}")

        # If no request_id provided, try matching by vertical + user_query and empty independent columns
        try:
            with open(LLM_LOG_PATH, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                rows = list(reader)

            # Scan from bottom (most recent) to top for a row matching vertical and user_query and lacking independent response
            match_index = None
            for i in range(len(rows) - 1, 0, -1):
                r = rows[i]
                # Ensure row has enough columns
                if len(r) < 6:
                    continue
                row_vertical = r[3] if len(r) > 3 else ""
                llm_req_compass = r[5] if len(r) > 5 else ""
                llm_resp_independent = r[10] if len(r) > 10 else ""

                if row_vertical == (vertical or "") and (not llm_resp_independent or llm_resp_independent.strip() == ""):
                    # match on embedded user query presence in the LLM request with compass (best-effort)
                    if f"User Query: {user_query}" in llm_req_compass or (
                        llm_thinking_compass and len(llm_thinking_compass) > 0 and r[6] == llm_thinking_compass
                    ) or (llm_response_compass and len(llm_response_compass) > 0 and r[7] == llm_response_compass):
                        match_index = i
                        break

            if match_index is not None:
                r = rows[match_index]
                sno_existing = r[0] if len(r) > 0 else ""
                new_row = [
                    sno_existing,
                    date_str,
                    time_str,
                    vertical or "",
                    llm_request_compass or "",
                    llm_thinking_compass or "",
                    llm_response_compass or "",
                    llm_request_independent or "",
                    llm_thinking_independent or "",
                    llm_response_independent or "",
                ]
                if len(r) > len(new_row):
                    new_row.extend(r[len(new_row):])
                rows[match_index] = new_row

                with open(LLM_LOG_PATH, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    for row_item in rows:
                        writer.writerow(row_item)

                logger.info(f"LLM call updated by match for vertical={vertical} (sno={sno_existing}) in {LLM_LOG_PATH}")
                return
        except Exception:
            # Silently continue to append path below if matching update fails
            pass
        # If not updating an existing row, append a new one with retries
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with open(LLM_LOG_PATH, 'a', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(row)

                logger.info(f"LLM calls logged successfully (sno={sno}) to {LLM_LOG_PATH}")
                return
            except PermissionError as perm_error:
                if attempt < max_retries - 1:
                    logger.warning(f"Permission denied on attempt {attempt + 1}/{max_retries}, retrying...")
                    import time
                    time.sleep(0.5)
                else:
                    logger.error(f"Failed to write to Capability_Compass_LOG.csv after {max_retries} attempts: {perm_error}")
                    logger.error(f"Attempted path: {LLM_LOG_PATH}")
                    raise
    except Exception as e:
        logger.error(f"Error logging LLM call to CSV: {e}", exc_info=True)
