// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title  FidexRegistry
/// @notice Immutable EIP-712 institutional-grade attestation registry on Circle Arc.
///         Supports direct on-chain attestations, EIP-712 signed attestations with
///         replay protection, and autonomous AI-agent identity & reputation registry
///         adhering to ERC-8004 / ERC-8183.
///
/// @dev    Backward-compatible superset of ArcGradeRegistry:
///           - Same storage layout and external interface.
///           - Domain name updated to "Fidex Studio"; version stays "1".
///           - ATTESTATION_EXPIRY extended to 7 days for the institutional analyst window.
///           - Added `getAllAttestations(slug)` bulk getter.
///           - Chain-ID constants for Arc Mainnet (5042) and Testnet (5042002) exposed.
///
///         `ArcGradeRegistry` is intentionally NOT imported here to avoid a second
///         compilation artifact that diverges from the official Fidex domain.  Any
///         existing deployment of ArcGradeRegistry continues to function unchanged on
///         its own address; this contract is the canonical Fidex Mainnet successor.
/// @dev    Successor to ArcGradeRegistry. Note the "same storage layout" claim
///           in the original header was incorrect -- that contract has five
///           mappings beginning `_slugAttestations`, this one has a different
///           set and order. There is no upgrade path from one to the other,
///           which is intentional: the pre-rebrand contract is not deployed
///           anywhere.
///
///         ANALYST ALLOWLIST
///         ------------------
///         Both write paths require the acting analyst to be allowlisted by the
///         owner. Without that, `attest()` had no signature, no allowlist and no
///         stake: anyone could publish an "A" for any slug and
///         `getLatestAttestation` would return it. On mainnet such a record is
///         permanent, which contradicts the product claim that protocols cannot
///         purchase ratings.
///
///         Ownership is two-step, so a mistyped owner update cannot brick the
///         allowlist.
contract FidexRegistry is EIP712, Ownable2Step {
    using ECDSA for bytes32;

    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Arc Mainnet chain ID.
    uint256 public constant ARC_MAINNET_CHAIN_ID = 5042;

    /// @notice Arc Testnet chain ID.
    uint256 public constant ARC_TESTNET_CHAIN_ID = 5042002;

    /// @notice Window within which an EIP-712 signed attestation is valid.
    ///         Matches the institutional analyst signing window (7 days).
    uint256 public constant ATTESTATION_EXPIRY = 7 days;

    bytes32 private constant RATING_ATTESTATION_TYPEHASH =
        keccak256(
            "RatingAttestation(string slug,string letter,uint256 score,address analyst,uint256 timestamp)"
        );

    // =========================================================================
    // Types
    // =========================================================================

    struct Attestation {
        string  slug;
        string  letter;
        uint256 score;
        address analyst;
        uint256 timestamp;
        bytes   signature;
    }

    // =========================================================================
    // Storage
    // =========================================================================

    /// @dev Per-slug ordered list of all attestations.
    mapping(string slug  => Attestation[])  private _attestationsBySlug;

    /// @dev Per-analyst ordered list of all attestations (secondary index).
    mapping(address analyst => Attestation[]) private _attestationsByAnalyst;

    /// @notice Tracks which EIP-712 digests have already been consumed.
    ///         Keyed by the full typed-data digest, NOT the raw signature bytes,
    ///         so alternate ECDSA encodings (65-byte vs ERC-2098 compact) that
    ///         recover to the same signer cannot bypass replay protection.
    mapping(bytes32 sigHash => bool) public usedSignatures;

    /// @notice Total attestation count per analyst address.
    mapping(address => uint256) public totalAttestationsByAnalyst;

    /// @notice Returns true when the address has called `registerAgent` at least once.
    mapping(address => bool) public isRegisteredAgent;

    /// @notice Latest metadata URI registered by an agent (ERC-8004 / ERC-8183).
    mapping(address => string) public agentMetadataUri;

    /// @notice Certified analysts permitted to record attestations.
    /// @dev    Owner-controlled. The empty set is the default: a fresh deploy
    ///         accepts no attestations until the owner allowlists somebody, so a
    ///         forgotten configuration fails closed rather than leaving the
    ///         registry wide open.
    mapping(address => bool) public isApprovedAnalyst;

    // =========================================================================
    // Events
    // =========================================================================

    event RatingAttested(
        bytes32 indexed id,
        string  indexed slug,
        address indexed analyst,
        string  letter,
        uint256 score,
        uint256 timestamp
    );

    event AgentRegistered(
        address indexed agent,
        string  metadataUri,
        uint256 timestamp
    );

    /// @notice Emitted when the owner allowlists or de-lists an analyst.
    event AnalystApprovalUpdated(address indexed analyst, bool approved);

    /// @notice Emitted when the owner allowlists several analysts in one call.
    event AnalystsBatchUpdated(address[] analysts, bool approved);

    // =========================================================================
    // Errors
    // =========================================================================

    error ScoreOutOfRange(uint256 score);
    error EmptySlug();
    error EmptyLetter();
    error EmptyMetadataUri();
    error SignatureExpired(uint256 timestamp, uint256 blockTimestamp);
    error SignatureAlreadyUsed();
    error SlugNotFound(string slug);
    error IndexOutOfBounds(uint256 index, uint256 length);
    error InvalidSignature();
    error NotApprovedAnalyst(address analyst);
    error EmptyAnalystBatch();

    // =========================================================================
    // Constructor
    // =========================================================================

    /// @param initialOwner     Address that owns the analyst allowlist. Passed
    ///        explicitly rather than as `msg.sender` so the deployer can see
    ///        exactly who ends up able to approve analysts.
    /// @param initialAnalysts Addresses to allowlist at deployment. Empty by
    ///        default, which is the safe direction: a registry nobody has been
    ///        added to accepts no attestations.
    constructor(address initialOwner, address[] memory initialAnalysts)
        EIP712("Fidex Studio", "1")
        Ownable(initialOwner)
    {
        uint256 n = initialAnalysts.length;
        for (uint256 i; i < n; ++i) {
            address a = initialAnalysts[i];
            if (a == address(0)) continue;
            isApprovedAnalyst[a] = true;
            emit AnalystApprovalUpdated(a, true);
        }
        if (n > 0) emit AnalystsBatchUpdated(initialAnalysts, true);
    }

    // =========================================================================
    // Owner — analyst allowlist
    // =========================================================================

    /// @notice Allowlist or de-list a single analyst.
    function setAnalystApproval(address analyst, bool approved) external onlyOwner {
        if (analyst == address(0)) revert NotApprovedAnalyst(address(0));
        isApprovedAnalyst[analyst] = approved;
        emit AnalystApprovalUpdated(analyst, approved);
    }

    /// @notice Allowlist or de-list several analysts at once.
    function setAnalystApprovals(address[] calldata analysts, bool approved) external onlyOwner {
        uint256 n = analysts.length;
        if (n == 0) revert EmptyAnalystBatch();
        for (uint256 i; i < n; ++i) {
            address a = analysts[i];
            if (a == address(0)) continue;
            isApprovedAnalyst[a] = approved;
            emit AnalystApprovalUpdated(a, approved);
        }
        emit AnalystsBatchUpdated(analysts, approved);
    }

    /// @notice True when `analyst` may record attestations.
    function isAnalyst(address analyst) external view returns (bool) {
        return isApprovedAnalyst[analyst];
    }

    // =========================================================================
    // Write — direct attestation
    // =========================================================================

    /// @notice Record a rating attestation directly.  `msg.sender` is the analyst.
    /// @dev    Requires the caller to be an owner-approved analyst. Otherwise the
    ///         registry is an open board anyone can post an "A" to.
    /// @param  slug   Unique identifier for the rated entity.
    /// @param  letter Human-readable grade letter (e.g. "A", "B+").
    /// @param  score  Numeric score in the range [0, 100].
    /// @return id     Unique attestation identifier derived from slug, analyst, and timing.
    function attest(
        string calldata slug,
        string calldata letter,
        uint256 score
    ) external returns (bytes32 id) {
        _requireApproved(msg.sender);
        id = _storeAttestation(
            slug,
            letter,
            score,
            msg.sender,
            block.timestamp,
            bytes("")
        );
    }

    // =========================================================================
    // Write — EIP-712 signed attestation
    // =========================================================================

    /// @notice Record a rating attestation authorised by an EIP-712 off-chain signature.
    ///         The recovered signer must equal `analyst`.  The digest is marked used to
    ///         prevent replay attacks.
    ///
    /// @param  slug      Unique identifier for the rated entity.
    /// @param  letter    Human-readable grade letter.
    /// @param  score     Numeric score in [0, 100].
    /// @param  analyst   Address that signed the attestation.
    /// @param  timestamp UNIX timestamp the analyst included in the signed struct.
    ///                   Must be ≤ block.timestamp and within ATTESTATION_EXPIRY.
    /// @param  signature 65-byte ECDSA signature over the EIP-712 digest.
    /// @return id        Unique attestation identifier.
    function attestWithSig(
        string  calldata slug,
        string  calldata letter,
        uint256          score,
        address          analyst,
        uint256          timestamp,
        bytes   calldata signature
    ) external returns (bytes32 id) {
        _validateScore(score);
        _validateTextInputs(slug, letter);

        if (analyst == address(0)) revert InvalidSignature();

        // Reject future-dated timestamps to prevent long-delay submission attacks.
        if (timestamp > block.timestamp) {
            revert SignatureExpired(timestamp, block.timestamp);
        }

        if (timestamp + ATTESTATION_EXPIRY < block.timestamp) {
            revert SignatureExpired(timestamp, block.timestamp);
        }

        bytes32 structHash = _hashAttestation(slug, letter, score, analyst, timestamp);
        bytes32 digest     = _hashTypedDataV4(structHash);

        (address recovered, ECDSA.RecoverError recoverError) = _tryRecoverSig(digest, signature);

        if (
            recoverError != ECDSA.RecoverError.NoError ||
            recovered    == address(0)                 ||
            recovered    != analyst
        ) {
            revert InvalidSignature();
        }

        // Authorisation AFTER authentication: a caller who cannot produce a valid
        // signature learns nothing about who is on the allowlist, and the two
        // failure modes stay distinguishable -- a bad signature is
        // InvalidSignature, an unlisted signer is NotApprovedAnalyst.
        _requireApproved(analyst);

        // Key replay protection on the typed-data digest, not raw signature bytes.
        // This prevents re-use via alternate ECDSA encodings that recover to the
        // same signer (65-byte vs ERC-2098 compact).
        if (usedSignatures[digest]) {
            revert SignatureAlreadyUsed();
        }

        usedSignatures[digest] = true;

        id = _storeAttestation(slug, letter, score, analyst, timestamp, signature);
    }

    // =========================================================================
    // Write — agent identity registry (ERC-8004 / ERC-8183)
    // =========================================================================

    /// @notice Register or update the caller as an AI agent with an associated metadata URI.
    ///         Compatible with ERC-8004 / ERC-8183 on-chain agent identity.
    /// @param  metadataUri URI pointing to the agent card (e.g. IPFS CID or HTTPS URL).
    function registerAgent(string calldata metadataUri) external {
        if (bytes(metadataUri).length == 0) {
            revert EmptyMetadataUri();
        }

        isRegisteredAgent[msg.sender]  = true;
        agentMetadataUri[msg.sender]   = metadataUri;

        emit AgentRegistered(msg.sender, metadataUri, block.timestamp);
    }

    // =========================================================================
    // Read — query functions
    // =========================================================================

    /// @notice Returns the most recent attestation for the given slug.
    /// @dev    Reverts with `SlugNotFound` when no attestation has been recorded.
    function getLatestAttestation(string calldata slug)
        external
        view
        returns (Attestation memory)
    {
        Attestation[] storage list = _attestationsBySlug[slug];
        uint256 count = list.length;
        if (count == 0) revert SlugNotFound(slug);
        return list[count - 1];
    }

    /// @notice Returns the total number of attestations recorded for `slug`.
    function getAttestationCount(string calldata slug)
        external
        view
        returns (uint256)
    {
        return _attestationsBySlug[slug].length;
    }

    /// @notice Returns the attestation at `index` in the per-slug ordered list.
    /// @dev    Reverts with `IndexOutOfBounds` when `index >= count`.
    function getAttestationByIndex(string calldata slug, uint256 index)
        external
        view
        returns (Attestation memory)
    {
        Attestation[] storage list = _attestationsBySlug[slug];
        uint256 count = list.length;
        if (index >= count) revert IndexOutOfBounds(index, count);
        return list[index];
    }

    /// @notice Returns the full ordered history of attestations for `slug`.
    /// @dev    Returns an empty array (not a revert) when no attestations exist.
    ///         Callers should be aware of gas costs for slugs with long histories.
    function getAllAttestations(string calldata slug)
        external
        view
        returns (Attestation[] memory)
    {
        return _attestationsBySlug[slug];
    }

    // =========================================================================
    // Internal helpers
    // =========================================================================

    /// @dev Fails closed: an address not on the allowlist may not attest, and
    ///      the reason is explicit so a caller can tell "not certified" apart
    ///      from "bad signature".
    function _requireApproved(address analyst) internal view {
        if (!isApprovedAnalyst[analyst]) revert NotApprovedAnalyst(analyst);
    }

    function _storeAttestation(
        string  calldata slug,
        string  calldata letter,
        uint256          score,
        address          analyst,
        uint256          timestamp,
        bytes   memory   sig
    ) internal returns (bytes32 id) {
        _validateScore(score);
        _validateTextInputs(slug, letter);

        // Use abi.encode (not packed) and include the per-slug array length as a
        // monotonic nonce so two same-block same-analyst same-slug attestations
        // produce distinct ids.
        id = keccak256(
            abi.encode(
                keccak256(bytes(slug)),
                analyst,
                timestamp,
                block.number,
                _attestationsBySlug[slug].length
            )
        );

        Attestation memory item = Attestation({
            slug:      slug,
            letter:    letter,
            score:     score,
            analyst:   analyst,
            timestamp: timestamp,
            signature: sig
        });

        _attestationsBySlug[slug].push(item);
        _attestationsByAnalyst[analyst].push(item);

        unchecked {
            totalAttestationsByAnalyst[analyst] += 1;
        }

        emit RatingAttested(id, slug, analyst, letter, score, timestamp);
    }

    function _hashAttestation(
        string  calldata slug,
        string  calldata letter,
        uint256          score,
        address          analyst,
        uint256          timestamp
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                RATING_ATTESTATION_TYPEHASH,
                keccak256(bytes(slug)),
                keccak256(bytes(letter)),
                score,
                analyst,
                timestamp
            )
        );
    }

    /// @dev Wraps ECDSA.tryRecover to return only (signer, error), discarding the
    ///      third `errorArg` return value that Slither would otherwise flag as unused.
    function _tryRecoverSig(bytes32 digest, bytes calldata signature)
        internal
        pure
        returns (address signer, ECDSA.RecoverError err)
    {
        bytes32 errorArg;
        (signer, err, errorArg) = ECDSA.tryRecover(digest, signature);
        // errorArg is a diagnostic value unused on-chain; acknowledged here.
        errorArg;
    }

    function _validateScore(uint256 score) internal pure {
        if (score > 100) revert ScoreOutOfRange(score);
    }

    function _validateTextInputs(
        string calldata slug,
        string calldata letter
    ) internal pure {
        if (bytes(slug).length   == 0) revert EmptySlug();
        if (bytes(letter).length == 0) revert EmptyLetter();
    }
}
