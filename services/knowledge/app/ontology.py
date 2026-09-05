"""The deliberately small V0 knowledge ontology."""

from __future__ import annotations

from pydantic import BaseModel


class Person(BaseModel):
    """A named person who acts, owns work, makes decisions, or requests work."""


class Project(BaseModel):
    """A named product, initiative, or body of work tracked by the company."""


class Decision(BaseModel):
    """A named choice or policy that the company has explicitly adopted."""


class Task(BaseModel):
    """A concrete unit of work, such as a Linear issue or implementation task."""


class Repository(BaseModel):
    """A named source-code repository involved in company work."""


class PullRequest(BaseModel):
    """A named code change proposed for review in a repository."""


ENTITY_TYPES: dict[str, type[BaseModel]] = {
    "Person": Person,
    "Project": Project,
    "Decision": Decision,
    "Task": Task,
    "Repository": Repository,
    "PullRequest": PullRequest,
}


class PartOf(BaseModel):
    """The source entity is a component or work item within the target entity."""


class Implements(BaseModel):
    """The source work item implements the target decision, project, or requirement."""


class Blocks(BaseModel):
    """The source entity prevents the target work from proceeding."""


class Decided(BaseModel):
    """The source person or group made the target decision."""


class Supersedes(BaseModel):
    """The source decision or fact replaces an earlier target decision or fact."""


class RequestedBy(BaseModel):
    """The source task or change was requested by the target person."""


class RelatedTo(BaseModel):
    """The source and target entities are explicitly related by the source event."""


RELATIONSHIP_TYPES: dict[str, type[BaseModel]] = {
    "PART_OF": PartOf,
    "IMPLEMENTS": Implements,
    "BLOCKS": Blocks,
    "DECIDED": Decided,
    "SUPERSEDES": Supersedes,
    "REQUESTED_BY": RequestedBy,
    "RELATED_TO": RelatedTo,
}

# Graphiti's generic Entity label is present alongside each custom label. Mapping
# Entity -> Entity keeps the allowed relation list available for every V0 pair.
RELATIONSHIP_TYPE_MAP: dict[tuple[str, str], list[str]] = {
    ("Entity", "Entity"): list(RELATIONSHIP_TYPES)
}

ONTOLOGY_INSTRUCTIONS = """
Use only these entity types: Person, Project, Decision, Task, Repository, PullRequest.
Do not use the generic Entity type. If a fact does not contain one of these concrete
entity types, omit it rather than inventing a new type.

Use only these relationship types: PART_OF, IMPLEMENTS, BLOCKS, DECIDED,
SUPERSEDES, REQUESTED_BY, RELATED_TO. Do not create another relationship name.
Preserve explicit dates, provider names, task identifiers, pull request numbers,
repository names, source event identifiers, and changes to earlier decisions.
""".strip()
