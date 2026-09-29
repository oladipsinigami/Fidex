// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ArcGradeRegistry
 * @notice Immutable on-chain risk rating registry on Circle Arc Testnet (Chain ID: 5042002).
 * Allows certified Web3 risk analysts and autonomous AI agents to record cryptographic risk
 * attestations on-chain via direct transactions or EIP-712 structured data signatures.
 * Incorporates ERC-8004 / ERC-8183 autonomous agent identity and reputation primitives.
 */
contract ArcGradeRegistry is EIP712 {
    using ECDSA for bytes32;

    // --- Types & Constants ---

    /// @notice Attestation record representing an institutional risk evaluation.
    struct Attestation {
        string slug;
        string letter;
        uint256 score;       // 0 to 100
        address analyst;
        uint256 timestamp;
        bytes signature;
    }

    /// @notice Target Circle Arc Testnet chain ID.
    uint256 public constant ARC_TESTNET_CHAIN_ID = 5042002;

    /// @notice Maximum allowed age for an attestation signature (7 days).
    uint256 public constant MAX_ATTESTATION_AGE = 7 days;

    /// @notice EIP-712 TypeHash without explicit analyst parameter (recovering analyst directly from signature).
    bytes32 public constant RATING_ATTESTATION_TYPEHASH = keccak256(
        "RatingAttestation(string slug,string letter,uint256 score,uint256 timestamp)"
    );

    /// @notice EIP-712 TypeHash with explicit analyst parameter.
    bytes32 public constant RATING_ATTESTATION_WITH_ANALYST_TYPEHASH = keccak256(
        "RatingAttestation(string slug,string letter,uint256 score,address analyst,uint256 timestamp)"
    );

    // --- State Variables ---

    /// @notice Protocol slug => array of historical attestations.
    mapping(string => Attestation[]) private _slugAttestations;

    /// @notice Signature hash => whether signature has already been consumed (replay protection).
    mapping(bytes32 => bool) public usedSignatures;

    /// @notice Analyst / agent address => total lifetime verified attestations submitted.
    mapping(address => uint256) public totalAttestationsByAnalyst;

    /// @notice Autonomous AI agent registration flag (ERC-8004 / ERC-8183).
    mapping(address => bool) public isRegisteredAgent;

    /// @notice Registered agent address => off-chain metadata URI (e.g. IPFS / HTTPS).
    mapping(address => string) public agentMetadataUri;

    // --- Events ---

    /// @notice Emitted when a new rating attestation is recorded.
    event RatingAttested(
        bytes32 indexed id,
        string indexed slug,
        address indexed analyst,
        string letter,
        uint256 score,
        uint256 timestamp
    );

    /// @notice Emitted when an autonomous AI agent registers its identity URI.
    event AgentRegistered(address indexed agent, string metadataUri, uint256 timestamp);

    // --- Constructor ---

    constructor() EIP712("Fidex Studio", "1") {}

    // --- Attestation Functions ---

    /**
     * @notice Allows msg.sender (analyst or autonomous AI agent) to attest directly on-chain.
     * @param slug The unique protocol identifier (e.g. "aave-v4-arc").
     * @param letter The letter grade (e.g. "A", "BBB", "D").
     * @param score The numerical composite grade (0 - 100).
     * @return id Unique identifier for the recorded attestation.
     */
    function attest(
        string calldata slug,
        string calldata letter,
        uint256 score
    ) external returns (bytes32 id) {
        _validateInputs(slug, letter, score);

        uint256 timestamp = block.timestamp;
        id = _recordAttestation(slug, letter, score, msg.sender, timestamp, "");
    }

    /**
     * @notice Records an attestation using an analyst's EIP-712 signature.
     * Recovers the analyst's address directly from the signature with replay protection.
     * @param slug The protocol slug.
     * @param letter The letter grade.
     * @param score The numerical composite score (0 - 100).
     * @param timestamp The timestamp when the analyst signed the attestation.
     * @param signature The EIP-712 cryptographic signature.
     * @return id Unique identifier for the recorded attestation.
     */
    function attestWithSig(
        string calldata slug,
        string calldata letter,
        uint256 score,
        uint256 timestamp,
        bytes calldata signature
    ) external returns (bytes32 id) {
        _validateInputs(slug, letter, score);
        _validateTimestampAndSignature(timestamp, signature);

        // Compute typed data digest without explicit analyst (recovering signer as analyst)
        bytes32 structHashNoAnalyst = keccak256(
            abi.encode(
                RATING_ATTESTATION_TYPEHASH,
                keccak256(bytes(slug)),
                keccak256(bytes(letter)),
                score,
                timestamp
            )
        );
        bytes32 digestNoAnalyst = _hashTypedDataV4(structHashNoAnalyst);

        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(digestNoAnalyst, signature);
        address analyst;

        if (err == ECDSA.RecoverError.NoError && recovered != address(0)) {
            analyst = recovered;
        } else {
            // Fallback: check if signed with RATING_ATTESTATION_WITH_ANALYST_TYPEHASH and msg.sender
            bytes32 structHashWithAnalyst = keccak256(
                abi.encode(
                    RATING_ATTESTATION_WITH_ANALYST_TYPEHASH,
                    keccak256(bytes(slug)),
                    keccak256(bytes(letter)),
                    score,
                    msg.sender,
                    timestamp
                )
            );
            bytes32 digestWithAnalyst = _hashTypedDataV4(structHashWithAnalyst);
            address recoveredSender = ECDSA.recover(digestWithAnalyst, signature);
            require(recoveredSender == msg.sender, "Invalid signature");
            analyst = msg.sender;
        }

        id = _recordAttestation(slug, letter, score, analyst, timestamp, signature);
    }

    /**
     * @notice Records an attestation specifying the expected analyst address in the EIP-712 struct.
     * @param slug The protocol slug.
     * @param letter The letter grade.
     * @param score The numerical composite score (0 - 100).
     * @param analyst The address of the certified analyst who produced the signature.
     * @param timestamp The timestamp when the analyst signed the attestation.
     * @param signature The EIP-712 cryptographic signature.
     * @return id Unique identifier for the recorded attestation.
     */
    function attestWithSig(
        string calldata slug,
        string calldata letter,
        uint256 score,
        address analyst,
        uint256 timestamp,
        bytes calldata signature
    ) external returns (bytes32 id) {
        _validateInputs(slug, letter, score);
        require(analyst != address(0), "Invalid analyst address");
        _validateTimestampAndSignature(timestamp, signature);

        bytes32 structHash = keccak256(
            abi.encode(
                RATING_ATTESTATION_WITH_ANALYST_TYPEHASH,
                keccak256(bytes(slug)),
                keccak256(bytes(letter)),
                score,
                analyst,
                timestamp
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        require(recovered == analyst, "Signature verification failed");

        id = _recordAttestation(slug, letter, score, analyst, timestamp, signature);
    }

    // --- Agent Identity & Reputation (ERC-8004 / ERC-8183) ---

    /**
     * @notice Allows an autonomous AI agent to declare its identity URI on-chain.
     * @param metadataUri URI pointing to agent card, schema, or model weights metadata.
     */
    function registerAgent(string calldata metadataUri) external {
        require(bytes(metadataUri).length > 0, "Empty metadata URI");

        isRegisteredAgent[msg.sender] = true;
        agentMetadataUri[msg.sender] = metadataUri;

        emit AgentRegistered(msg.sender, metadataUri, block.timestamp);
    }

    // --- Queries ---

    /**
     * @notice Returns the latest recorded attestation for a given protocol.
     * @param slug The protocol slug.
     */
    function getLatestAttestation(string calldata slug) external view returns (Attestation memory) {
        uint256 count = _slugAttestations[slug].length;
        require(count > 0, "No attestations for slug");
        return _slugAttestations[slug][count - 1];
    }

    /**
     * @notice Returns the total number of attestations recorded for a protocol.
     * @param slug The protocol slug.
     */
    function getAttestationCount(string calldata slug) external view returns (uint256) {
        return _slugAttestations[slug].length;
    }

    /**
     * @notice Returns an attestation for a protocol by index.
     * @param slug The protocol slug.
     * @param index The 0-based index.
     */
    function getAttestationByIndex(string calldata slug, uint256 index) external view returns (Attestation memory) {
        require(index < _slugAttestations[slug].length, "Index out of bounds");
        return _slugAttestations[slug][index];
    }

    /**
     * @notice Returns all attestations recorded for a protocol.
     * @param slug The protocol slug.
     */
    function getAllAttestations(string calldata slug) external view returns (Attestation[] memory) {
        return _slugAttestations[slug];
    }

    /**
     * @notice Returns the EIP-712 domain separator used by this contract.
     */
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Computes the typed data digest for an attestation without explicit analyst field.
     */
    function hashAttestation(
        string calldata slug,
        string calldata letter,
        uint256 score,
        uint256 timestamp
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                RATING_ATTESTATION_TYPEHASH,
                keccak256(bytes(slug)),
                keccak256(bytes(letter)),
                score,
                timestamp
            )
        );
        return _hashTypedDataV4(structHash);
    }

    /**
     * @notice Computes the typed data digest for an attestation with explicit analyst field.
     */
    function hashAttestation(
        string calldata slug,
        string calldata letter,
        uint256 score,
        address analyst,
        uint256 timestamp
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                RATING_ATTESTATION_WITH_ANALYST_TYPEHASH,
                keccak256(bytes(slug)),
                keccak256(bytes(letter)),
                score,
                analyst,
                timestamp
            )
        );
        return _hashTypedDataV4(structHash);
    }

    // --- Internal Helpers ---

    function _validateInputs(
        string calldata slug,
        string calldata letter,
        uint256 score
    ) internal pure {
        require(bytes(slug).length > 0, "Empty slug");
        require(bytes(letter).length > 0, "Empty letter");
        require(score <= 100, "Invalid score: must be 0-100");
    }

    function _validateTimestampAndSignature(uint256 timestamp, bytes calldata signature) internal {
        require(signature.length == 65, "Invalid signature length");
        require(timestamp <= block.timestamp + 5 minutes, "Attestation timestamp in future");
        require(block.timestamp <= timestamp + MAX_ATTESTATION_AGE, "Signature expired");

        bytes32 sigHash = keccak256(signature);
        require(!usedSignatures[sigHash], "Signature already used");
        usedSignatures[sigHash] = true;
    }

    function _recordAttestation(
        string calldata slug,
        string calldata letter,
        uint256 score,
        address analyst,
        uint256 timestamp,
        bytes memory signature
    ) internal returns (bytes32 id) {
        uint256 currentIndex = _slugAttestations[slug].length;
        id = keccak256(abi.encode(slug, analyst, score, timestamp, currentIndex));

        Attestation memory record = Attestation({
            slug: slug,
            letter: letter,
            score: score,
            analyst: analyst,
            timestamp: timestamp,
            signature: signature
        });

        _slugAttestations[slug].push(record);
        totalAttestationsByAnalyst[analyst]++;

        emit RatingAttested(id, slug, analyst, letter, score, timestamp);
    }
}
