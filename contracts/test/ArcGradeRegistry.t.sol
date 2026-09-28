// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ArcGradeRegistry} from "../src/ArcGradeRegistry.sol";

contract ArcGradeRegistryTest is Test {
    ArcGradeRegistry public registry;

    uint256 public constant ARC_TESTNET_CHAIN_ID = 5042002;
    uint256 internal analystPrivateKey = 0xA11CE;
    address internal analyst;

    uint256 internal agentPrivateKey = 0xB0B;
    address internal agent;

    address internal relayer = address(0x999);

    event RatingAttested(
        bytes32 indexed id,
        string indexed slug,
        address indexed analyst,
        string letter,
        uint256 score,
        uint256 timestamp
    );

    event AgentRegistered(address indexed agent, string metadataUri, uint256 timestamp);

    function setUp() public {
        vm.chainId(ARC_TESTNET_CHAIN_ID);
        vm.warp(1750000000); // Realistic baseline timestamp

        analyst = vm.addr(analystPrivateKey);
        agent = vm.addr(agentPrivateKey);

        registry = new ArcGradeRegistry();
    }

    // --- Direct Attestation Tests ---

    function test_DirectAttestation_Success() public {
        vm.prank(analyst);

        vm.expectEmit(false, true, true, true, address(registry));
        emit RatingAttested(
            bytes32(0),
            "aave-v4-arc",
            analyst,
            "A",
            88,
            block.timestamp
        );

        bytes32 id = registry.attest("aave-v4-arc", "A", 88);
        assertTrue(id != bytes32(0), "Attestation ID should be non-zero");

        assertEq(registry.getAttestationCount("aave-v4-arc"), 1);
        assertEq(registry.totalAttestationsByAnalyst(analyst), 1);

        ArcGradeRegistry.Attestation memory record = registry.getLatestAttestation("aave-v4-arc");
        assertEq(record.slug, "aave-v4-arc");
        assertEq(record.letter, "A");
        assertEq(record.score, 88);
        assertEq(record.analyst, analyst);
        assertEq(record.timestamp, block.timestamp);
        assertEq(record.signature.length, 0);

        ArcGradeRegistry.Attestation memory byIndex = registry.getAttestationByIndex("aave-v4-arc", 0);
        assertEq(byIndex.slug, record.slug);
        assertEq(byIndex.score, record.score);
        assertEq(byIndex.analyst, record.analyst);
    }

    function test_DirectAttestation_RevertInvalidScore() public {
        vm.prank(analyst);
        vm.expectRevert("Invalid score: must be 0-100");
        registry.attest("aave-v4-arc", "A", 101);
    }

    function test_DirectAttestation_RevertEmptySlug() public {
        vm.prank(analyst);
        vm.expectRevert("Empty slug");
        registry.attest("", "A", 88);
    }

    function test_DirectAttestation_RevertEmptyLetter() public {
        vm.prank(analyst);
        vm.expectRevert("Empty letter");
        registry.attest("aave-v4-arc", "", 88);
    }

    // --- EIP-712 Attestation With Signature Tests ---

    function test_AttestWithSig_RecoveredSignerSuccess() public {
        string memory slug = "morpho-vault-arc";
        string memory letter = "AA";
        uint256 score = 92;
        uint256 timestamp = block.timestamp;

        bytes32 digest = registry.hashAttestation(slug, letter, score, timestamp);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(analystPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Submitted by a relayer on behalf of the analyst
        vm.prank(relayer);
        bytes32 id = registry.attestWithSig(slug, letter, score, timestamp, signature);
        assertTrue(id != bytes32(0));

        assertEq(registry.getAttestationCount(slug), 1);
        assertEq(registry.totalAttestationsByAnalyst(analyst), 1);

        ArcGradeRegistry.Attestation memory record = registry.getLatestAttestation(slug);
        assertEq(record.analyst, analyst);
        assertEq(record.score, score);
        assertEq(record.letter, letter);
        assertEq(record.signature, signature);
    }

    function test_AttestWithSig_WithExplicitAnalystSuccess() public {
        string memory slug = "uniswap-v4-arc";
        string memory letter = "AAA";
        uint256 score = 96;
        uint256 timestamp = block.timestamp;

        bytes32 digest = registry.hashAttestation(slug, letter, score, analyst, timestamp);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(analystPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(relayer);
        bytes32 id = registry.attestWithSig(slug, letter, score, analyst, timestamp, signature);
        assertTrue(id != bytes32(0));

        ArcGradeRegistry.Attestation memory record = registry.getLatestAttestation(slug);
        assertEq(record.analyst, analyst);
        assertEq(record.score, score);
    }

    function test_AttestWithSig_ReplayProtection() public {
        string memory slug = "aave-v4-arc";
        string memory letter = "B";
        uint256 score = 65;
        uint256 timestamp = block.timestamp;

        bytes32 digest = registry.hashAttestation(slug, letter, score, timestamp);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(analystPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // First attestation succeeds
        registry.attestWithSig(slug, letter, score, timestamp, signature);

        // Second attestation with same signature must revert
        vm.expectRevert("Signature already used");
        registry.attestWithSig(slug, letter, score, timestamp, signature);
    }

    function test_AttestWithSig_RevertExpiredSignature() public {
        string memory slug = "aave-v4-arc";
        string memory letter = "B";
        uint256 score = 65;
        uint256 timestamp = block.timestamp;

        bytes32 digest = registry.hashAttestation(slug, letter, score, timestamp);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(analystPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Warp past MAX_ATTESTATION_AGE (7 days)
        vm.warp(timestamp + 7 days + 1 seconds);

        vm.expectRevert("Signature expired");
        registry.attestWithSig(slug, letter, score, timestamp, signature);
    }

    function test_AttestWithSig_RevertFutureTimestamp() public {
        string memory slug = "aave-v4-arc";
        string memory letter = "B";
        uint256 score = 65;
        uint256 timestamp = block.timestamp + 10 minutes;

        bytes32 digest = registry.hashAttestation(slug, letter, score, timestamp);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(analystPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert("Attestation timestamp in future");
        registry.attestWithSig(slug, letter, score, timestamp, signature);
    }

    function test_AttestWithSig_RevertInvalidSignatureLength() public {
        bytes memory badSignature = hex"123456";
        vm.expectRevert("Invalid signature length");
        registry.attestWithSig("aave-v4-arc", "A", 85, block.timestamp, badSignature);
    }

    function test_AttestWithSig_RevertTamperedScore() public {
        string memory slug = "aave-v4-arc";
        string memory letter = "A";
        uint256 originalScore = 85;
        uint256 tamperedScore = 99;
        uint256 timestamp = block.timestamp;

        // Analyst signs for 85
        bytes32 digest = registry.hashAttestation(slug, letter, originalScore, timestamp);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(analystPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Relayer tries to submit tampered score 99 with analyst's explicit address
        vm.expectRevert("Signature verification failed");
        registry.attestWithSig(slug, letter, tamperedScore, analyst, timestamp, signature);
    }

    // --- Agent Identity & Reputation Tests (ERC-8004 / ERC-8183) ---

    function test_AgentRegistration_AndReputationTracking() public {
        string memory uri = "ipfs://QmArcGradeAgentMetadataCard/v1";

        assertFalse(registry.isRegisteredAgent(agent));

        vm.prank(agent);
        vm.expectEmit(true, false, false, true, address(registry));
        emit AgentRegistered(agent, uri, block.timestamp);
        registry.registerAgent(uri);

        assertTrue(registry.isRegisteredAgent(agent));
        assertEq(registry.agentMetadataUri(agent), uri);

        // Autonomous agent performs multiple risk attestations
        vm.startPrank(agent);
        registry.attest("aave-v4-arc", "A", 85);
        registry.attest("morpho-vault-arc", "AA", 92);
        registry.attest("uniswap-v4-arc", "AAA", 98);
        vm.stopPrank();

        // Check cumulative reputation volume
        assertEq(registry.totalAttestationsByAnalyst(agent), 3);
    }

    function test_RegisterAgent_RevertEmptyUri() public {
        vm.prank(agent);
        vm.expectRevert("Empty metadata URI");
        registry.registerAgent("");
    }

    // --- Query Views Tests ---

    function test_QueryViews_MultiAttestation() public {
        string memory slug = "compound-v3-arc";

        vm.prank(analyst);
        registry.attest(slug, "BBB", 75);

        vm.warp(block.timestamp + 1 hours);
        vm.prank(agent);
        registry.attest(slug, "A", 82);

        assertEq(registry.getAttestationCount(slug), 2);

        ArcGradeRegistry.Attestation memory first = registry.getAttestationByIndex(slug, 0);
        assertEq(first.score, 75);
        assertEq(first.analyst, analyst);

        ArcGradeRegistry.Attestation memory latest = registry.getLatestAttestation(slug);
        assertEq(latest.score, 82);
        assertEq(latest.analyst, agent);

        ArcGradeRegistry.Attestation[] memory all = registry.getAllAttestations(slug);
        assertEq(all.length, 2);
        assertEq(all[0].score, 75);
        assertEq(all[1].score, 82);
    }

    function test_GetLatestAttestation_RevertEmpty() public {
        vm.expectRevert("No attestations for slug");
        registry.getLatestAttestation("nonexistent-protocol");
    }

    function test_GetAttestationByIndex_RevertOutOfBounds() public {
        vm.prank(analyst);
        registry.attest("aave-v4-arc", "A", 85);

        vm.expectRevert("Index out of bounds");
        registry.getAttestationByIndex("aave-v4-arc", 1);
    }

    // --- Domain Separator Tests ---

    function test_DomainSeparator_Config() public view {
        bytes32 sep = registry.domainSeparator();
        assertTrue(sep != bytes32(0));
    }
}
