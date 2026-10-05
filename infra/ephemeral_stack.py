from aws_cdk import (
    CfnOutput,
    RemovalPolicy,
    Stack,
)
from aws_cdk import (
    aws_iam as iam,
)
from aws_cdk import (
    aws_s3 as s3,
)
from constructs import Construct


class BedrockAgentOSEphemeralStack(Stack):
    """
    Ephemeral preview environment stack for Amazon Bedrock AgentOS Studio.
    Automates cloud infrastructure synthesis and preview deployment per PR.
    """

    def __init__(self, scope: Construct, construct_id: str, env_id: str = "preview-develop", **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        safe_env_id = "".join(c for c in env_id if c.isalnum() or c == "-").lower()[:15]

        # 1. Ephemeral S3 Bucket for Knowledge Bases & Visual Charts
        bucket = s3.Bucket(
            self,
            "EphemeralStorageBucket",
            bucket_name=f"bedrock-agentos-{safe_env_id}-artifacts",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
        )

        # 2. IAM Role for Amazon Bedrock Foundation Models & Knowledge Base access
        bedrock_exec_role = iam.Role(
            self,
            "BedrockAgentExecutionRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            description=f"Execution role for Bedrock AgentOS Ephemeral Environment ({env_id})",
        )

        bedrock_exec_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "bedrock:InvokeModel",
                    "bedrock:InvokeModelWithResponseStream",
                    "bedrock:Converse",
                    "bedrock:ConverseStream",
                    "bedrock:Retrieve",
                    "bedrock:RetrieveAndGenerate",
                ],
                resources=["*"],
            )
        )

        # 3. Stack Outputs
        CfnOutput(self, "EphemeralEnvironmentId", value=env_id, description="Ephemeral Preview Identifier")
        CfnOutput(self, "ArtifactBucketName", value=bucket.bucket_name, description="S3 Storage Bucket for Preview")
        CfnOutput(self, "ExecutionRoleArn", value=bedrock_exec_role.role_arn, description="IAM Execution Role for Bedrock")
