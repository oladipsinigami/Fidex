// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {FidexRegistry} from "../src/FidexRegistry.sol";

/**
 * @title FidexRegistryTest
 * @notice Test coverage for FidexRegistry, the canonical contract intended for
 *         Circle Arc mainnet.
 *
 * @dev The pre-existing suite (ArcGradeRegistry.t.sol) targets
 *      ArcGradeRegistry, which is NOT the contract that gets deployed and is not
 *      deployed anywhere. This suite covers the contract that actually ships.
 *
 *      The behaviours most likely to matter on mainnet, and which were
 *      previously untested, are called out below.
 */
contract FidexRegistryTest is Test {
    FidexRegistry public registry;

    uint256 public constant ARC_MAINNET_CHAIN_ID = 5042;
    uint256 public constant ARC_TESTNET_CHAIN_ID = 5042002;

    uint256 internal analystPk = 0xA11CE;
    address internal analyst;

    uint256 internal otherPk = 0xB0B;
    address internal other;

    uint256 internal agentPk = 0xC0FFEE;
    address internal agent;

    bytes32 internal TYPEHASH;

    /// Approved at construction so existing behaviour tests keep exercising the
    /// signature and validation paths rather than the allowlist.
    address[] internal _seed;

    event RatingAttested(
        bytes32 indexed id,
        string indexed slug,
        address indexed analyst,
        string letter,
        uint256 score,
        uint256 timestamp
    );
    event AgentRegistered(address indexed agent, string metadataUri, uint256 timestamp);
    event AnalystApprovalUpdated(address indexed analyst, bool approved);

    function setUp() public {
        vm.chainId(ARC_MAINNET_CHAIN_ID);
        vm.warp(1750000000);

        analyst = vm.addr(analystPk);
        other = vm.addr(otherPk);
        agent = vm.addr(agentPk);

        // Allowlist the primary analyst so the signature/validation tests keep
        // exercising those paths rather than tripping the allowlist first.
        _seed = new address[](1);
        _seed[0] = analyst;

        registry = new FidexRegistry(address(this), _seed);

        TYPEHASH = keccak256(
            "RatingAttestation(string slug,string letter,uint256 score,address analyst,uint256 timestamp)"
        );
    }

    // --- helpers -----------------------------------------------------------

    function _digest(string memory slug, string memory letter, uint256 score, address who, uint256 ts)
        internal
        view
        returns (bytes32)
    {
        bytes32 domain = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("Fidex Studio")),
                keccak256(bytes("1")),
                block.chainid,
                address(registry)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(TYPEHASH, keccak256(bytes(slug)), keccak256(bytes(letter)), score, who, ts)
        );
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
    }

    function _sign(uint256 pk, bytes32 d) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, d);
        return abi.encodePacked(r, s, v);
    }

    // --- constants and domain ----------------------------------------------

    /// @dev Guards the chain-ID constants the contract advertises.
    function test_Constants_MatchArc() public view {
        assertEq(registry.ARC_MAINNET_CHAIN_ID(), ARC_MAINNET_CHAIN_ID);
        assertEq(registry.ARC_TESTNET_CHAIN_ID(), ARC_TESTNET_CHAIN_ID);
        assertEq(registry.ATTESTATION_EXPIRY(), 7 days);
    }

    /// @dev The EIP-712 domain must bind to chainId, otherwise a signature
    ///      produced with the testnet chain id (5042002) would also validate on
    ///      mainnet (5042) -- exactly the failure mode that has to be ruled out
    ///      before shipping. Behavioural, because the contract does not expose
    ///      domainSeparator() for direct inspection.
    function test_Eip712Domain_BindsToChainId() public {
        // Sign under mainnet (5042), then try to replay on testnet (5042002).
        bytes32 mainnetDigest = _digest("cirbtc", "D", 53, analyst, block.timestamp);
        bytes memory sig = _sign(analystPk, mainnetDigest);

        FidexRegistry testnetRegistry = new FidexRegistry(address(this), _seed);
        vm.chainId(ARC_TESTNET_CHAIN_ID);

        vm.expectRevert(FidexRegistry.InvalidSignature.selector);
        testnetRegistry.attestWithSig("cirbtc", "D", 53, analyst, block.timestamp, sig);
    }

    /// @dev And the reverse direction, so neither chain accepts the other's
    ///      signatures.
    function test_Eip712Domain_RejectsCrossChainReplay() public {
        vm.chainId(ARC_TESTNET_CHAIN_ID);
        FidexRegistry testnetRegistry = new FidexRegistry(address(this), _seed);
        bytes32 testnetDigest = _digest("cirbtc", "D", 53, analyst, block.timestamp);
        bytes memory sig = _sign(analystPk, testnetDigest);

        vm.chainId(ARC_MAINNET_CHAIN_ID);
        vm.expectRevert(FidexRegistry.InvalidSignature.selector);
        registry.attestWithSig("cirbtc", "D", 53, analyst, block.timestamp, sig);
    }

    // --- direct attestation -------------------------------------------------

    function test_attest_Success() public {
        vm.prank(analyst);
        // `id` is an indexed topic and is only knowable after the call, so
        // topic1 is skipped -- the same approach as the ArcGradeRegistry suite.
        vm.expectEmit(false, true, true, true, address(registry));
        emit RatingAttested(
            bytes32(0), "aave-v4-arc", analyst, "A", 88, block.timestamp
        );
        bytes32 id = registry.attest("aave-v4-arc", "A", 88);
        assertTrue(id != bytes32(0));
        assertEq(registry.getAttestationCount("aave-v4-arc"), 1);
        assertEq(registry.totalAttestationsByAnalyst(analyst), 1);
    }

    function test_attest_RevertWhen_ScoreAbove100() public {
        vm.prank(analyst);
        vm.expectRevert(abi.encodeWithSelector(FidexRegistry.ScoreOutOfRange.selector, 101));
        registry.attest("x", "A", 101);
    }

    function test_attest_RevertWhen_EmptySlug() public {
        vm.prank(analyst);
        vm.expectRevert(FidexRegistry.EmptySlug.selector);
        registry.attest("", "A", 50);
    }

    function test_attest_RevertWhen_EmptyLetter() public {
        vm.prank(analyst);
        vm.expectRevert(FidexRegistry.EmptyLetter.selector);
        registry.attest("x", "", 50);
    }

    /// @dev `letter` is only checked for non-emptiness, so any string is a
    ///      valid grade. Pinned deliberately: this is a known data-integrity gap
    ///      and the test documents the current behaviour rather than hiding it.
    function test_attest_AllowsArbitraryLetterString() public {
        vm.prank(analyst);
        registry.attest("x", "not-a-grade", 50);
        FidexRegistry.Attestation memory a = registry.getLatestAttestation("x");
        assertEq(a.letter, "not-a-grade");
    }

    // --- signed attestation -------------------------------------------------

    function test_attestWithSig_Success() public {
        bytes32 d = _digest("cirbtc", "D", 53, analyst, block.timestamp);
        bytes memory sig = _sign(analystPk, d);

        bytes32 id = registry.attestWithSig("cirbtc", "D", 53, analyst, block.timestamp, sig);
        assertTrue(id != bytes32(0));
        FidexRegistry.Attestation memory a = registry.getLatestAttestation("cirbtc");
        assertEq(a.analyst, analyst);
        assertEq(a.letter, "D");
        assertEq(a.score, 53);
    }

    /// @dev The recovered signer must equal the declared analyst.
    function test_attestWithSig_RevertWhen_SignerIsNotAnalyst() public {
        bytes32 d = _digest("cirbtc", "A", 90, analyst, block.timestamp);
        bytes memory sig = _sign(analystPk, d); // signed by `analyst`...

        vm.expectRevert(FidexRegistry.InvalidSignature.selector);
        registry.attestWithSig("cirbtc", "A", 90, other, block.timestamp, sig); // ...claimed by `other`
    }

    /// @dev Replay is keyed on the typed-data digest, so the same signature can
    ///      never mint a second attestation.
    function test_attestWithSig_RevertWhen_Replayed() public {
        bytes32 d = _digest("cirbtc", "D", 53, analyst, block.timestamp);
        bytes memory sig = _sign(analystPk, d);

        registry.attestWithSig("cirbtc", "D", 53, analyst, block.timestamp, sig);

        vm.expectRevert(FidexRegistry.SignatureAlreadyUsed.selector);
        registry.attestWithSig("cirbtc", "D", 53, analyst, block.timestamp, sig);
    }

    /// @dev A signature for one score must not validate a different score.
    function test_attestWithSig_RevertWhen_TamperedScore() public {
        bytes32 d = _digest("cirbtc", "D", 53, analyst, block.timestamp);
        bytes memory sig = _sign(analystPk, d);

        vm.expectRevert(FidexRegistry.InvalidSignature.selector);
        registry.attestWithSig("cirbtc", "D", 99, analyst, block.timestamp, sig);
    }

    function test_attestWithSig_RevertWhen_Expired() public {
        uint256 stale = block.timestamp - 8 days;
        bytes32 d = _digest("cirbtc", "D", 53, analyst, stale);
        bytes memory sig = _sign(analystPk, d);

        vm.expectRevert(
            abi.encodeWithSelector(FidexRegistry.SignatureExpired.selector, stale, block.timestamp)
        );
        registry.attestWithSig("cirbtc", "D", 53, analyst, stale, sig);
    }

    function test_attestWithSig_RevertWhen_FutureDated() public {
        uint256 future = block.timestamp + 1 hours;
        bytes32 d = _digest("cirbtc", "D", 53, analyst, future);
        bytes memory sig = _sign(analystPk, d);

        vm.expectRevert(
            abi.encodeWithSelector(FidexRegistry.SignatureExpired.selector, future, block.timestamp)
        );
        registry.attestWithSig("cirbtc", "D", 53, analyst, future, sig);
    }

    /// @dev Short signatures must be rejected before any hashing occurs.
    function test_attestWithSig_RevertWhen_BadSignatureLength() public {
        bytes32 d = _digest("cirbtc", "D", 53, analyst, block.timestamp);
        vm.expectRevert(FidexRegistry.InvalidSignature.selector);
        registry.attestWithSig("cirbtc", "D", 53, analyst, block.timestamp, hex"1234");
    }

    function test_attestWithSig_RevertWhen_ZeroAnalyst() public {
        bytes32 d = _digest("cirbtc", "D", 53, address(0), block.timestamp);
        bytes memory sig = _sign(analystPk, d);
        vm.expectRevert(FidexRegistry.InvalidSignature.selector);
        registry.attestWithSig("cirbtc", "D", 53, address(0), block.timestamp, sig);
    }

    // --- agent identity -----------------------------------------------------

    function test_registerAgent_Success() public {
        vm.prank(agent);
        vm.expectEmit(true, false, false, true, address(registry));
        emit AgentRegistered(agent, "ipfs://agent-card", block.timestamp);
        registry.registerAgent("ipfs://agent-card");

        assertTrue(registry.isRegisteredAgent(agent));
        assertEq(registry.agentMetadataUri(agent), "ipfs://agent-card");
    }

    function test_registerAgent_RevertWhen_EmptyUri() public {
        vm.prank(agent);
        vm.expectRevert(FidexRegistry.EmptyMetadataUri.selector);
        registry.registerAgent("");
    }

    // --- queries ------------------------------------------------------------

    function test_Queries_ReturnHistoryInOrder() public {
        vm.startPrank(analyst);
        registry.attest("cirbtc", "D", 50);
        vm.warp(block.timestamp + 1);
        registry.attest("cirbtc", "C", 55);
        vm.stopPrank();

        assertEq(registry.getAttestationCount("cirbtc"), 2);
        FidexRegistry.Attestation[] memory all = registry.getAllAttestations("cirbtc");
        assertEq(all.length, 2);
        assertEq(all[0].letter, "D");
        assertEq(all[1].letter, "C");

        FidexRegistry.Attestation memory latest = registry.getLatestAttestation("cirbtc");
        assertEq(latest.letter, "C", "latest must be the most recent");
    }

    function test_getAllAttestations_EmptyRatherThanRevert() public view {
        FidexRegistry.Attestation[] memory all = registry.getAllAttestations("never-seen");
        assertEq(all.length, 0);
    }

    function test_getLatestAttestation_RevertWhen_UnknownSlug() public {
        vm.expectRevert(abi.encodeWithSelector(FidexRegistry.SlugNotFound.selector, "nope"));
        registry.getLatestAttestation("nope");
    }

    function test_getAttestationByIndex_RevertWhen_OutOfBounds() public {
        vm.prank(analyst);
        registry.attest("cirbtc", "D", 50);
        vm.expectRevert(abi.encodeWithSelector(FidexRegistry.IndexOutOfBounds.selector, 1, 1));
        registry.getAttestationByIndex("cirbtc", 1);
    }

    /// @dev The whole point of the allowlist. Previously `attest()` had no
    ///      signature, no allowlist and no stake, so a stranger could publish an
    ///      "A" for any slug and `getLatestAttestation` would return it. On
    ///      mainnet that record is permanent.
    function test_attest_RevertWhen_CallerNotApproved() public {
        vm.prank(other); // a stranger, not a certified analyst
        vm.expectRevert(abi.encodeWithSelector(FidexRegistry.NotApprovedAnalyst.selector, other));
        registry.attest("cirbtc", "A", 100);
    }

    /// @dev A signature is not enough on its own -- the signer must also be
    ///      allowlisted, otherwise "certified analyst" means nothing.
    function test_attestWithSig_RevertWhen_SignerNotApproved() public {
        // `other` signs correctly, but is not on the allowlist.
        bytes32 d = _digest("cirbtc", "A", 100, other, block.timestamp);
        bytes memory sig = _sign(otherPk, d);

        vm.expectRevert(abi.encodeWithSelector(FidexRegistry.NotApprovedAnalyst.selector, other));
        registry.attestWithSig("cirbtc", "A", 100, other, block.timestamp, sig);
    }

    function test_Allowlist_StrangerCannotThenCanAfterApproval() public {
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(FidexRegistry.NotApprovedAnalyst.selector, other));
        registry.attest("cirbtc", "A", 100);

        registry.setAnalystApproval(other, true);
        assertTrue(registry.isAnalyst(other));

        vm.prank(other);
        registry.attest("cirbtc", "A", 100);
        assertEq(registry.getAttestationCount("cirbtc"), 1);
    }

    function test_Allowlist_RevocationTakesEffectImmediately() public {
        registry.setAnalystApproval(analyst, false);
        vm.prank(analyst);
        vm.expectRevert(
            abi.encodeWithSelector(FidexRegistry.NotApprovedAnalyst.selector, analyst)
        );
        registry.attest("cirbtc", "D", 53);
    }

    function test_Allowlist_OnlyOwnerCanChange() public {
        vm.prank(other);
        vm.expectRevert();
        registry.setAnalystApproval(other, true);

        vm.prank(analyst);
        vm.expectRevert();
        registry.setAnalystApproval(other, true);
    }

    function test_Allowlist_Batch() public {
        address[] memory addrs = new address[](2);
        addrs[0] = other;
        addrs[1] = agent;

        vm.expectEmit(true, false, false, true, address(registry));
        emit AnalystApprovalUpdated(other, true);
        registry.setAnalystApprovals(addrs, true);

        assertTrue(registry.isAnalyst(other));
        assertTrue(registry.isAnalyst(agent));

        registry.setAnalystApprovals(addrs, false);
        assertFalse(registry.isAnalyst(other));
        assertFalse(registry.isAnalyst(agent));
    }

    function test_Allowlist_RevertWhen_EmptyBatch() public {
        address[] memory none = new address[](0);
        vm.expectRevert(FidexRegistry.EmptyAnalystBatch.selector);
        registry.setAnalystApprovals(none, true);
    }

    function test_Allowlist_RevertWhen_ZeroAddress() public {
        vm.expectRevert(abi.encodeWithSelector(FidexRegistry.NotApprovedAnalyst.selector, address(0)));
        registry.setAnalystApproval(address(0), true);
    }

    /// @dev A fresh registry must accept nobody. Forgetting to configure the
    ///      allowlist should lock the registry, not open it.
    function test_Allowlist_EmptyByDefault_FailsClosed() public {
        FidexRegistry blank = new FidexRegistry(address(this), new address[](0));
        vm.prank(analyst);
        vm.expectRevert(
            abi.encodeWithSelector(FidexRegistry.NotApprovedAnalyst.selector, analyst)
        );
        blank.attest("cirbtc", "A", 100);
    }

    /// @dev Owner is two-step, so a mistyped owner update cannot brick the
    ///      allowlist.
    function test_Ownership_TwoStep() public {
        // No vm.prank: the test contract is already the caller.
        registry.transferOwnership(other);
        // Still this contract until the new owner accepts.
        assertEq(registry.owner(), address(this));
        vm.prank(other);
        registry.acceptOwnership();
        assertEq(registry.owner(), other);

        // Only the new owner can now manage the allowlist -- the previous owner
        // has lost that power, which is the point of the handover.
        vm.prank(address(this));
        vm.expectRevert();
        registry.setAnalystApproval(other, true);

        vm.prank(other);
        registry.setAnalystApproval(other, true);
        assertTrue(registry.isAnalyst(other));
    }
}
