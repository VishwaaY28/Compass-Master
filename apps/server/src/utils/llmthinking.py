"""
Azure OpenAI LLM Thinking Module

Handles AI reasoning and query processing using Azure OpenAI LLM provider with chain-of-thought capability.
This module provides LLM thinking capabilities for analyzing user queries against vertical data
and returning both the agent's reasoning process and final results.
"""

import logging
import json
import os
from typing import Dict, Any, Optional, List, Tuple
from env import env
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
from openai import AzureOpenAI

logger = logging.getLogger(__name__)

try:
    _has_azure = True
except ImportError:
    _has_azure = False
    logger.warning("Azure libraries not installed. Install them to use Azure OpenAI provider.")


class AzureOpenAIThinkingClient:
    """
    Azure OpenAI Client for chain-of-thought reasoning and analysis.
    Provides thinking capability to reason through queries and data analysis using Azure credentials.
    """

    def __init__(self):
        self._client = None
        self._config = None

    def _load_config(self) -> Dict[str, Any]:
        """Load Azure OpenAI API configuration from Key Vault"""
        if self._config is None:
            try:
                # Initialize credential and Key Vault client
                credential = DefaultAzureCredential()
                key_vault_url = "https://fstodevazureopenai.vault.azure.net/"
                kv_client = SecretClient(vault_url=key_vault_url, credential=credential)
                
                # Retrieve secrets from Key Vault
                api_key = kv_client.get_secret("llm-api-key").value
                endpoint = kv_client.get_secret("llm-base-endpoint").value
                deployment = kv_client.get_secret("llm-41").value
                api_version = kv_client.get_secret("llm-41-version").value
                
                # Strip whitespace from all values
                api_key = api_key.strip() if api_key else None
                endpoint = endpoint.strip() if endpoint else None
                deployment = deployment.strip() if deployment else None
                api_version = api_version.strip() if api_version else None
                
                if not all([api_key, endpoint, deployment, api_version]):
                    logger.warning("One or more required Azure secrets are missing")
                    logger.warning(f"API Key present: {bool(api_key)}, Endpoint: {bool(endpoint)}, Deployment: {bool(deployment)}, API Version: {bool(api_version)}")
                    raise ValueError("Missing required Azure Key Vault secrets")

                self._config = {
                    "api_key": api_key,
                    "endpoint": endpoint,
                    "deployment": deployment,
                    "api_version": api_version,
                }
                logger.info(f"Azure OpenAI config loaded - Endpoint: {endpoint}, Deployment: {deployment}, API Version: {api_version}")

            except Exception as e:
                logger.error(f"Error loading Azure Key Vault configuration: {e}")
                raise ValueError(f"Failed to load Azure configuration: {e}")

        return self._config

    def _get_client(self) -> AzureOpenAI:
        """Get or create Azure OpenAI client instance"""
        if self._client is None:
            if not _has_azure:
                raise ImportError(
                    "Azure libraries are not installed. Install them with: pip install azure-identity azure-keyvault-secrets openai"
                )
            config = self._load_config()
            
            # Ensure endpoint doesn't have trailing slashes or path
            endpoint = config["endpoint"]
            if endpoint.endswith("/"):
                endpoint = endpoint.rstrip("/")
            # Remove any /openai/v1 or /openai paths that might be included
            if "/openai/deployments" in endpoint:
                endpoint = endpoint.split("/openai/deployments")[0]
            elif "/openai" in endpoint:
                endpoint = endpoint.split("/openai")[0]
            
            logger.info(f"Cleaned endpoint: {endpoint}")
            
            self._client = AzureOpenAI(
                api_key=config["api_key"],
                api_version=config["api_version"],
                azure_endpoint=endpoint
            )
            logger.info(f"Azure OpenAI client initialized successfully with endpoint: {endpoint}")

        return self._client

    def think_and_analyze(
        self,
        query: str,
        vertical: str,
        vertical_data: Dict[str, Any],
        temperature: float = 0.2,
        max_tokens: int = 2000,
    ) -> Tuple[str, str]:
        """
        Use Azure OpenAI LLM to think through a query and analyze vertical data.

        Args:
            query: User's query/question
            vertical: Selected vertical/domain
            vertical_data: Data structure containing capabilities, processes, etc.
            temperature: LLM temperature (0-1)
            max_tokens: Maximum tokens for response

        Returns:
            Tuple of (thinking_process, final_result)
        """
        try:
            client = self._get_client()
            config = self._load_config()

            # Build context from vertical data
            context = self._build_context(vertical, vertical_data)

            # Create system prompt for thinking
            system_prompt = self._create_system_prompt(vertical)

            # Create user message with thinking instructions
            user_message = self._create_user_message(query, context)

            # Call Azure OpenAI API with thinking enabled
            deployment = config["deployment"]
            logger.info(f"Calling Azure OpenAI API for query: {query[:50]}... (Deployment: {deployment})")
            
            try:
                response = client.chat.completions.create(
                    model=deployment,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    top_p=0.2,
                )
            except Exception as api_error:
                logger.error(f"Azure API Error - Deployment: {deployment}, Error: {str(api_error)}")
                raise

            # Extract response content
            response_text = response.choices[0].message.content

            # Parse thinking and result from response
            thinking, result = self._parse_response(response_text)

            logger.info(f"Successfully processed query: {query[:50]}...")
            return thinking, result

        except Exception as e:
            logger.error(f"Error in think_and_analyze: {e}")
            raise

    def stream_think_and_analyze(
        self,
        query: str,
        vertical: str,
        vertical_data: Dict[str, Any],
        temperature: float = 0.2,
        max_tokens: int = 2000,
    ):
        """
        Stream the thinking process and analysis result progressively.
        This allows the frontend to see thinking as it happens.

        Args:
            query: User's query/question
            vertical: Selected vertical/domain
            vertical_data: Data structure containing capabilities, processes, etc.
            temperature: LLM temperature (0-1)
            max_tokens: Maximum tokens for response

        Yields:
            Tuple of (chunk_type, content) where chunk_type is 'thinking' or 'result'
        """
        try:
            client = self._get_client()
            config = self._load_config()

            context = self._build_context(vertical, vertical_data)
            system_prompt = self._create_system_prompt(vertical)
            user_message = self._create_user_message(query, context)

            deployment = config["deployment"]
            logger.info(f"Starting stream for query: {query[:50]}... (Deployment: {deployment})")

            try:
                stream = client.chat.completions.create(
                    model=deployment,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    top_p=0.2,
                    stream=True,
                )
            except Exception as api_error:
                logger.error(f"Azure API Error - Deployment: {deployment}, Error: {str(api_error)}")
                raise

            buffer = ""
            in_thinking = False
            thinking_started = False

            for chunk in stream:
                if chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    buffer += text

                    # Check for thinking section markers
                    if "<thinking>" in buffer:
                        in_thinking = True
                        thinking_started = True
                        before, after = buffer.split("<thinking>", 1)
                        
                        # Yield any text before thinking tags
                        if before.strip():
                            yield ("text", before)
                        
                        buffer = after

                    if "</thinking>" in buffer and in_thinking:
                        thinking_text, after = buffer.split("</thinking>", 1)
                        
                        # Yield the complete thinking section
                        if thinking_text.strip():
                            yield ("thinking", thinking_text.strip())
                        
                        in_thinking = False
                        buffer = after

                    # Yield buffered result content periodically (when not in thinking)
                    if not in_thinking and len(buffer) > 100:
                        yield ("result", buffer)
                        buffer = ""

            # Yield remaining content
            if buffer:
                if in_thinking:
                    # If we're still in thinking mode, yield as thinking
                    yield ("thinking", buffer.strip())
                else:
                    # Otherwise yield as result
                    if buffer.strip():
                        yield ("result", buffer.strip())
            
            logger.info(f"Stream completed for query: {query[:50]}...")

        except Exception as e:
            logger.error(f"Error in stream_think_and_analyze: {e}")
            raise

    def _create_system_prompt(self, vertical: str) -> str:
        """Create system prompt for the LLM"""
        return f"""You are an expert consultant analyzing business capabilities and processes in the {vertical} domain.

IMPORTANT: You MUST ONLY reference data that is explicitly provided in the context below. Do NOT fabricate, assume, or invent any entities, elements, or relationships that are not in the provided data.

Your task is to:
1. First, think through the user's query step by step
2. Analyze the relevant capabilities and processes strictly only from the provided data
3. Identify the most relevant matches to the user's intent
4. Provide comprehensive insights strictly based only on the available data

If data is not available, explicitly state "This information is not available in the provided data."

Structure your response as:
<thinking>
[Your step-by-step reasoning process - reference only the provided data]
</thinking>

[Your final analysis and recommendations - cite specific entities and elements from the provided data]

Be thorough in your thinking but concise in your final answer."""

    def _create_user_message(self, query: str, context: str) -> str:
        """Create the user message with query and context"""
        return f"""Based on the following vertical data:
{context}
Please analyze this query: {query}
Provide both your thinking process and final analysis."""

    def _build_context(self, vertical: str, vertical_data: Dict[str, Any]) -> str:
        """Build context string from vertical data including entities and elements"""
        try:
            context_parts = [f"Vertical: {vertical}\n"]

            if isinstance(vertical_data, dict):
                # Add capabilities
                if "capabilities" in vertical_data and vertical_data["capabilities"]:
                    context_parts.append("=== Available Capabilities ===")
                    for cap in vertical_data["capabilities"]:
                        if isinstance(cap, dict):
                            context_parts.append(
                                f"  • {cap.get('name', 'Unknown')}: {cap.get('description', '')}"
                            )
                        else:
                            context_parts.append(f"  • {cap}")

                # Add processes
                if "processes" in vertical_data and vertical_data["processes"]:
                    context_parts.append("\n=== Key Processes ===")
                    for proc in vertical_data["processes"]:
                        if isinstance(proc, dict):
                            context_parts.append(
                                f"  • {proc.get('name', 'Unknown')} [{proc.get('level', 'unknown')} - {proc.get('category', 'unknown')}]: {proc.get('description', '')}"
                            )
                        else:
                            context_parts.append(f"  • {proc}")

                # Add subprocesses
                if "subprocesses" in vertical_data and vertical_data["subprocesses"]:
                    context_parts.append("\n=== Subprocesses ===")
                    for subproc in vertical_data["subprocesses"]:
                        if isinstance(subproc, dict):
                            context_parts.append(
                                f"  • {subproc.get('name', 'Unknown')} [{subproc.get('category', 'unknown')}]: {subproc.get('description', '')}"
                            )
                            if subproc.get('application'):
                                context_parts.append(f"      Application: {subproc.get('application')}")
                            if subproc.get('api'):
                                context_parts.append(f"      API: {subproc.get('api')}")
                        else:
                            context_parts.append(f"  • {subproc}")

                # Add data entities
                if "data_entities" in vertical_data and vertical_data["data_entities"]:
                    context_parts.append("\n=== Data Entities ===")
                    for entity in vertical_data["data_entities"]:
                        if isinstance(entity, dict):
                            context_parts.append(
                                f"  • {entity.get('name', 'Unknown')}: {entity.get('description', '')}"
                            )
                        else:
                            context_parts.append(f"  • {entity}")

                # Add data elements
                if "data_elements" in vertical_data and vertical_data["data_elements"]:
                    context_parts.append("\n=== Data Elements ===")
                    for element in vertical_data["data_elements"]:
                        if isinstance(element, dict):
                            context_parts.append(
                                f"  • {element.get('name', 'Unknown')}: {element.get('description', '')}"
                            )
                        else:
                            context_parts.append(f"  • {element}")

            context_text = "\n".join(context_parts)
            # Limit context to reasonable size but preserve all data sections
            max_context_length = 50000
            if len(context_text) > max_context_length:
                # Try to truncate gracefully by removing the least important sections
                logger.info(f"Context exceeds {max_context_length} chars ({len(context_text)}), truncating carefully")
                # Keep the vertical name and data entities/elements which are most important
                return context_text[:max_context_length]
            return context_text
        except Exception as e:
            logger.warning(f"Error building context: {e}")
            return f"Vertical: {vertical}"

    def _parse_response(self, response_text: str) -> Tuple[str, str]:
        """Parse the LLM response into thinking and result sections"""
        thinking = ""
        result = ""

        try:
            if "<thinking>" in response_text and "</thinking>" in response_text:
                parts = response_text.split("<thinking>")
                thinking = parts[1].split("</thinking>")[0].strip()
                result = parts[1].split("</thinking>")[1].strip()
            else:
                # If no explicit thinking tags, treat all as result
                result = response_text.strip()
                thinking = "Analysis in progress..."

        except Exception as e:
            logger.warning(f"Error parsing response: {e}")
            result = response_text
            thinking = "Analysis completed"

        return thinking, result

    def extract_keywords(
        self, query: str, max_keywords: int = 5
    ) -> List[str]:
        """Extract key concepts from a query using Azure OpenAI"""
        try:
            client = self._get_client()
            config = self._load_config()

            response = client.chat.completions.create(
                model=config["deployment"],
                messages=[
                    {
                        "role": "user",
                        "content": f"Extract the top {max_keywords} key concepts/keywords from this query. Return only the keywords as a comma-separated list:\n{query}",
                    }
                ],
                temperature=0.2,
                max_tokens=100,
            )

            keywords_text = response.choices[0].message.content
            keywords = [
                k.strip() for k in keywords_text.split(",")
            ]
            return keywords[:max_keywords]

        except Exception as e:
            logger.error(f"Error extracting keywords: {e}")
            return []


# Global instance
azure_openai_thinking_client = AzureOpenAIThinkingClient()
