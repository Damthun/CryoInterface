"""
Module for the Metadata class.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Metadata:
    """
    Dataclass for storing experimental metadata.
    """
    experiment_title: str
    name: str
    cpa: str
    date: str
    logger: Optional[str]
    temp1: Optional[str]
    temp2: Optional[str]
    temp3: Optional[str]
    temp4: Optional[str]
    vna1: Optional[str]
    vna2: Optional[str]
    vna1_type: Optional[str]
    vna2_type: Optional[str]
    v1_associated: Optional[str]
    v2_associated: Optional[str]
