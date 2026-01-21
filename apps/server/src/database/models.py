import enum
from enum import Enum
from tortoise import fields, models

class TimestampMixin(models.Model):
  created_at = fields.DatetimeField(auto_now_add=True)
  updated_at = fields.DatetimeField(auto_now=True)
  deleted_at = fields.DatetimeField(null=True)

class Vertical(TimestampMixin):
  id = fields.IntField(pk=True)
  name = fields.CharField(max_length=50)

class SubVertical(TimestampMixin):
  id = fields.IntField(pk=True)
  name = fields.CharField(max_length=50)
  vertical = fields.ForeignKeyField('models.Vertical', related_name='subverticals', null=True)

class Capability(TimestampMixin):
    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=255)
    description = fields.TextField()
    subvertical = fields.ForeignKeyField('models.SubVertical', related_name='capabilities', null=True)

class ProcessLevel(str, Enum):
    ENTERPRISE = "enterprise"
    CORE = "core"
    PROCESS = "process"

class Process(TimestampMixin):
    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=255)
    level = fields.CharEnumField(ProcessLevel)
    description = fields.TextField()
    capability = fields.ForeignKeyField('models.Capability', related_name='processes', null=True)
    category = fields.CharField(max_length=255, null=True)
    parent_process = fields.ForeignKeyField('models.Process', related_name='child_processes', null=True)

class SubProcess(TimestampMixin):
  id = fields.IntField(pk=True)
  name = fields.CharField(max_length=255)
  description = fields.TextField(null=True)
  process = fields.ForeignKeyField('models.Process', related_name='subprocesses', null=False)
  category = fields.CharField(max_length=255, null=True)
  parent_subprocess = fields.ForeignKeyField('models.SubProcess', related_name='child_subprocesses', null=True)
  application = fields.TextField(null=True)
  api = fields.TextField(null=True)

class DataEntity(TimestampMixin):
  id = fields.IntField(pk=True)
  name = fields.CharField(max_length=255)
  description = fields.TextField(null=True)
  subprocess = fields.ForeignKeyField('models.SubProcess', related_name='data_entities', null=False)

class DataElement(TimestampMixin):
  id = fields.IntField(pk=True)
  name = fields.CharField(max_length=255)
  description = fields.TextField(null=True)
  data_entity = fields.ForeignKeyField('models.DataEntity', related_name='data_elements', null=False)

class LLMSettings(TimestampMixin):
  id = fields.IntField(pk=True)
  provider = fields.CharField(max_length=50, default="secure")
  vault_name = fields.CharField(max_length=255, default="https://kvcapabilitycompass.vault.azure.net/")
  temperature = fields.FloatField(default=0.2)
  max_tokens = fields.IntField(default=1500)
  top_p = fields.FloatField(default=0.9)
  
  class Meta:
    table = "llm_settings"

class PromptTemplate(TimestampMixin):
  id = fields.IntField(pk=True)
  process_level = fields.CharField(max_length=50)
  prompt = fields.TextField()
  
  class Meta:
    table = "prompt_templates"