import os
from typing import Any

import boto3
from dotenv import load_dotenv

from packages.agent_spec.models import KnowledgeBaseDefinition

load_dotenv()

class KnowledgeBaseRouter:
    """
    Interfaces with Amazon Bedrock Knowledge Bases (Retrieve API) or local knowledge simulation.
    """

    def __init__(self):
        self.region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
        self._bedrock_agent_runtime = None
        try:
            self._bedrock_agent_runtime = boto3.client("bedrock-agent-runtime", region_name=self.region)
        except Exception:  # noqa: BLE001
            self._bedrock_agent_runtime = None

    def has_credentials(self) -> bool:
        try:
            session = boto3.Session(region_name=self.region)
            creds = session.get_credentials()
            return creds is not None and creds.access_key is not None
        except Exception:  # noqa: BLE001
            return False

    def retrieve_chunks(self, kb: KnowledgeBaseDefinition, query: str) -> list[dict[str, Any]]:
        """Retrieves top-K semantic chunks from Bedrock KB or local knowledge base."""
        if self._bedrock_agent_runtime and kb.bedrockKbId and self.has_credentials():
            try:
                response = self._bedrock_agent_runtime.retrieve(
                    knowledgeBaseId=kb.bedrockKbId,
                    retrievalQuery={"text": query},
                    retrievalConfiguration={
                        "vectorSearchConfiguration": {
                            "numberOfResults": kb.topK
                        }
                    }
                )
                results = []
                for item in response.get("retrievalResults", []):
                    score = item.get("score", 0.0)
                    if score >= kb.scoreThreshold:
                        results.append({
                            "content": item.get("content", {}).get("text", ""),
                            "score": score,
                            "location": item.get("location", {})
                        })
                return results
            except Exception as e:  # noqa: BLE001
                print(f"[KnowledgeBaseRouter] Bedrock KB call failed: {e}. Using simulated KB store.")

        # Local sample enterprise documents simulation
        return [
            {
                "content": f"Enterprise Standard Policy (Ref: {kb.name}): All corporate business expenses, SLAs, and approval workflows must be verified against designated compliance guidelines before settlement.",
                "score": 0.92,
                "location": {"uri": f"s3://agentos-kb/{kb.kbId}/policy_guide.pdf"}
            }
        ]

knowledge_router = KnowledgeBaseRouter()
