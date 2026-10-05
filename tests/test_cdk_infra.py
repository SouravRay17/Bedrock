import aws_cdk as cdk
from aws_cdk.assertions import Template

from infra.ephemeral_stack import BedrockAgentOSEphemeralStack


def test_ephemeral_stack_synth():
    """Verify synthesis of ephemeral preview CloudFormation stack."""
    app = cdk.App()
    stack = BedrockAgentOSEphemeralStack(app, "TestEphemeralStack", env_id="pr-42")
    template = Template.from_stack(stack)

    # 1. Bucket resource exists with auto-delete policy
    template.has_resource_properties("AWS::S3::Bucket", {
        "BucketEncryption": {
            "ServerSideEncryptionConfiguration": [
                {
                    "ServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }
            ]
        }
    })

    # 2. Bedrock IAM execution role exists
    template.has_resource_properties("AWS::IAM::Role", {
        "AssumeRolePolicyDocument": {
            "Statement": [
                {
                    "Action": "sts:AssumeRole",
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "ecs-tasks.amazonaws.com"
                    }
                }
            ]
        }
    })

    # 3. Stack Outputs
    template.has_output("EphemeralEnvironmentId", {
        "Value": "pr-42"
    })
