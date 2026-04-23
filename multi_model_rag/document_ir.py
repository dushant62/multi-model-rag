from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence

DOCUMENT_IR_VERSION = "1.0"


def _stringify_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
        parts = [_stringify_text(item) for item in value]
        return "\n".join(part for part in parts if part)
    return str(value).strip()


def _coerce_page_index(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _extract_semantic_text(block_type: str, block: Mapping[str, Any]) -> str:
    text_candidates = {
        "text": ("text",),
        "image": ("text", "image_caption", "image_footnote"),
        "table": ("text", "table_caption", "table_body", "table_footnote"),
        "equation": ("text", "latex"),
    }
    keys = text_candidates.get(block_type, ("text", "content", "caption"))
    parts = [_stringify_text(block.get(key)) for key in keys]
    return "\n".join(part for part in parts if part)


@dataclass(frozen=True)
class ParserCapabilities:
    name: str
    supports_pdf: bool = False
    supports_images: bool = False
    supports_office: bool = False
    supports_html: bool = False
    supports_text: bool = False
    supports_remote: bool = False
    provides_layout: bool = False
    provides_reading_order: bool = False
    provides_images: bool = False
    provides_tables: bool = False
    provides_equations: bool = False
    provides_ocr: bool = False
    notes: tuple[str, ...] = ()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "supports_pdf": self.supports_pdf,
            "supports_images": self.supports_images,
            "supports_office": self.supports_office,
            "supports_html": self.supports_html,
            "supports_text": self.supports_text,
            "supports_remote": self.supports_remote,
            "provides_layout": self.provides_layout,
            "provides_reading_order": self.provides_reading_order,
            "provides_images": self.provides_images,
            "provides_tables": self.provides_tables,
            "provides_equations": self.provides_equations,
            "provides_ocr": self.provides_ocr,
            "notes": list(self.notes),
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "ParserCapabilities":
        return cls(
            name=str(data.get("name", "unknown")),
            supports_pdf=bool(data.get("supports_pdf", False)),
            supports_images=bool(data.get("supports_images", False)),
            supports_office=bool(data.get("supports_office", False)),
            supports_html=bool(data.get("supports_html", False)),
            supports_text=bool(data.get("supports_text", False)),
            supports_remote=bool(data.get("supports_remote", False)),
            provides_layout=bool(data.get("provides_layout", False)),
            provides_reading_order=bool(data.get("provides_reading_order", False)),
            provides_images=bool(data.get("provides_images", False)),
            provides_tables=bool(data.get("provides_tables", False)),
            provides_equations=bool(data.get("provides_equations", False)),
            provides_ocr=bool(data.get("provides_ocr", False)),
            notes=tuple(str(note) for note in data.get("notes", ())),
        )


@dataclass
class DocumentBlock:
    block_id: str
    block_type: str
    page_idx: int = 0
    text: str = ""
    assets: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    legacy_payload: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_legacy_block(
        cls, block: Mapping[str, Any], index: int, parser_name: str
    ) -> "DocumentBlock":
        block_type = str(block.get("type", "text"))
        page_idx = _coerce_page_index(block.get("page_idx", 0))
        asset_candidates = [_stringify_text(block.get("img_path"))]
        assets = [candidate for candidate in asset_candidates if candidate]

        metadata = {
            key: value
            for key, value in block.items()
            if key not in {"type", "page_idx", "text", "img_path"}
        }

        return cls(
            block_id=f"{parser_name}-block-{index}",
            block_type=block_type,
            page_idx=page_idx,
            text=_extract_semantic_text(block_type, block),
            assets=assets,
            metadata=metadata,
            legacy_payload=dict(block),
        )

    def to_legacy_dict(self) -> Dict[str, Any]:
        payload = dict(self.legacy_payload)
        payload["type"] = self.block_type
        payload["page_idx"] = self.page_idx

        if self.text and "text" not in payload:
            payload["text"] = self.text
        if self.assets and "img_path" not in payload:
            payload["img_path"] = self.assets[0]

        return payload

    def to_dict(self) -> Dict[str, Any]:
        return {
            "block_id": self.block_id,
            "block_type": self.block_type,
            "page_idx": self.page_idx,
            "text": self.text,
            "assets": list(self.assets),
            "metadata": self.metadata,
            "legacy_payload": self.legacy_payload,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "DocumentBlock":
        return cls(
            block_id=str(data.get("block_id", "")),
            block_type=str(data.get("block_type", "text")),
            page_idx=_coerce_page_index(data.get("page_idx", 0)),
            text=_stringify_text(data.get("text")),
            assets=[str(asset) for asset in data.get("assets", []) if str(asset)],
            metadata=dict(data.get("metadata", {})),
            legacy_payload=dict(data.get("legacy_payload", {})),
        )


@dataclass
class ParsedDocument:
    source_path: str
    parser_name: str
    parser_capabilities: ParserCapabilities
    version: str = DOCUMENT_IR_VERSION
    metadata: Dict[str, Any] = field(default_factory=dict)
    blocks: List[DocumentBlock] = field(default_factory=list)

    @classmethod
    def from_content_list(
        cls,
        content_list: Sequence[Mapping[str, Any]],
        source_path: str = "",
        parser_name: str = "unknown",
        parser_capabilities: Optional[ParserCapabilities] = None,
        metadata: Optional[Mapping[str, Any]] = None,
    ) -> "ParsedDocument":
        capabilities = parser_capabilities or ParserCapabilities(name=parser_name)
        blocks = [
            DocumentBlock.from_legacy_block(block, index=index, parser_name=parser_name)
            for index, block in enumerate(content_list)
        ]
        return cls(
            source_path=str(source_path),
            parser_name=parser_name,
            parser_capabilities=capabilities,
            metadata=dict(metadata or {}),
            blocks=blocks,
        )

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "ParsedDocument":
        return cls(
            source_path=str(data.get("source_path", "")),
            parser_name=str(data.get("parser_name", "unknown")),
            parser_capabilities=ParserCapabilities.from_dict(
                data.get("parser_capabilities", {"name": "unknown"})
            ),
            version=str(data.get("version", DOCUMENT_IR_VERSION)),
            metadata=dict(data.get("metadata", {})),
            blocks=[DocumentBlock.from_dict(block_data) for block_data in data.get("blocks", [])],
        )

    @property
    def block_count(self) -> int:
        return len(self.blocks)

    @property
    def block_type_counts(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for block in self.blocks:
            counts[block.block_type] = counts.get(block.block_type, 0) + 1
        return counts

    @property
    def text_content(self) -> str:
        return "\n\n".join(
            block.text for block in self.blocks if block.block_type == "text" and block.text
        )

    @property
    def multimodal_content_list(self) -> List[Dict[str, Any]]:
        return [block.to_legacy_dict() for block in self.blocks if block.block_type != "text"]

    def to_content_list(self) -> List[Dict[str, Any]]:
        return [block.to_legacy_dict() for block in self.blocks]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "source_path": self.source_path,
            "parser_name": self.parser_name,
            "parser_capabilities": self.parser_capabilities.to_dict(),
            "metadata": self.metadata,
            "blocks": [block.to_dict() for block in self.blocks],
        }

    def with_metadata(self, **metadata: Any) -> "ParsedDocument":
        merged_metadata = dict(self.metadata)
        merged_metadata.update(metadata)
        return ParsedDocument(
            source_path=self.source_path,
            parser_name=self.parser_name,
            parser_capabilities=self.parser_capabilities,
            version=self.version,
            metadata=merged_metadata,
            blocks=list(self.blocks),
        )

    def resolve_asset_paths(self) -> List[str]:
        resolved_paths: List[str] = []
        for block in self.blocks:
            for asset in block.assets:
                resolved_paths.append(str(Path(asset).expanduser()))
        return resolved_paths
