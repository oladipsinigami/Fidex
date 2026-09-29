// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ArcGradeRegistry} from "./ArcGradeRegistry.sol";

/**
 * @title FidexRegistry
 * @notice Immutable on-chain risk rating registry on Circle Arc (Chain ID: 5042002).
 * Allows certified Web3 risk analysts and autonomous AI agents to record cryptographic risk
 * attestations on-chain via direct transactions or EIP-712 structured data signatures.
 * Incorporates ERC-8004 / ERC-8183 autonomous agent identity and reputation primitives.
 */
contract FidexRegistry is ArcGradeRegistry {}
