from enum import Enum
from tortoise import fields, models

class TimestampMixin(models.Model):
  created_at = fields.DatetimeField(auto_now_add=True)
  updated_at = fields.DatetimeField(auto_now=True)
  deleted_at = fields.DatetimeField(null=True)

class Domain(TimestampMixin):
  id = fields.IntField(pk=True)
  name = fields.CharField(max_length=50)

class CapabilityName(TimestampMixin):
    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=255, unique=True)

class ProcessLevel(str, Enum):
    ENTERPRISE = "enterprise"
    CORE = "core"
    PROCESS = "process"
    SUBPROCESS = "subprocess"

class Process(TimestampMixin):
    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=255)
    description = fields.TextField(null=True)
    level = fields.CharEnumField(ProcessLevel)
    parent = fields.ForeignKeyField(
        "models.Process",
        related_name="children",
        null=True,
        on_delete=fields.CASCADE
    )