import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import aws_cdk as cdk

from infra.ephemeral_stack import BedrockAgentOSEphemeralStack

app = cdk.App()
env_id = os.environ.get("PR_NUMBER", os.environ.get("GITHUB_SHA", "preview-develop"))[:12]

BedrockAgentOSEphemeralStack(
    app,
    f"BedrockAgentOS-Ephemeral-{env_id}",
    env_id=env_id,
    env=cdk.Environment(
        account=os.environ.get("CDK_DEFAULT_ACCOUNT", "123456789012"),
        region=os.environ.get("CDK_DEFAULT_REGION", "us-east-1"),
    ),
)

app.synth()
