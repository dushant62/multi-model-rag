"""Lightweight logging helpers for the ``multi_model_rag`` package.

Libraries should not configure global logging; they should emit records to
named loggers and let the embedding application decide how those records
are rendered. This module exposes :func:`get_logger` and attaches a
``NullHandler`` to the package-root logger so importing ``multi_model_rag``
never triggers ``"No handlers could be found"`` warnings.

Application / CLI entry points that want human-readable output can call
:func:`configure_default_logging` once at startup; library code should not.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

_PACKAGE_ROOT = __name__.rsplit(".", 1)[0]

# Attach a NullHandler once so the library is silent by default.
logging.getLogger(_PACKAGE_ROOT).addHandler(logging.NullHandler())


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Return a child logger under the ``multi_model_rag`` namespace.

    Parameters
    ----------
    name:
        Either a dotted module path (``multi_model_rag.parser``) or a bare
        module name (``parser``). ``None`` returns the package-root logger.
    """
    if not name:
        return logging.getLogger(_PACKAGE_ROOT)
    if name.startswith(_PACKAGE_ROOT):
        return logging.getLogger(name)
    return logging.getLogger(f"{_PACKAGE_ROOT}.{name}")


def configure_default_logging(level: Optional[str] = None) -> None:
    """Best-effort console logging for CLI entry points.

    Respects ``MULTIMODEL_LOG_LEVEL`` when ``level`` is not provided. Idempotent:
    it will not attach a second handler if one is already configured.
    """
    root = logging.getLogger(_PACKAGE_ROOT)
    if any(not isinstance(h, logging.NullHandler) for h in root.handlers):
        return  # already configured

    resolved = (level or os.environ.get("MULTIMODEL_LOG_LEVEL") or "INFO").upper()
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root.addHandler(handler)
    root.setLevel(resolved)
