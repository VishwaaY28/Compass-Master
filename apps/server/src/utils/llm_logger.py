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
        if not os.path.exists(LLM_LOG_PATH):
            os.makedirs(os.path.dirname(LLM_LOG_PATH), exist_ok=True)
            with open(LLM_LOG_PATH, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['sno', 'date', 'time', 'vertical', 'LLM request with compass', 'llm thinking', 'llm response', 'LLM request without compass', 'llm thinking', 'llm response'])
            logger.info(f"Created new Capability_Compass_LOG.csv at {LLM_LOG_PATH}")
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
    llm_thinking_compass: str,
    llm_response_compass: str,
    llm_thinking_independent: str,
    llm_response_independent: str,
    system_prompt_compass: str = "",
    system_prompt_independent: str = "",
    context_data: str = ""
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
        context_data: The database context data (optional)
    """
    try:
        ensure_csv_exists()
        
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        sno = get_next_sno()
        
        # Combine request components for compass version
        llm_request_compass = f"System Prompt: {system_prompt_compass}\n\nUser Query: {user_query}\n\nContext:\n{context_data}" if system_prompt_compass or context_data else f"User Query: {user_query}"
        
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
